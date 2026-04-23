const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in backend/.env')
}

const JWT_TTL = '7d'
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

const generateOtp = () => {
  // Uniform 6-digit code, no leading-zero bias.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

const hashOtp = async (code) => bcrypt.hash(code, 10)
const verifyOtp = async (code, hash) => bcrypt.compare(code, hash)

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL })

const verifyToken = (token) => jwt.verify(token, JWT_SECRET)

const isWiscEmail = (email) => /^[a-z0-9_.+-]+@wisc\.edu$/i.test(email)

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  signToken,
  verifyToken,
  isWiscEmail,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
}
