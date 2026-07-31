/**
 * One-off SMTP test: node src/scripts/testSmtpEmail.js [recipient@email.com]
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const { sendPasswordResetOtpEmail, isSmtpConfigured } = require('../utils/emailService');

async function main() {
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) {
    console.error('Usage: node src/scripts/testSmtpEmail.js recipient@email.com');
    process.exit(1);
  }

  console.log('SMTP configured:', isSmtpConfigured());
  console.log('SMTP host:', process.env.SMTP_HOST || 'smtp.gmail.com');
  console.log('SMTP user:', process.env.SMTP_USER);
  console.log('Sending test to:', to);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s/g, '')
    }
  });

  try {
    await transport.verify();
    console.log('✓ SMTP connection verified');
  } catch (err) {
    console.error('✗ SMTP verify failed:', err.message);
    process.exit(1);
  }

  try {
    const result = await sendPasswordResetOtpEmail({
      to,
      name: 'Test User',
      otp: '123456',
      expiresMinutes: 10
    });
    console.log('✓ Password reset OTP email result:', result);
  } catch (err) {
    console.error('✗ Send failed:', err.message);
    process.exit(1);
  }
}

main();
