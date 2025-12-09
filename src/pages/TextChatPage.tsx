import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFeedback, type ReactionType } from '../context/FeedbackContext'
import { useSocket } from '../context/SocketContext'
import type { UserProfile } from '../types'
import type { FormEvent } from 'react'

export type ChatMessage = {
  id: number
  author: 'user' | 'partner'
  body: string
  timestamp: string
}

type PartnerProfile = {
  name: string
  email: string
  interest?: string
  opener?: string
  bio?: string
}

type TextChatPageProps = {
  user: UserProfile
  onLeaveChat: () => void
  onLogout: () => void
}

type MatchPairedPayload = {
  mode: 'text' | 'video'
  sessionId: string
  partnerProfile?: {
    name?: string
    email?: string
    interests?: string[]
    bio?: string
  }
}

type TextMessagePayload = {
  sessionId: string
  body: string
  from: string
  timestamp: number
}

type SimpleSessionPayload = {
  sessionId: string
}

type MatchQueuedPayload = {
  mode: 'text' | 'video'
  queueLength: number
}

const fallbackPartners: PartnerProfile[] = [
  {
    name: 'Maya · Computer Science',
    email: 'maya.li@wisc.edu',
    interest: 'Study sessions',
    opener: 'Anyone else camping out at College Library tonight?',
    bio: 'Loves long nights at College Library and designing side projects.',
  },
  {
    name: 'Leo · Engineering',
    email: 'leo.martin@wisc.edu',
    interest: 'Building gadgets',
    opener: 'Hey! Trying to find folks for a MakerSpace sprint tomorrow.',
    bio: 'Obsessed with the MakerSpace and anything with a 3D printer.',
  },
  {
    name: 'Nia · Business',
    email: 'nia.grant@wisc.edu',
    interest: 'Campus events',
    opener: 'Thinking of hitting up Union South after class. You going?',
    bio: 'Planning Badger Entrepreneurship Club socials this semester.',
  },
  {
    name: 'Grace · Environmental Sci',
    email: 'grace.owens@wisc.edu',
    interest: 'Outdoor adventures',
    opener: 'I just spotted the best sunrise over Lake Mendota!',
    bio: 'Trail runner and lake lover, usually on Picnic Point at sunrise.',
  },
]

const DEFAULT_REMOTE_MESSAGE = 'You are now connected to a fellow Badger! Say hi.'

const createMessage = (author: ChatMessage['author'], body: string, timeSource?: number): ChatMessage => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  author,
  body,
  timestamp: new Date(timeSource ?? Date.now()).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  }),
})

