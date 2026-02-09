const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

const PORT = process.env.PORT || 4000
const CLIENT_ORIGINS = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()) ?? [
  'http://localhost:5173',
]

const REPORT_THRESHOLD = 3
const DISLIKE_THRESHOLD = 10

const app = express()
app.use(cors({ origin: CLIENT_ORIGINS }))
app.use(express.json())

const reputations = new Map()
const waitingQueues = {
  text: [],
  video: [],
}
const sessions = new Map()
const emailToSockets = new Map()

const getReputation = (email = '') => {
  if (!email) {
    return { likes: 0, dislikes: 0, reports: 0, banned: false }
  }
  if (!reputations.has(email)) {
    reputations.set(email, { likes: 0, dislikes: 0, reports: 0, banned: false })
  }
  return reputations.get(email)
}

const applyReaction = (email, type) => {
  const profile = getReputation(email)
  if (type === 'like') profile.likes += 1
  if (type === 'dislike') profile.dislikes += 1
  if (type === 'report') profile.reports += 1
  if (profile.reports >= REPORT_THRESHOLD || profile.dislikes >= DISLIKE_THRESHOLD) {
    profile.banned = true
  }
  return profile
}

const sanitizeProfile = (profile = {}) => ({
  name: profile.name || 'Unknown Badger',
  email: profile.email,
  interests: profile.interests || [],
})

const registerSocketForEmail = (socketId, email) => {
  if (!email) return
  const normalized = email.toLowerCase()
  if (!emailToSockets.has(normalized)) {
    emailToSockets.set(normalized, new Set())
  }
  emailToSockets.get(normalized).add(socketId)
}

const unregisterSocket = (socketId) => {
  for (const [email, sockets] of emailToSockets.entries()) {
    sockets.delete(socketId)
    if (sockets.size === 0) {
      emailToSockets.delete(email)
    }
  }
}

const removeFromQueues = (socketId) => {
  Object.keys(waitingQueues).forEach((mode) => {
    waitingQueues[mode] = waitingQueues[mode].filter((entry) => entry.socketId !== socketId)
  })
}

const findSessionBySocket = (socketId) => {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.participants.includes(socketId)) {
      return { sessionId, session }
    }
  }
  return null
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', waiting: Object.fromEntries(Object.entries(waitingQueues).map(([mode, list]) => [mode, list.length])) })
})

app.get('/reputation/:email', (req, res) => {
  const { email } = req.params
  res.json(getReputation(email.toLowerCase()))
})

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  socket.data.profile = null
  socket.data.mode = null

  socket.on('profile:update', (profile = {}) => {
    const normalizedEmail = (profile.email || '').toLowerCase()
    socket.data.profile = { ...profile, email: normalizedEmail }
    registerSocketForEmail(socket.id, normalizedEmail)
    const rep = getReputation(normalizedEmail)
    if (rep.banned) {
      socket.emit('system:banned', rep)
    }
    socket.emit('profile:reputation', rep)
  })

  socket.on('match:request', ({ mode }) => {
    if (!mode || !waitingQueues[mode]) {
      return
    }
    const profile = socket.data.profile
    if (!profile) {
      socket.emit('system:error', 'Profile missing. Please log in again.')
      return
    }
    const rep = getReputation(profile.email)
    if (rep.banned) {
      socket.emit('system:banned', rep)
      return
    }
    removeFromQueues(socket.id)
    socket.data.mode = mode
    waitingQueues[mode].push({ socketId: socket.id })
    socket.emit('match:queued', { mode, queueLength: waitingQueues[mode].length })
    attemptPair(mode)
  })

  socket.on('chat:text:message', ({ sessionId, body, from }) => {
    if (!sessionId || !body) return
    const session = sessions.get(sessionId)
    if (!session) return
    if (!session.participants.includes(socket.id)) return
    const targetId = session.participants.find((id) => id !== socket.id)
    if (!targetId) return
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
      if (lookup) {
        endSession(lookup.sessionId, socket.id)
      }
    }
    removeFromQueues(socket.id)
  })

  socket.on('profile:reaction', ({ target, type }) => {
    if (!target || !type) return
    const normalized = target.toLowerCase()
    const rep = applyReaction(normalized, type)
    io.emit('profile:reputation', { email: normalized, ...rep })
    if (rep.banned) {
      const sockets = emailToSockets.get(normalized)
      sockets?.forEach((socketId) => {
        io.to(socketId).emit('system:banned', rep)
      })
    }
  })

  socket.on('webrtc:offer', ({ sessionId, description }) => {
    if (!sessionId || !description) return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:offer', { sessionId, description })
  })

  socket.on('webrtc:answer', ({ sessionId, description }) => {
    if (!sessionId || !description) return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:answer', { sessionId, description })
  })

  socket.on('webrtc:ice-candidate', ({ sessionId, candidate }) => {
    if (!sessionId || typeof candidate === 'undefined') return
    relayToSessionPeer(sessionId, socket.id, 'webrtc:ice-candidate', { sessionId, candidate })
  })

  socket.on('disconnect', () => {
    removeFromQueues(socket.id)
    const existing = findSessionBySocket(socket.id)
    if (existing) {
      endSession(existing.sessionId, socket.id)
    }
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
    if (!firstSocket || !secondSocket) {
      continue
    }
    const sessionId = uuidv4()
    sessions.set(sessionId, {
      id: sessionId,
      mode,
      participants: [first.socketId, second.socketId],
      startedAt: Date.now(),
    })
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

function endSession(sessionId, leaverId) {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)
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
  if (!session) return
  if (!session.participants.includes(senderId)) return
  const targetId = session.participants.find((id) => id !== senderId)
  if (!targetId) return
  io.to(targetId).emit(event, payload)
}

httpServer.listen(PORT, () => {
  console.log(`Badger Connect backend listening on port ${PORT}`)
})
