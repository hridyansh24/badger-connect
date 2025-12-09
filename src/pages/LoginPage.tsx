import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { UserProfile } from '../types'
import uwLogo from '../assets/uw-logo.webp'

const suggestedInterests = [
  'Badger Athletics',
  'Lakeshore Trails',
  'Bascom Hill Walks',
  'UW Housing',
  'Memorial Union Events',
  'Campus Esports',
  'Research Meetups',
  'Live Music on State Street',
  'Coffee Chats',
  'Startup Ideas',
]

type LoginPageProps = {
  onAuthenticated: (profile: UserProfile) => void
  bannedInterests: string[]
  loadingBannedList: boolean
}

const normalizeInterest = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ')

const LoginPage = ({
  onAuthenticated,
  bannedInterests,
  loadingBannedList,
}: LoginPageProps) => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState('')
  const [error, setError] = useState('')

  const availableInterests = useMemo(() => suggestedInterests, [])

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    )
  }

  const handleAddInterest = () => {
    setError('')
    const normalized = normalizeInterest(newInterest)
    if (!normalized) {
      return
    }

    const lower = normalized.toLowerCase()
    const violates = bannedInterests.some((entry) => lower.includes(entry))
    if (violates) {
      setError('That interest cannot be used on this platform. Please try another one.')
      return
    }

    setSelectedInterests((current) =>
      current.includes(normalized) ? current : [...current, normalized],
    )
    setNewInterest('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName) {
      setError('Please share your preferred name so classmates can recognize you.')
      return
    }

    if (!/^([a-z0-9_.+-]+)@wisc\.edu$/i.test(trimmedEmail)) {
      setError('This site only allows logins with a @wisc.edu email address.')
      return
    }

    const profile: UserProfile = {
      name: trimmedName,
      email: trimmedEmail,
      interests: selectedInterests,
    }

    onAuthenticated(profile)
    navigate('/mode')
  }

  return (
    <div className="page page-login">
      <div className="page-card login-card">
        <header className="page-header">
          <div className="brand-lockup">
            <p className="eyebrow">University of Wisconsin–Madison</p>
            <img src={uwLogo} alt="University of Wisconsin crest" className="uw-logo" />
          </div>
          <h1>Badger Connect</h1>
          <p className="subtitle">Fellow Badgers! Let&apos;s meet some cool ahh badgers.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Badger"
              required
            />
          </label>

          <label>
            UW–Madison email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="netid@wisc.edu"
              inputMode="email"
              required
            />
          </label>

          <div className="interest-picker">
            <div className="interest-header">
              <div>
                <strong>Interests (optional)</strong>
                <p className="helper">
                  Add topics and we&apos;ll prioritize Badgers who selected something similar. Skip
                  it if you&apos;re down to talk about anything.
                </p>
              </div>
              {loadingBannedList ? (
                <span className="pill ghost">Loading filters…</span>
              ) : (
                <span className="pill">Safe-filter on</span>
              )}
            </div>

            <div className="interest-grid">
              {availableInterests.map((interest) => (
                <button
                  type="button"
                  key={interest}
                  className={selectedInterests.includes(interest) ? 'interest selected' : 'interest'}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>

            <div className="custom-interest">
              <input
                type="text"
                value={newInterest}
                onChange={(event) => setNewInterest(event.target.value)}
                placeholder="Add something unique (e.g. Snowy Hikes)"
              />
              <button type="button" onClick={handleAddInterest}>
                Add interest
              </button>
            </div>

            {!!selectedInterests.length && (
              <div className="selected-chips">
                {selectedInterests.map((interest) => (
                  <span key={interest} className="pill dismissable">
                    {interest}
                    <button
                      type="button"
                      aria-label={`Remove ${interest}`}
                      onClick={() => toggleInterest(interest)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="primary">
            Enter the lounge
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
