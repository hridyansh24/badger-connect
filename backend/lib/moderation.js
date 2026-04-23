// Thin wrapper around OpenAI's free Moderation API.
// Fails OPEN (allows messages) if the key is missing or the API errors — we'd
// rather not brick chat because a third-party is down.
//
// Verdict shape: { allowed, severity, reason, skipped }
//   allowed:  boolean — forward the message to the partner
//   severity: 'critical' | 'block' | null
//     'critical' → auto-ban immediately (e.g. sexual content involving minors)
//     'block'    → drop + add a strike
//   reason:   category string that tripped the filter
//   skipped:  true if moderation wasn't actually run

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/moderations'
const OPENAI_MODEL = 'omni-moderation-latest'

// Categories that get the message dropped + a strike against the sender.
const BLOCK_CATEGORIES = [
  'sexual',
  'harassment/threatening',
  'hate/threatening',
  'violence/graphic',
]

// Categories that get an immediate hard ban.
const CRITICAL_CATEGORIES = ['sexual/minors']

let warnedMissingKey = false

const moderateText = async (text) => {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    if (!warnedMissingKey) {
      console.warn(
        '[moderation] OPENAI_API_KEY missing — text moderation is disabled. ' +
          'Set it in backend/.env to enable the free Moderation API.',
      )
      warnedMissingKey = true
    }
    return { allowed: true, skipped: true }
  }

  try {
    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: OPENAI_MODEL, input: text }),
    })
    if (!res.ok) {
      console.error('[moderation] api error', res.status, await res.text().catch(() => ''))
      return { allowed: true, skipped: true }
    }
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return { allowed: true, skipped: true }

    const categories = result.categories || {}

    const critical = CRITICAL_CATEGORIES.find((cat) => categories[cat])
    if (critical) {
      return { allowed: false, severity: 'critical', reason: critical }
    }

    const blocked = BLOCK_CATEGORIES.find((cat) => categories[cat])
    if (blocked) {
      return { allowed: false, severity: 'block', reason: blocked }
    }

    return { allowed: true }
  } catch (err) {
    console.error('[moderation] request failed', err)
    return { allowed: true, skipped: true }
  }
}

module.exports = { moderateText }
