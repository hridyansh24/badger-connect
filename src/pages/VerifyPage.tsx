import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestCode, verifyCode } from '../lib/api'

const CODE_LENGTH = 6

const VerifyPage = () => {
  const navigate = useNavigate()
  const { pending, setSession } = useAuth()
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (!pending) {
      navigate('/', { replace: true })
    } else {
      inputsRef.current[0]?.focus()
    }
  }, [pending, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = window.setTimeout(() => setResendCooldown((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendCooldown])

  const code = digits.join('')

  const trySubmit = async (finalCode: string) => {
    if (!pending || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await verifyCode({
        name: pending.name,
        email: pending.email,
        code: finalCode,
        interests: pending.interests,
      })
      setSession({ token: res.token, user: res.user })
      navigate('/mode', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const updateDigit = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '')
    if (!sanitized) {
      setDigits((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }

    setDigits((prev) => {
      const next = [...prev]
      const placedCount = Math.min(sanitized.length, CODE_LENGTH - index)
      for (let i = 0; i < placedCount; i++) {
        next[index + i] = sanitized[i]
      }
      const nextFocusIndex = Math.min(index + placedCount, CODE_LENGTH - 1)
      const filled = next.join('')
      window.setTimeout(() => {
        if (!next.includes('')) {
          void trySubmit(filled)
        } else {
          inputsRef.current[nextFocusIndex]?.focus()
        }
      }, 0)
      return next
    })
  }

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!text) return
    event.preventDefault()
    const next = Array(CODE_LENGTH).fill('')
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    window.setTimeout(() => {
      if (text.length === CODE_LENGTH) {
        void trySubmit(text)
      } else {
        inputsRef.current[text.length]?.focus()
      }
    }, 0)
  }

  const handleResend = async () => {
    if (!pending || resendCooldown > 0) return
    setResending(true)
    setError('')
    try {
      await requestCode({ name: pending.name, email: pending.email })
      setResendCooldown(30)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.')
    } finally {
      setResending(false)
    }
  }

  if (!pending) return null

  return (
    <div className="page page-login">
      <div className="page-card verify-card">
        <header className="page-header">
          <p className="eyebrow">Check your inbox</p>
          <h1>Enter your code</h1>
          <p className="subtitle">
            We sent a 6-digit code to <strong>{pending.email}</strong>. It expires in 10 minutes.
          </p>
        </header>

        <div className="otp-group" role="group" aria-label="Verification code">
          {digits.map((value, index) => (
            <input
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              className="otp-input"
              value={value}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={handleKeyDown(index)}
              onPaste={handlePaste}
              disabled={submitting}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="verify-actions">
          <button
            type="button"
            className="primary"
            onClick={() => trySubmit(code)}
            disabled={submitting || code.length !== CODE_LENGTH}
          >
            {submitting ? 'Verifying…' : 'Verify and enter'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
          >
            {resending
              ? 'Resending…'
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend code'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => navigate('/', { replace: true })}
          >
            Use a different email
          </button>
        </div>

        <p className="fine-print">
          Tip: on iOS and most Android keyboards, tap the 6-digit code that appears above the keyboard to autofill.
        </p>
      </div>
    </div>
  )
}

export default VerifyPage
