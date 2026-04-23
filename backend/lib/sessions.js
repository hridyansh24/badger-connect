const { supabase } = require('./supabase')

// Pairing audit log. Never blocks the socket path — every call is fire-and-forget
// from the caller's perspective; errors are just logged.

const logSessionStart = async ({ sessionId, mode, userA, userB }) => {
  if (!sessionId || !mode || !userA || !userB) return
  const { error } = await supabase.from('sessions').insert({
    id: sessionId,
    mode,
    user_a_email: userA,
    user_b_email: userB,
  })
  if (error) console.error('sessions:start error', error)
}

const logSessionEnd = async ({ sessionId, endedBy, flaggedReason }) => {
  if (!sessionId) return
  const patch = {
    ended_at: new Date().toISOString(),
    ended_by: endedBy || null,
  }
  if (flaggedReason) patch.flagged_reason = flaggedReason

  const { error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', sessionId)
    .is('ended_at', null)
  if (error) console.error('sessions:end error', error)
}

module.exports = { logSessionStart, logSessionEnd }
