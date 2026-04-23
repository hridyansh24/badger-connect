require('dotenv').config()

const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const authRouter = require('./routes/auth')
const { verifyToken } = require('./lib/auth')
const {
  getReputation,
  applyReaction,
  upsertUser,
  flagUserAuto,
  hardBanUser,
} = require('./lib/reputation')
const { moderateText } = require('./lib/moderation')
const { logSessionStart, logSessionEnd } = require('./lib/sessions')

const PORT = process.env.PORT || 4000
const CLIENT_ORIGINS = process.env.CLIENT_ORIGIN?.split(',').map((o) =>
  o.trim(),
) ?? ['http://localhost:5173']

const app = express()
app.use(cors({ origin: CLIENT_ORIGINS }))
app.use(express.json())

app.use('/auth', authRouter)

const waitingQueues = { text: [], video: [] }
const sessions = new Map()
const emailToSockets = new Map()

const sanitizeProfile = (profile = {}) => ({
  name: profile.name || 'Unknown Badger',
  email: profile.email,
  interests: profile.interests || [],
})

const registerSocketForEmail = (socketId, email) => {
  if (!email) return
  const normalized = email.toLowerCase()
  if (!emailToSockets.has(normalized)) emailToSockets.set(normalized, new Set())
  emailToSockets.get(normalized).add(socketId)
}

const unregisterSocket = (socketId) => {
  for (const [email, sockets] of emailToSockets.entries()) {
    sockets.delete(socketId)
    if (sockets.size === 0) emailToSockets.delete(email)
  }
}

const removeFromQueues = (socketId) => {
  Object.keys(waitingQueues).forEach((mode) => {
    waitingQueues[mode] = waitingQueues[mode].filter(
      (entry) => entry.socketId !== socketId,
    )
  })
}

const findSessionBySocket = (socketId) => {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.participants.includes(socketId)) return { sessionId, session }
  }
  return null
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    waiting: Object.fromEntries(
      Object.entries(waitingQueues).map(([mode, list]) => [mode, list.length]),
    ),
    sessions: sessions.size,
  })
})

app.get('/reputation/:email', async (req, res) => {
  const rep = await getReputation(req.params.email.toLowerCase())
  res.json(rep)
})

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST'] },
})

// Require a valid JWT on every socket connection. Reject otherwise.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Missing auth token'))
  try {
    const decoded = verifyToken(token)
    socket.data.user = { email: decoded.email, name: decoded.name }
    next()
  } catch (err) {
    next(new Error('Invalid or expired auth token'))
  }
})

