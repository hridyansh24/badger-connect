const { Resend } = require('resend')

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev'

if (!RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY must be set in backend/.env')
}

const resend = new Resend(RESEND_API_KEY)

const sendOtpEmail = async ({ to, code, name }) => {
  const displayName = name?.trim() || 'Badger'
  const subject = `${code} is your Badger Connect code`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 10px 18px; background: #c5050c; color: #fff; font-weight: 700; letter-spacing: 0.08em; border-radius: 999px; font-size: 12px;">BADGER CONNECT</div>
      </div>
      <h1 style="font-size: 22px; margin: 0 0 12px;">Hey ${displayName},</h1>
      <p style="font-size: 15px; line-height: 1.5; color: #333; margin: 0 0 24px;">
        Use this code to finish signing in. It expires in 10 minutes.
      </p>
      <div style="font-size: 36px; font-weight: 700; letter-spacing: 0.3em; text-align: center; padding: 20px; background: #f6f4ef; border-radius: 12px; margin: 0 0 24px; color: #c5050c;">
        ${code}
      </div>
      <p style="font-size: 13px; color: #666; line-height: 1.5; margin: 0;">
        If you didn't request this, you can safely ignore this email. Nobody can use this code without your inbox.
      </p>
    </div>
  `

  const text = `Hey ${displayName},\n\nYour Badger Connect code is: ${code}\n\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`

  return resend.emails.send({
    from: `Badger Connect <${RESEND_FROM}>`,
    to,
    subject,
    html,
    text,
  })
}

module.exports = { sendOtpEmail }
