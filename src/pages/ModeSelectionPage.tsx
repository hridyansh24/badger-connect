import { useNavigate } from 'react-router-dom'
import type { ChatMode, UserProfile } from '../types'

type ModeSelectionPageProps = {
  user: UserProfile
  onSelectMode: (mode: ChatMode) => void
  onLogout: () => void
}

const modeOptions: Array<{
  id: ChatMode
  title: string
  description: string
  details: string
  badge: string
}> = [
  {
    id: 'video',
    title: 'Video Chat',
    description: 'Random Video Chat',
    details: 'Perfect if you want to look at those the most amazing looking badgers.',
    badge: 'Most popular',
  },
  {
    id: 'text',
    title: 'Text Chat',
    description: 'Low-pressure messaging when you just want to type things out.',
    details: 'Ideal for late-night convos, swapping tips, or coordinating meetups before hopping on video.',
    badge: 'Great for multitasking',
  },
]

const ModeSelectionPage = ({ user, onSelectMode, onLogout }: ModeSelectionPageProps) => {
  const navigate = useNavigate()

  const handleSelect = (mode: ChatMode) => {
    onSelectMode(mode)
    navigate(mode === 'text' ? '/chat/text' : '/chat/video')
  }

  return (
    <div className="page mode-page">
      <div className="page-card">
        <header className="page-header">
          <p className="eyebrow">Welcome back, {user.name.split(' ')[0] || user.name}</p>
          <h1>Choose how you want to connect</h1>
          <p className="subtitle">
            We prioritize students who overlap with your interests when you share them, but you can
            always skip and keep things spontaneous.
          </p>
        </header>

        <div className="user-summary">
          <div>
            <p className="summary-label">Signed in as</p>
            <p className="summary-value">{user.email}</p>
          </div>
          <div>
            <p className="summary-label">Interests for matching</p>
            {user.interests.length ? (
              <div className="selected-chips">
                {user.interests.map((interest) => (
                  <span key={interest} className="pill">
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="helper muted">No interests selected — we&apos;ll match you with other open chats.</p>
            )}
          </div>
          <button type="button" className="ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>

        <section className="mode-grid">
          {modeOptions.map((mode) => (
            <button
              key={mode.id}
              className="mode-card"
              type="button"
              onClick={() => handleSelect(mode.id)}
            >
              <span className="pill floating">{mode.badge}</span>
              <h2>{mode.title}</h2>
              <p>{mode.description}</p>
              <p className="details">{mode.details}</p>
              <div className="cta">Start {mode.id === 'text' ? 'typing' : 'chatting'}</div>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}

export default ModeSelectionPage
