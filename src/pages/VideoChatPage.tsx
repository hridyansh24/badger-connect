import { useCallback, useEffect, useRef, useState } from 'react'
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
  initiator?: boolean
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

type WebRtcDescriptionPayload = {
  sessionId: string
  description: RTCSessionDescriptionInit
}

type WebRtcCandidatePayload = {
  sessionId: string
  candidate: RTCIceCandidateInit | null
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
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

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
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const sessionIdRef = useRef(sessionId)
  const cameraEnabledRef = useRef(cameraEnabled)
  const { recordReaction, getReputationFor, REPORT_THRESHOLD, DISLIKE_THRESHOLD } = useFeedback()
  const [reaction, setReaction] = useState<ReactionType | null>(null)
  const [feedbackNote, setFeedbackNote] = useState('')
  const [shouldInitiateCall, setShouldInitiateCall] = useState(false)
  const [webrtcStatus, setWebrtcStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [remoteVideoActive, setRemoteVideoActive] = useState(false)
  const reputation = getReputationFor(partner?.email ?? '')
  const { socket, status: socketStatus, error: socketError, send: sendSocket } = useSocket()
  const realtimeReady = socketStatus === 'connected' && !!socket

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled
  }, [cameraEnabled])

  const stopStreamTracks = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop())
  }

  const setLocalPreviewStream = useCallback((stream: MediaStream | null) => {
    if (!localVideoRef.current) return
    localVideoRef.current.srcObject = stream
    if (stream) {
      void localVideoRef.current.play().catch(() => {
        /* autoplay block ignored */
      })
    }
  }, [])

  const attachTracksToPeerConnection = useCallback(() => {
    const pc = peerConnectionRef.current
    if (!pc) return
    const senders = pc.getSenders()
    const audioStream = streamRef.current
    const audioTrack = audioStream?.getAudioTracks()[0]
    if (audioTrack && audioStream) {
      const existingAudio = senders.find((sender) => sender.track?.kind === 'audio')
      if (existingAudio) {
        void existingAudio.replaceTrack(audioTrack)
      } else {
        pc.addTrack(audioTrack, audioStream)
      }
    }

    const activeVideoStream = screenStreamRef.current ?? streamRef.current
    const videoTrack = activeVideoStream?.getVideoTracks()[0]
    if (videoTrack && activeVideoStream) {
      const existingVideo = senders.find((sender) => sender.track?.kind === 'video')
      if (existingVideo) {
        void existingVideo.replaceTrack(videoTrack)
      } else {
        pc.addTrack(videoTrack, activeVideoStream)
      }
    }
  }, [])

  const cleanupPeerConnection = useCallback(
    (options: { resetState?: boolean } = { resetState: true }) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null
        peerConnectionRef.current.ontrack = null
        peerConnectionRef.current.onconnectionstatechange = null
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
      if (options.resetState) {
        setRemoteVideoActive(false)
        setWebrtcStatus('idle')
        setShouldInitiateCall(false)
      }
    },
    [],
  )

  const ensurePeerConnection = useCallback(() => {
    if (!sessionIdRef.current || !socket) return null
    if (peerConnectionRef.current) return peerConnectionRef.current
    const pc = new RTCPeerConnection(RTC_CONFIGURATION)
    peerConnectionRef.current = pc
    setWebrtcStatus('connecting')
    attachTracksToPeerConnection()

    pc.onicecandidate = (event) => {
      const activeSession = sessionIdRef.current
      if (!activeSession) return
      sendSocket('webrtc:ice-candidate', {
        sessionId: activeSession,
        candidate: event.candidate ?? null,
      })
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (!remoteStream || !remoteVideoRef.current) return
      remoteVideoRef.current.srcObject = remoteStream
      setRemoteVideoActive(true)
      void remoteVideoRef.current
        .play()
        .catch(() => {
          /* ignore autoplay failures */
        })
    }

    pc.onconnectionstatechange = () => {
      if (!peerConnectionRef.current) return
      switch (peerConnectionRef.current.connectionState) {
        case 'connected':
          setWebrtcStatus('connected')
          break
        case 'failed':
        case 'disconnected':
          setWebrtcStatus('error')
          break
        case 'closed':
          setWebrtcStatus('idle')
          setRemoteVideoActive(false)
          break
        default:
          break
      }
    }

    return pc
  }, [attachTracksToPeerConnection, sendSocket, socket])

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return
    stopStreamTracks(screenStreamRef.current)
    screenStreamRef.current = null
    attachTracksToPeerConnection()
    if (cameraEnabledRef.current && streamRef.current) {
      setLocalPreviewStream(streamRef.current)
    } else if (!cameraEnabledRef.current) {
      setLocalPreviewStream(null)
    }
  }, [attachTracksToPeerConnection, setLocalPreviewStream])

  const stopLocalStream = useCallback(() => {
    if (streamRef.current) {
      stopStreamTracks(streamRef.current)
      streamRef.current = null
    }
    setLocalPreviewStream(null)
  }, [setLocalPreviewStream])

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

    const handlePaired = ({ mode, sessionId: incomingSession, partnerProfile, initiator }: MatchPairedPayload) => {
      if (mode !== 'video') return
      const partnerName = partnerProfile?.name ?? 'Badger'
      cleanupPeerConnection()
      setPartner({
        name: partnerName,
        email: partnerProfile?.email ?? 'unknown@wisc.edu',
        interest: partnerProfile?.interests?.[0] ?? 'campus life',
        tagline: partnerProfile?.bio ?? 'Verified UW student ready for a video chat.',
      })
      setSessionId(incomingSession)
      sessionIdRef.current = incomingSession
      setStatus('connected')
      setFeedbackNote(`Connected with ${partnerName.split(' ')[0]} via secure video.`)
      setScreenEnabled(false)
      setShouldInitiateCall(Boolean(initiator))
      setRemoteVideoActive(false)
      setWebrtcStatus('connecting')
      ensurePeerConnection()
    }

    const handlePartnerLeft = ({ sessionId: closingSession }: SimpleSessionPayload) => {
      if (!closingSession || closingSession !== sessionIdRef.current) return
      setStatus('matching')
      setPartner(null)
      setFeedbackNote('Your partner left the video chat.')
      setScreenEnabled(false)
      cleanupPeerConnection()
    }

    const handleOffer = async ({ sessionId: incomingSession, description }: WebRtcDescriptionPayload) => {
      if (!incomingSession || incomingSession !== sessionIdRef.current) return
      const pc = ensurePeerConnection()
      if (!pc) return
      try {
        await pc.setRemoteDescription(description)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendSocket('webrtc:answer', { sessionId: incomingSession, description: answer })
      } catch (error) {
        console.error('Failed to handle offer', error)
        setWebrtcStatus('error')
      }
    }

    const handleAnswer = async ({ sessionId: incomingSession, description }: WebRtcDescriptionPayload) => {
      if (!incomingSession || incomingSession !== sessionIdRef.current) return
      const pc = ensurePeerConnection()
      if (!pc) return
      try {
        await pc.setRemoteDescription(description)
      } catch (error) {
        console.error('Failed to handle answer', error)
        setWebrtcStatus('error')
      }
    }

    const handleIceCandidate = async ({ sessionId: incomingSession, candidate }: WebRtcCandidatePayload) => {
      if (!incomingSession || incomingSession !== sessionIdRef.current) return
      const pc = ensurePeerConnection()
      if (!pc) return
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.error('Failed to add ICE candidate', error)
      }
    }

    socket.on('match:paired', handlePaired)
    socket.on('system:partner-left', handlePartnerLeft)
    socket.on('system:session-ended', handlePartnerLeft)
    socket.on('webrtc:offer', handleOffer)
    socket.on('webrtc:answer', handleAnswer)
    socket.on('webrtc:ice-candidate', handleIceCandidate)

    return () => {
      socket.off('match:paired', handlePaired)
      socket.off('system:partner-left', handlePartnerLeft)
      socket.off('system:session-ended', handlePartnerLeft)
      socket.off('webrtc:offer', handleOffer)
      socket.off('webrtc:answer', handleAnswer)
      socket.off('webrtc:ice-candidate', handleIceCandidate)
    }
  }, [cleanupPeerConnection, ensurePeerConnection, sendSocket, socket])

  useEffect(() => {
    if (!shouldInitiateCall || status !== 'connected' || !sessionId) return
    const startOffer = async () => {
      const pc = ensurePeerConnection()
      if (!pc) return
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSocket('webrtc:offer', { sessionId, description: offer })
      } catch (error) {
        console.error('Failed to create offer', error)
        setWebrtcStatus('error')
      }
    }
    void startOffer()
  }, [ensurePeerConnection, sendSocket, sessionId, shouldInitiateCall, status])

  useEffect(() => {
    if (!cameraEnabled) return
    if (streamRef.current) {
      if (!screenEnabled) {
        setLocalPreviewStream(streamRef.current)
      }
      attachTracksToPeerConnection()
      return
    }

    let cancelled = false
    const startMedia = async () => {
      setCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.')
        setCameraEnabled(false)
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) {
          stopStreamTracks(stream)
          return
        }
        streamRef.current = stream
        stream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabled
        })
        stream.getVideoTracks().forEach((track) => {
          track.enabled = true
        })
        if (!screenEnabled) {
          setLocalPreviewStream(stream)
        }
        attachTracksToPeerConnection()
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setCameraError('Unable to access your camera. Please allow permissions and try again.')
          setCameraEnabled(false)
        }
      }
    }

    void startMedia()

    return () => {
      cancelled = true
    }
  }, [attachTracksToPeerConnection, cameraEnabled, micEnabled, screenEnabled, setLocalPreviewStream])

  useEffect(() => {
    if (screenEnabled) return
    const stream = streamRef.current
    if (!stream) {
      if (!cameraEnabled) {
        setLocalPreviewStream(null)
      }
      return
    }
    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled
    })
    setLocalPreviewStream(cameraEnabled ? stream : null)
  }, [cameraEnabled, screenEnabled, setLocalPreviewStream])

  useEffect(() => {
    const stream = streamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled
    })
  }, [micEnabled])

  useEffect(() => {
    if (!screenEnabled) {
      stopScreenShare()
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setFeedbackNote('Screen sharing is not supported in this browser.')
      setScreenEnabled(false)
      return
    }

    let cancelled = false
    const startShare = async () => {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        if (cancelled) {
          stopStreamTracks(screenStream)
          return
        }
        screenStreamRef.current = screenStream
        const [screenTrack] = screenStream.getVideoTracks()
        if (screenTrack) {
          screenTrack.onended = () => setScreenEnabled(false)
        }
        setLocalPreviewStream(screenStream)
        attachTracksToPeerConnection()
      } catch (error) {
        console.error('Screen share failed', error)
        if (!cancelled) {
          setScreenEnabled(false)
          setFeedbackNote('Screen sharing failed. Please allow permissions and try again.')
        }
      }
    }

    void startShare()

    return () => {
      cancelled = true
    }
  }, [attachTracksToPeerConnection, screenEnabled, setFeedbackNote, setLocalPreviewStream, stopScreenShare])

  useEffect(() => {
    return () => {
      stopScreenShare()
      stopLocalStream()
      cleanupPeerConnection({ resetState: false })
    }
  }, [cleanupPeerConnection, stopLocalStream, stopScreenShare])

  const leaveChat = () => {
    if (realtimeReady && sessionId) {
      sendSocket('chat:leave', { sessionId, user: user.email, mode: 'video' })
    }
    setScreenEnabled(false)
    stopScreenShare()
    cleanupPeerConnection()
    stopLocalStream()
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

  const remoteNameLabel =
    status === 'matching' ? 'Pairing you…' : (partner?.name ?? 'Partner')
  const remoteStatusLabel =
    status === 'matching'
      ? 'Encrypted connection'
      : webrtcStatus === 'connected'
        ? 'Live now'
        : webrtcStatus === 'error'
          ? 'Reconnecting…'
          : 'Negotiating…'
  const localStatusLabel = cameraError || (screenEnabled ? 'Sharing screen' : cameraEnabled ? 'Camera on' : 'Camera paused')
  const localVideoVisible = screenEnabled || (cameraEnabled && !cameraError)

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
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={remoteVideoActive ? 'video-feed visible' : 'video-feed'}
            />
            <div className="video-overlay">
              <p>{remoteNameLabel}</p>
              <span>{remoteStatusLabel}</span>
            </div>
          </div>
          <div className={`video-self ${cameraEnabled || screenEnabled ? 'active' : 'muted'}`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={localVideoVisible ? 'video-feed visible' : 'video-feed'}
            />
            <div className="video-overlay">
              <p>{user.name}</p>
              <span>{localStatusLabel}</span>
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
