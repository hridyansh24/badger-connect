require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

;(async () => {
  for (const t of ['users', 'verification_codes', 'reputation', 'reports']) {
    const { data, error } = await supabase.from(t).select('*').limit(1)
    if (error) console.log(`[${t}] ERROR`, error.code, error.message)
    else console.log(`[${t}] OK — rows fetched: ${data.length}`)
  }
})()
