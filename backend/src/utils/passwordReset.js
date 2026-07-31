const crypto = require('crypto');

const OTP_DIGITS = 6;
const DEFAULT_OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const getOtpExpiryMinutes = () => {
  const parsed = parseInt(process.env.PASSWORD_RESET_OTP_EXPIRES_MINUTES, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OTP_EXPIRY_MINUTES;
};

/**
 * Create a numeric OTP (send to user) and its SHA-256 hash (store in DB).
 * Uses a CSPRNG and rejection sampling to avoid modulo bias.
 */
const generateOtp = () => {
  const max = 10 ** OTP_DIGITS; // e.g. 1000000
  // Rejection sampling for an unbiased value in [0, max).
  const limit = Math.floor(0xffffffff / max) * max;
  let sample;
  do {
    sample = crypto.randomBytes(4).readUInt32BE(0);
  } while (sample >= limit);
  const code = String(sample % max).padStart(OTP_DIGITS, '0');
  return { code, hash: hashOtp(code) };
};

/** Hash an OTP/token with SHA-256 for at-rest storage and constant-time compare. */
const hashOtp = (rawValue) =>
  crypto.createHash('sha256').update(String(rawValue || '')).digest('hex');

// Backwards-compatible alias (previously used for link tokens).
const hashResetToken = hashOtp;

const getOtpExpiresAt = () =>
  new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);

/**
 * Constant-time comparison of two hex-encoded hashes to avoid timing leaks.
 */
const safeCompareHash = (a, b) => {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

module.exports = {
  OTP_DIGITS,
  MAX_OTP_ATTEMPTS,
  generateOtp,
  hashOtp,
  hashResetToken,
  getOtpExpiresAt,
  getOtpExpiryMinutes,
  safeCompareHash
};
