import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserProfile } from '../types'
import { useFeedback, type ReactionType } from '../context/FeedbackContext'
import { useSocket } from '../context/SocketContext'

type VideoChatPageProps = {
  user: UserProfile
  onLeaveChat: () => void
  onLogout: () => void
}

type VideoPartner = {
  name: string
  email: string
  interest: string
  tagline: string
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

type SimpleSessionPayload = {
  sessionId: string
}

const partnerProfiles: VideoPartner[] = [
  {
    name: 'Eli · Journalism',
    email: 'eli.north@wisc.edu',
    interest: 'Campus storytelling',
    tagline: 'Daily Cardinal video editor who loves improv nights.',
  },
  {
    name: 'Priya · Biology',
    email: 'priya.b@wisc.edu',
    interest: 'Lab life recaps',
    tagline: 'Marine bio TA with a soft spot for Mendota sunsets.',
  },
  {
    name: 'Marcus · Finance',
    email: 'marcus.lee@wisc.edu',
    interest: 'Badger basketball watch parties',
    tagline: 'Usually at the Nielsen Institute or the Kohl Center.',
  },
  {
    name: 'Sophie · Design',
    email: 'sophie.art@wisc.edu',
    interest: 'Creative critiques',
    tagline: 'Product design intern sketching at the Union daily.',
  },
]

const createVideoSessionId = () => `VC-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`

const VideoChatPage = ({ user, onLeaveChat, onLogout }: VideoChatPageProps) => {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState(createVideoSessionId)
  const [partner, setPartner] = useState<VideoPartner | null>(partnerProfiles[0])
  const [status, setStatus] = useState<'matching' | 'connected'>('matching')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { recordReaction, getReputationFor, REPORT_THRESHOLD, DISLIKE_THRESHOLD } = useFeedback()
  const [reaction, setReaction] = useState<ReactionType | null>(null)
  const [feedbackNote, setFeedbackNote] = useState('')
  const reputation = getReputationFor(partner?.email ?? '')
  const { socket, status: socketStatus, error: socketError, send: sendSocket } = useSocket()
  const realtimeReady = socketStatus === 'connected' && !!socket

  useEffect(() => {
    if (!realtimeReady) {
      const timer = window.setTimeout(() => {
        const nextPartner = partnerProfiles[Math.floor(Math.random() * partnerProfiles.length)]
        setPartner(nextPartner)
        setStatus('connected')
      }, 1400)
      return () => window.clearTimeout(timer)
    }
  }, [realtimeReady])

  useEffect(() => {
    if (realtimeReady) {
      sendSocket('match:request', { mode: 'video' })
    }
  }, [realtimeReady, sendSocket])

  useEffect(() => {
    if (!socket) return

    const handlePaired = ({ mode, sessionId: incomingSession, partnerProfile }: MatchPairedPayload) => {
      if (mode !== 'video') return
      const partnerName = partnerProfile?.name ?? 'Badger'
      setPartner({
        name: partnerName,
        email: partnerProfile?.email ?? 'unknown@wisc.edu',
        interest: partnerProfile?.interests?.[0] ?? 'campus life',
        tagline: partnerProfile?.bio ?? 'Verified UW student ready for a video chat.',
      })
      setSessionId(incomingSession)
      setStatus('connected')
      setFeedbackNote(`Connected with ${partnerName.split(' ')[0]} via secure video.`)
    }

    const handlePartnerLeft = ({ sessionId: closingSession }: SimpleSessionPayload) => {
      if (closingSession !== sessionId) return
      setStatus('matching')
      setPartner(null)
      setFeedbackNote('Your partner left the video chat.')
    }

    socket.on('match:paired', handlePaired)
    socket.on('system:partner-left', handlePartnerLeft)
    socket.on('system:session-ended', handlePartnerLeft)

    return () => {
      socket.off('match:paired', handlePaired)
      socket.off('system:partner-left', handlePartnerLeft)
      socket.off('system:session-ended', handlePartnerLeft)
    }
  }, [socket, sessionId])

  const stopLocalStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    let cancelled = false

    if (cameraEnabled) {
      setCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.')
        setCameraEnabled(false)
        return
      }

      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          streamRef.current = stream
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
            void localVideoRef.current.play().catch(() => {
              /* ignore auto play issues */
            })
          }
        })
        .catch((error) => {
          console.error(error)
          if (!cancelled) {
            setCameraError('Unable to access your camera. Please allow permissions and try again.')
            setCameraEnabled(false)
          }
        })
    } else {
      stopLocalStream()
    }

    return () => {
      cancelled = true
      stopLocalStream()
    }
  }, [cameraEnabled])

  const leaveChat = () => {
    if (realtimeReady && sessionId) {
      sendSocket('chat:leave', { sessionId, user: user.email, mode: 'video' })
    }
    onLeaveChat()
    navigate('/mode')
  }

  const handleReaction = (type: ReactionType) => {
    if (!partner?.email || reaction === type) return
    const result = recordReaction(partner.email, type)
    setReaction(type)

    if (realtimeReady) {
      sendSocket('profile:reaction', {
        type,
        target: partner.email,
        sessionId,
      })
    }

    if (result.banned) {
      setFeedbackNote('This profile has been banned from Badger Connect due to community reports.')
      return
    }

    if (type === 'report') {
      setFeedbackNote(
        `Report submitted. ${Math.max(
          REPORT_THRESHOLD - result.reports,
          0,
        )} more report(s) will trigger a ban.`,
      )
    } else if (type === 'dislike') {
      setFeedbackNote(
        `${Math.max(DISLIKE_THRESHOLD - result.dislikes, 0)} dislike(s) remain before an auto-ban.`,
      )
    } else {
      setFeedbackNote('Appreciate you boosting the positive profiles out there!')
    }
  }

  return (
    <div className="page chat-page">
      <div className="page-card video-card">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Session {sessionId}</p>
            <h1>Video lounge</h1>
            <p className="subtitle">
              {status === 'matching'
                ? 'Setting up a secure connection with another verified student…'
                : `You are now on video with ${partner?.name ?? 'your match'}`}
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

        <div className="video-stage">
          <div className={`video-remote ${status}`}>
            <div className="video-overlay">
              <p>{status === 'matching' ? 'Pairing you…' : partner?.name ?? 'Partner'}</p>
              <span>{status === 'matching' ? 'Encrypted connection' : 'Live now'}</span>
            </div>
          </div>
          <div className={`video-self ${cameraEnabled ? 'active' : 'muted'}`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={cameraEnabled && !cameraError ? 'video-feed visible' : 'video-feed'}
            />
            <div className="video-overlay">
              <p>{user.name}</p>
              <span>{cameraError || (cameraEnabled ? 'Camera on' : 'Camera paused')}</span>
            </div>
          </div>
        </div>

        <div className="video-controls">
          <button
            type="button"
            className={micEnabled ? '' : 'muted'}
            onClick={() => setMicEnabled((value) => !value)}
          >
            {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          </button>
          <button
            type="button"
            className={cameraEnabled ? '' : 'muted'}
            onClick={() => setCameraEnabled((value) => !value)}
          >
            {cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          </button>
          <button
            type="button"
            className={screenEnabled ? 'active' : ''}
            onClick={() => setScreenEnabled((value) => !value)}
          >
            {screenEnabled ? 'Stop screen share' : 'Share screen'}
          </button>
          <button type="button" className="secondary" onClick={() => sendSocket('match:request', { mode: 'video' })}>
            New match
          </button>
        </div>
        {cameraError && <p className="camera-error">{cameraError}</p>}

        <div className="reaction-panel">
          <div className="profile-card">
            <p className="summary-label">Profile</p>
            <p className="summary-value">{partner?.name ?? 'Waiting for partner'}</p>
            <p className="helper">{partner?.tagline ?? 'We will introduce you once we find a match.'}</p>
            <p className="helper">wisc email: {partner?.email ?? 'pending match'}</p>
            <p className="helper">Favorite chat topic: {partner?.interest ?? 'any topic'}</p>
          </div>
          <p className="helper">
            Use these controls to keep chats respectful. 3 reports or 10 dislikes ban the verified email.
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
      </div>
    </div>
  )
}

export default VideoChatPage
