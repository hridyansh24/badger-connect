import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestCode } from '../lib/api'
import BrandMark from '../components/BrandMark'

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

const LoginPage = ({ bannedInterests, loadingBannedList }: LoginPageProps) => {
  const navigate = useNavigate()
  const { setPending } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [agreed, setAgreed] = useState(false)

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
    if (!normalized) return

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

  const handleSubmit = async (event: FormEvent) => {
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

    if (!agreed) {
      setError('Please confirm the community guidelines before continuing.')
      return
    }

    setSubmitting(true)
    try {
      await requestCode({ name: trimmedName, email: trimmedEmail })
      setPending({ name: trimmedName, email: trimmedEmail, interests: selectedInterests })
      navigate('/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page page-login">
      <div className="page-card login-card">
        <header className="page-header">
          <div className="brand-lockup">
            <BrandMark className="brand-mark" title="Badger Connect" />
            <p className="eyebrow">For UW–Madison students</p>
          </div>
          <h1>Badger Connect</h1>
          <p className="subtitle">Meet verified Badgers. Text or video, no setup required.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Badger"
              autoComplete="name"
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
              autoComplete="email"
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

          <label className={`consent${agreed ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              required
            />
            <span className="consent-box" aria-hidden />
            <span className="consent-text">
              I&apos;m <strong>18 or older</strong> and I agree not to engage in nudity, sexual
              content, or harassment. Violations are auto-banned and may be reported to the UW
              Dean of Students.
            </span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="primary" disabled={submitting || !agreed}>
            {submitting ? 'Sending code…' : 'Send verification code'}
          </button>

          <p className="fine-print">
            We&apos;ll email a 6-digit code to your @wisc.edu inbox. It expires in 10 minutes.
          </p>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