const TextChatPage = ({ user, onLeaveChat, onLogout }: TextChatPageProps) => {
  const navigate = useNavigate()
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef('')
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState('')
  const [status, setStatus] = useState<'matching' | 'connected'>('matching')
  const [messageInput, setMessageInput] = useState('')
  const hasInterests = user.interests.length > 0
  const { recordReaction, getReputationFor, REPORT_THRESHOLD, DISLIKE_THRESHOLD } = useFeedback()
  const [reaction, setReaction] = useState<ReactionType | null>(null)
  const [feedbackNote, setFeedbackNote] = useState('')
  const { socket, status: socketStatus, error: socketError, send: sendSocket } = useSocket()
  const realtimeReady = socketStatus === 'connected' && !!socket

  const reputation = getReputationFor(partner?.email ?? '')

  useEffect(() => {
    sessionRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const requestLocalMatch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    const nextPartner = fallbackPartners[Math.floor(Math.random() * fallbackPartners.length)]
    setPartner(nextPartner)
    setMessages([])
    setStatus('matching')
    const nextSession = `LOCAL-${Math.floor(Math.random() * 99999)
      .toString()
      .padStart(5, '0')}`
    setSessionId(nextSession)
    timerRef.current = window.setTimeout(() => {
      setStatus('connected')
      setMessages([createMessage('partner', nextPartner.opener ?? DEFAULT_REMOTE_MESSAGE)])
    }, 1100)
  }, [])

  const requestRealtimeMatch = useCallback(() => {
    setPartner(null)
    setMessages([])
    setStatus('matching')
    sendSocket('match:request', { mode: 'text' })
  }, [sendSocket])

  const startMatch = useCallback(() => {
    setReaction(null)
    setFeedbackNote('')
    if (realtimeReady) {
      requestRealtimeMatch()
    } else {
      requestLocalMatch()
    }
  }, [realtimeReady, requestLocalMatch, requestRealtimeMatch])

  useEffect(() => {
    startMatch()
  }, [startMatch])

  useEffect(() => {
    if (!socket) return

    const handlePaired = ({ mode, sessionId: incomingSession, partnerProfile }: MatchPairedPayload) => {
      if (mode !== 'text') return
      setPartner({
        name: partnerProfile?.name ?? 'Badger',
        email: partnerProfile?.email ?? 'unknown@wisc.edu',
        interest: partnerProfile?.interests?.[0],
        bio: partnerProfile?.bio ?? 'Verified UW–Madison student.',
      })
      setMessages([])
      setStatus('connected')
      setSessionId(incomingSession)
    }

    const handleIncomingMessage = ({
      sessionId: incomingSession,
      body,
      from,
      timestamp,
    }: TextMessagePayload) => {
      if (incomingSession !== sessionRef.current) return
      const author: ChatMessage['author'] = from === user.email ? 'user' : 'partner'
      setMessages((current) => [...current, createMessage(author, body, timestamp)])
    }

    const handlePartnerLeft = ({ sessionId: closingSession }: SimpleSessionPayload) => {
      if (closingSession !== sessionRef.current) return
      setStatus('matching')
      setPartner(null)
      setMessages((current) => [...current, createMessage('partner', 'Your match left the chat.')])
    }

    const handleQueued = ({ mode }: MatchQueuedPayload) => {
      if (mode === 'text') {
        setStatus('matching')
      }
    }

    socket.on('match:paired', handlePaired)
    socket.on('chat:text:message', handleIncomingMessage)
    socket.on('system:partner-left', handlePartnerLeft)
    socket.on('system:session-ended', handlePartnerLeft)
    socket.on('match:queued', handleQueued)

    return () => {
      socket.off('match:paired', handlePaired)
      socket.off('chat:text:message', handleIncomingMessage)
      socket.off('system:partner-left', handlePartnerLeft)
      socket.off('system:session-ended', handlePartnerLeft)
      socket.off('match:queued', handleQueued)
    }
  }, [socket, user.email])

  const sendMessage = () => {
    const trimmed = messageInput.trim()
    if (!trimmed) return

    setMessages((current) => [...current, createMessage('user', trimmed)])
    setMessageInput('')
    setStatus('connected')

    if (realtimeReady && sessionRef.current) {
      sendSocket('chat:text:message', {
        sessionId: sessionRef.current,
        body: trimmed,
        from: user.email,
        to: partner?.email,
        timestamp: Date.now(),
      })
    } else {
      timerRef.current = window.setTimeout(() => {
        setMessages((current) => [
          ...current,
          createMessage('partner', 'Love that! Want to grab coffee at the Union later?'),
        ])
      }, 900)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    sendMessage()
  }

  const leaveChat = () => {
    if (realtimeReady && sessionRef.current) {
      sendSocket('chat:leave', { sessionId: sessionRef.current, user: user.email })
    }
    onLeaveChat()
    navigate('/mode')
  }

  const handleReaction = (type: ReactionType) => {
    if (!partner?.email || reaction === type) {
      return
    }
    const result = recordReaction(partner.email, type)
    setReaction(type)
    if (realtimeReady) {
      sendSocket('profile:reaction', {
        type,
        target: partner.email,
        sessionId: sessionRef.current,
      })
    }

    if (result.banned) {
      setFeedbackNote('This profile has been banned for repeated reports/dislikes.')
      return
    }

    if (type === 'report') {
      setFeedbackNote(
        `Report submitted. ${Math.max(
          REPORT_THRESHOLD - result.reports,
          0,
        )} report(s) away from a campus-wide ban.`,
      )
    } else if (type === 'dislike') {
      setFeedbackNote(
        `Dislike recorded. ${Math.max(
          DISLIKE_THRESHOLD - result.dislikes,
          0,
        )} more dislikes before a ban.`,
      )
    } else {
      setFeedbackNote('Thanks for the positive vibes! Badgers appreciate the love.')
    }
  }

  const partnerName = partner?.name ?? 'Your match'
  const partnerInterest = partner?.interest ?? 'any topic'
  const partnerBio = partner?.bio ?? 'We are still finding a partner for you.'

  return (
    <div className="page chat-page">
      <div className="page-card chat-card">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Session {sessionId || '—'}</p>
            <h1>Text chat lounge</h1>
            <p className="subtitle">
              {status === 'matching'
                ? hasInterests
                  ? 'Finding a fellow Badger who shares your interests…'
                  : 'Finding another Badger who is open to any topic…'
                : `You are now chatting with ${partnerName}`}
            </p>
          </div>
          <div className="chat-actions">
            <button type="button" className="ghost" onClick={onLogout}>
              Sign out
            </button>
            <button type="button" className="secondary" onClick={leaveChat}>
              Back to mode select
            </button>
          </div>
        </div>

        <div className={`socket-status ${socketStatus}`}>
          <p className="summary-label">Realtime link</p>
          <p className="summary-value">{socketStatus}</p>
          {socketError && <p className="helper emphasis danger">Socket error: {socketError}</p>}
        </div>

        <div className="chat-layout">
          <aside className="chat-sidebar">
            <h3>Matching details</h3>
            {hasInterests ? (
              <>
                <p className="helper">You both enjoy:</p>
                <div className="selected-chips">
                  {user.interests.slice(0, 3).map((interest) => (
                    <span key={interest} className="pill">
                      {interest}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="helper muted">
                You skipped interests, so we&apos;re pairing you with students who are open to any chat topic.
              </p>
            )}

            <div className="profile-card">
              <p className="summary-label">Profile</p>
              <p className="summary-value">{partnerName}</p>
              <p className="helper">{partnerBio}</p>
              <p className="helper">wisc email: {partner?.email ?? 'pending match'}</p>
            </div>

            <div className="status-card">
              <p className="status-label">Status</p>
              <p className={`status-value ${status}`}>{status === 'matching' ? 'Matching' : 'Connected'}</p>
              <p className="status-note">
                {hasInterests
                  ? `Partner prefers ${partnerInterest.toLowerCase()} chats.`
                  : 'Partner is open to all topics as well.'}
              </p>
            </div>

            <button type="button" className="secondary" onClick={startMatch}>
              Find another Badger
            </button>

            <div className="reaction-panel">
              <p className="summary-label">Keep our space safe</p>
              <p className="helper">
                3 reports or 10 dislikes on a verified wisc.edu email automatically bans that account.
              </p>
              <div className="reaction-stats">
                <span>Reports: {reputation.reports}</span>
                <span>Dislikes: {reputation.dislikes}</span>
                <span>Likes: {reputation.likes}</span>
              </div>
              <div className="reaction-actions">
                <button
                  type="button"
                  className={reaction === 'like' ? 'primary' : 'secondary'}
                  onClick={() => handleReaction('like')}
                  disabled={!partner?.email}
                >
                  👍 Like
                </button>
                <button
                  type="button"
                  className={reaction === 'dislike' ? 'primary' : 'secondary'}
                  onClick={() => handleReaction('dislike')}
                  disabled={!partner?.email}
                >
                  👎 Dislike
                </button>
                <button
                  type="button"
                  className={reaction === 'report' ? 'primary' : 'ghost'}
                  onClick={() => handleReaction('report')}
                  disabled={!partner?.email}
                >
                  🚩 Report
                </button>
              </div>
              {feedbackNote && <p className="helper emphasis">{feedbackNote}</p>}
              {reputation.banned && (
                <p className="helper emphasis danger">This profile has been banned from Badger Connect.</p>
              )}
            </div>
          </aside>

          <section className="chat-window">
            <div className="message-list">
              {status === 'matching' && !messages.length ? (
                <div className="system-message">Matching… sit tight.</div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.author === 'user' ? 'outbound' : 'inbound'}`}
                  >
                    <p>{message.body}</p>
                    <span>{message.timestamp}</span>
                  </div>
                ))
              )}
            </div>

            <form className="chat-composer" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Type a message to your match"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                disabled={status === 'matching'}
              />
              <button type="submit" className="primary" disabled={status === 'matching'}>
                Send
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TextChatPage
