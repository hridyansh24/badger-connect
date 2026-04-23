const { supabase } = require('./supabase')

const REPORT_THRESHOLD = 2
const DISLIKE_THRESHOLD = 6

const emptyRep = () => ({ likes: 0, dislikes: 0, reports: 0, banned: false })

const getReputation = async (email) => {
  if (!email) return emptyRep()
  const { data, error } = await supabase
    .from('reputation')
    .select('likes, dislikes, reports, banned')
    .eq('email', email)
    .maybeSingle()
  if (error) {
    console.error('reputation:get error', error)
    return emptyRep()
  }
  return data || emptyRep()
}

const upsertUser = async ({ email, name, interests = [], consented = false }) => {
  const userRow = {
    email,
    name: name || 'Badger',
    interests,
    last_login_at: new Date().toISOString(),
  }
  if (consented) userRow.consented_at = new Date().toISOString()

  const { error } = await supabase.from('users').upsert(userRow, { onConflict: 'email' })
  if (error) console.error('users:upsert error', error)

  // Ensure a reputation row exists so later upserts don't race.
  const { error: repError } = await supabase
    .from('reputation')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })
  if (repError) console.error('reputation:init error', repError)
}

const applyReaction = async ({ reporterEmail, targetEmail, type, sessionId }) => {
  if (!targetEmail || !type) return null

  if (type === 'report' && reporterEmail) {
    // Per-reporter uniqueness (enforced by table constraint).
    const { error: reportErr } = await supabase.from('reports').insert({
      reporter_email: reporterEmail,
      target_email: targetEmail,
      session_id: sessionId || null,
      reason: null,
    })
    if (reportErr && reportErr.code !== '23505') {
      console.error('reports:insert error', reportErr)
    }
  }

  const current = await getReputation(targetEmail)
  const next = { ...current }
  if (type === 'like') next.likes += 1
  if (type === 'dislike') next.dislikes += 1
  if (type === 'report') next.reports += 1
  if (next.reports >= REPORT_THRESHOLD || next.dislikes >= DISLIKE_THRESHOLD) {
    next.banned = true
  }

  const { error } = await supabase
    .from('reputation')
    .upsert(
      {
        email: targetEmail,
        ...next,
        banned_at: next.banned ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )
  if (error) console.error('reputation:upsert error', error)

  return next
}

// System-initiated strike (e.g. moderation filter). Same ban math as a user report,
// but doesn't write to the `reports` table (which requires a real reporter_email).
const flagUserAuto = async (email, reason) => {
  if (!email) return null
  const current = await getReputation(email)
  const next = { ...current, reports: current.reports + 1 }
  if (next.reports >= REPORT_THRESHOLD || next.dislikes >= DISLIKE_THRESHOLD) {
    next.banned = true
  }
  const { error } = await supabase
    .from('reputation')
    .upsert(
      {
        email,
        ...next,
        banned_at: next.banned ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )
  if (error) console.error('reputation:auto-flag error', error)
  console.warn(`[moderation] auto-flag ${email} reason=${reason} rep=${JSON.stringify(next)}`)
  return next
}

// Immediate ban, bypassing strike math. Used for severe categories (e.g. sexual/minors).
const hardBanUser = async (email, reason) => {
  if (!email) return null
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('reputation')
    .upsert(
      {
        email,
        banned: true,
        banned_at: now,
        updated_at: now,
      },
      { onConflict: 'email' },
    )
  if (error) console.error('reputation:hard-ban error', error)
  console.warn(`[moderation] HARD BAN ${email} reason=${reason}`)
  return { banned: true, reason }
}

module.exports = {
  getReputation,
  upsertUser,
  applyReaction,
  flagUserAuto,
  hardBanUser,
  REPORT_THRESHOLD,
  DISLIKE_THRESHOLD,
}