io.on('connection', (socket) => {
  const authedUser = socket.data.user
  socket.data.profile = null
  socket.data.mode = null

  socket.on('profile:update', async (profile = {}) => {
    // Email in the JWT is the source of truth. Ignore whatever the client sent.
    const email = authedUser.email
    const name = (profile.name || authedUser.name || '').trim() || 'Badger'
    const interests = Array.isArray(profile.interests) ? profile.interests : []
    socket.data.profile = { name, email, interests }
    registerSocketForEmail(socket.id, email)

    try {
      await upsertUser({ email, name, interests })
    } catch (err) {
      console.error('profile:update upsert error', err)
    }

    const rep = await getReputation(email)
    if (rep.banned) socket.emit('system:banned', rep)
    socket.emit('profile:reputation', rep)
  })

  socket.on('match:request', async ({ mode }) => {
    if (!mode || !waitingQueues[mode]) return
    const profile = socket.data.profile
    if (!profile) {
      socket.emit('system:error', 'Profile missing. Please log in again.')
      return
    }
    const rep = await getReputation(profile.email)
    if (rep.banned) {
      socket.emit('system:banned', rep)
      return
    }
    removeFromQueues(socket.id)
    socket.data.mode = mode
    waitingQueues[mode].push({ socketId: socket.id })
    socket.emit('match:queued', {
      mode,
      queueLength: waitingQueues[mode].length,
    })
    attemptPair(mode)
  })

  socket.on('chat:text:message', async ({ sessionId, body }) => {
    if (!sessionId || !body) return
    const session = sessions.get(sessionId)
    if (!session || !session.participants.includes(socket.id)) return
    const targetId = session.participants.find((id) => id !== socket.id)
    if (!targetId) return
    const from = socket.data.profile?.email || socket.data.user.email

    const verdict = await moderateText(body)
    if (!verdict.allowed) {
      socket.emit('system:warning', {
        sessionId,
        reason: verdict.reason,
        severity: verdict.severity,
        message:
          verdict.severity === 'critical'
            ? 'Your message violated our policy and your account has been banned.'
            : 'That message was blocked by our content filter. Keep chats respectful.',
      })

      if (verdict.severity === 'critical') {
        await hardBanUser(from, verdict.reason)
        const sockets = emailToSockets.get(from)
        sockets?.forEach((sid) =>
          io.to(sid).emit('system:banned', { banned: true, reason: verdict.reason }),
        )
        endSession(sessionId, socket.id, { flaggedReason: verdict.reason })
      } else {
        const rep = await flagUserAuto(from, verdict.reason)
        if (rep?.banned) {
          socket.emit('system:banned', rep)
          endSession(sessionId, socket.id, { flaggedReason: verdict.reason })
        }
      }
      return
    }

    io.to(targetId).emit('chat:text:message', {
      sessionId,
      body,
      from,
      timestamp: Date.now(),
    })
  })

  socket.on('chat:leave', ({ sessionId }) => {
    if (sessionId && sessions.has(sessionId)) {
      endSession(sessionId, socket.id)
    } else {
      const lookup = findSessionBySocket(socket.id)
      if (lookup) endSession(lookup.sessionId, socket.id)
    }
    removeFromQueues(socket.id)
  })

  socket.on('profile:reaction', async ({ target, type }) => {
    if (!target || !type) return
    const targetEmail = String(target).toLowerCase()
    const reporterEmail = socket.data.user.email

    // Only allow reacting to a partner you're actually paired with right now.
    const sessionLookup = findSessionBySocket(socket.id)
    if (!sessionLookup) return
    const partnerId = sessionLookup.session.participants.find(
      (id) => id !== socket.id,
    )
    const partnerSocket = partnerId && io.sockets.sockets.get(partnerId)
    if (!partnerSocket || partnerSocket.data.user?.email !== targetEmail) return

    const rep = await applyReaction({
      reporterEmail,
      targetEmail,
      type,
      sessionId: sessionLookup.sessionId,
    })
    if (!rep) return

    io.emit('profile:reputation', { email: targetEmail, ...rep })
    if (rep.banned) {
      const sockets = emailToSockets.get(targetEmail)
      sockets?.forEach((socketId) => {
        io.to(socketId).emit('system:banned', rep)
      })
    }
  })

  socket.on('webrtc:offer', ({ sessionId, description }) => {
    if (!sessionId || !description) return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:offer', {
      sessionId,
      description,
    })
  })

  socket.on('webrtc:answer', ({ sessionId, description }) => {
    if (!sessionId || !description) return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:answer', {
      sessionId,
      description,
    })
  })

  socket.on('webrtc:ice-candidate', ({ sessionId, candidate }) => {
    if (!sessionId || typeof candidate === 'undefined') return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:ice-candidate', {
      sessionId,
      candidate,
    })
  })

  socket.on('disconnect', () => {
    removeFromQueues(socket.id)
    const existing = findSessionBySocket(socket.id)
    if (existing) endSession(existing.sessionId, socket.id)
    unregisterSocket(socket.id)
  })
})

function attemptPair(mode) {
  const queue = waitingQueues[mode]
  while (queue.length >= 2) {
    const first = queue.shift()
    const second = queue.shift()
    const firstSocket = io.sockets.sockets.get(first.socketId)
    const secondSocket = io.sockets.sockets.get(second.socketId)
    if (!firstSocket || !secondSocket) continue

    const sessionId = uuidv4()
    const firstEmail = firstSocket.data.profile?.email || firstSocket.data.user?.email
    const secondEmail = secondSocket.data.profile?.email || secondSocket.data.user?.email
    sessions.set(sessionId, {
      id: sessionId,
      mode,
      participants: [first.socketId, second.socketId],
      emails: { [first.socketId]: firstEmail, [second.socketId]: secondEmail },
      startedAt: Date.now(),
    })

    // Fire-and-forget audit log
    if (firstEmail && secondEmail) {
      logSessionStart({
        sessionId,
        mode,
        userA: firstEmail,
        userB: secondEmail,
      }).catch((err) => console.error('logSessionStart', err))
    }

    const profileA = sanitizeProfile(secondSocket.data.profile)
    const profileB = sanitizeProfile(firstSocket.data.profile)
    firstSocket.emit('match:paired', {
      sessionId,
      mode,
      partnerProfile: profileA,
      initiator: true,
    })
    secondSocket.emit('match:paired', {
      sessionId,
      mode,
      partnerProfile: profileB,
      initiator: false,
    })
  }
}

function endSession(sessionId, leaverId, options = {}) {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)

  const endedByEmail = leaverId ? session.emails?.[leaverId] ?? null : null
  logSessionEnd({
    sessionId,
    endedBy: endedByEmail,
    flaggedReason: options.flaggedReason,
  }).catch((err) => console.error('logSessionEnd', err))

  session.participants.forEach((participantId) => {
    const participantSocket = io.sockets.sockets.get(participantId)
    if (!participantSocket) return
    if (participantId === leaverId) {
      participantSocket.emit('system:session-ended', { sessionId })
    } else {
      participantSocket.emit('system:partner-left', { sessionId })
    }
  })
}

function relayToSessionPeer(sessionId, senderId, event, payload) {
  const session = sessions.get(sessionId)
  if (!session || !session.participants.includes(senderId)) return
  const targetId = session.participants.find((id) => id !== senderId)
  if (!targetId) return
  io.to(targetId).emit(event, payload)
}

httpServer.listen(PORT, () => {
  console.log(`Badger Connect backend listening on port ${PORT}`)
})
