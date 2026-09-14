const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

const getKey = () => {
  const secret = String(
    process.env.FACEBOOK_TOKEN_ENCRYPT_KEY || process.env.JWT_SECRET || 'taaja-facebook-token-key'
  );
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptSecret = (plain) => {
  if (!plain) return '';
  const value = String(plain);
  if (value.startsWith('enc:')) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptSecret = (stored) => {
  if (!stored) return '';
  const value = String(stored);
  if (!value.startsWith('enc:')) return value;
  const parts = value.split(':');
  if (parts.length !== 4) return '';
  const [, ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
};

module.exports = { encryptSecret, decryptSecret };
