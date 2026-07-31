const nodemailer = require('nodemailer');

let transporter = null;

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.EMAIL_ENABLED === 'true' || process.env.NODE_ENV === 'production')
  );

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s/g, '')
    }
  });

  return transporter;
};

const getFromAddress = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@taajanews.net';

/**
 * Send a password-reset OTP (one-time code) via SMTP.
 */
const sendPasswordResetOtpEmail = async ({ to, name, otp, expiresMinutes }) => {
  const recipient = String(to || '').trim();
  if (!recipient) return { sent: false, reason: 'missing-recipient' };

  const subject = 'Your Taaja News password reset code';
  const displayName = name || 'there';
  const minutes = expiresMinutes || 10;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #4875BC;">Taaja News</h2>
      <p>Hi ${displayName},</p>
      <p>We received a request to reset your password. Use the verification code below to continue.</p>
      <p style="margin: 24px 0; text-align:center;">
        <span style="display:inline-block;background:#f4f6fb;color:#1a2a4a;font-size:32px;
                     letter-spacing:8px;font-weight:700;padding:16px 24px;border-radius:8px;">
          ${otp}
        </span>
      </p>
      <p style="color:#666;font-size:14px;">This code expires in ${minutes} minutes. Do not share it with anyone.</p>
      <p style="color:#666;font-size:14px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  const text = `Hi ${displayName},\n\nYour Taaja News password reset code is: ${otp}\nIt expires in ${minutes} minutes. Do not share this code with anyone.\n\nIf you did not request this, ignore this email.`;

  if (!isSmtpConfigured()) {
    console.log(
      `[email] SMTP not configured — password reset OTP for ${recipient}: ${otp}\n` +
        '  Set SMTP_USER, SMTP_PASS, EMAIL_ENABLED=true in backend/.env'
    );
    return { sent: true, mode: 'log' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: getFromAddress(),
      to: recipient,
      subject,
      text,
      html
    });
    console.log(`[email] Password reset OTP sent to ${recipient} (messageId=${info.messageId})`);
    return { sent: true, mode: 'smtp', messageId: info.messageId };
  } catch (err) {
    console.error('[email] SMTP send failed:', err.message);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendPasswordResetOtpEmail,
  isSmtpConfigured
};
