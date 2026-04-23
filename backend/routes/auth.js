const express = require('express')
const { supabase } = require('../lib/supabase')
const {
  generateOtp,
  hashOtp,
  verifyOtp,
  signToken,
  isWiscEmail,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
} = require('../lib/auth')
const { sendOtpEmail } = require('../lib/resend')
const { upsertUser, getReputation } = require('../lib/reputation')

const router = express.Router()

// Tiny in-memory rate limiter: 5 requests per email per hour.
const requestBuckets = new Map()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 5

const rateLimit = (email) => {
  const now = Date.now()
  const bucket = (requestBuckets.get(email) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  )
  if (bucket.length >= RATE_MAX) return false
  bucket.push(now)
  requestBuckets.set(email, bucket)
  return true
}

router.post('/request-code', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim()
    const email = (req.body?.email || '').trim().toLowerCase()

    if (!name) return res.status(400).json({ error: 'Name is required.' })
    if (!isWiscEmail(email)) {
      return res
        .status(400)
        .json({ error: 'Only @wisc.edu email addresses are allowed.' })
    }

    const rep = await getReputation(email)
    if (rep.banned) {
      return res
        .status(403)
        .json({ error: 'This account has been banned from Badger Connect.' })
    }

    if (!rateLimit(email)) {
      return res.status(429).json({
        error: 'Too many codes requested. Try again in an hour.',
      })
    }

    const code = generateOtp()
    const code_hash = await hashOtp(code)
    const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString()

    // Invalidate outstanding codes for this email.
    await supabase
      .from('verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', email)
      .is('consumed_at', null)

    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({ email, code_hash, expires_at })

    if (insertError) {
      console.error('verification_codes:insert', insertError)
      return res.status(500).json({ error: 'Could not issue a code. Try again.' })
    }

    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      console.log(`[dev] OTP for ${email}: ${code}`)
    }

    const { error: sendError } = await sendOtpEmail({ to: email, code, name })
    if (sendError) {
      console.error('resend:send', sendError)
      if (!isDev) {
        return res
          .status(502)
          .json({ error: 'Could not send the email. Try again in a minute.' })
      }
      // In dev, let the user grab the code from the terminal instead of the inbox.
      return res.json({
        ok: true,
        expiresInSec: OTP_TTL_MS / 1000,
        devMessage: 'Email delivery failed; check the backend terminal for the code.',
      })
    }

    res.json({ ok: true, expiresInSec: OTP_TTL_MS / 1000 })
  } catch (err) {
    console.error('request-code fatal', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

router.post('/verify-code', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim()
    const email = (req.body?.email || '').trim().toLowerCase()
    const code = (req.body?.code || '').trim()
    const interests = Array.isArray(req.body?.interests) ? req.body.interests : []

    if (!isWiscEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid email or code.' })
    }

    const { data: rows, error: fetchError } = await supabase
      .from('verification_codes')
      .select('id, code_hash, expires_at, consumed_at, attempts')
      .eq('email', email)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('verification_codes:select', fetchError)
      return res.status(500).json({ error: 'Verification failed.' })
    }

    const record = rows?.[0]
    if (!record) {
      return res
        .status(400)
        .json({ error: 'No active code. Request a new one.' })
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' })
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await supabase
        .from('verification_codes')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', record.id)
      return res
        .status(429)
        .json({ error: 'Too many attempts. Request a new code.' })
    }

    const match = await verifyOtp(code, record.code_hash)
    if (!match) {
      await supabase
        .from('verification_codes')
        .update({ attempts: record.attempts + 1 })
        .eq('id', record.id)
      return res.status(400).json({ error: 'Incorrect code.' })
    }

    await supabase
      .from('verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id)

    // Successful verification is treated as consent to the community guidelines
    // shown on the signup form (18+, no nudity/sexual content).
    await upsertUser({ email, name, interests, consented: true })

    const token = signToken({ email, name })
    res.json({ ok: true, token, user: { email, name, interests } })
  } catch (err) {
    console.error('verify-code fatal', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

module.exports = router
