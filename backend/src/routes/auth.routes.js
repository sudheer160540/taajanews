const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect, generateToken, generateAccessToken, createRefreshToken, setTokenCookie, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  generateOtp,
  hashOtp,
  getOtpExpiresAt,
  getOtpExpiryMinutes,
  safeCompareHash,
  MAX_OTP_ATTEMPTS
} = require('../utils/passwordReset');
const { sendPasswordResetOtpEmail } = require('../utils/emailService');

const FORGOT_PASSWORD_MESSAGE =
  'If an account with that email exists, a 6-digit verification code has been sent.';

/** Forgot password only for email/password (local) accounts — not Google Sign-In. */
const canUseForgotPassword = (user) => {
  if (!user || !user.isActive) return false;
  return user.authProvider === 'local';
};

const googleClient = new OAuth2Client();

/** Comma-separated Web OAuth client IDs (web + mobile if needed). */
const getGoogleClientIds = () =>
  (process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      location: { type: 'Point', coordinates: [0, 0] }
    });

    const token = generateToken(user._id);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Registration successful',
      token,
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);
    setTokenCookie(res, token);

    res.json({
      message: 'Login successful',
      token,
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.json({ message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('preferences.city', 'name slug')
      .populate('preferences.area', 'name slug');
    
    res.json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// @route   POST /api/auth/admin/create
// @desc    Create a new user with any role (admin only)
// @access  Private/Admin
router.post('/admin/create', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    if (!['user', 'reporter', 'sub-editor', 'chief-editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      message: 'User created successfully',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// @route   POST /api/auth/google
// @desc    Google Sign-In (Flutter / Web)
// @access  Public
router.post('/google', validate(schemas.googleAuth), async (req, res) => {
  try {
    const { idToken, role } = req.body;

    const clientIds = getGoogleClientIds();
    if (!clientIds.length) {
      return res.status(503).json({ error: 'Google Sign-In is not configured on the server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientIds.length === 1 ? clientIds[0] : clientIds
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account has no email address' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
      }
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        googleId,
        avatar: picture || null,
        authProvider: 'google',
        role: role || 'user',
        lastLogin: new Date(),
        location: { type: 'Point', coordinates: [0, 0] }
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const token = generateToken(user._id);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);
    setTokenCookie(res, token);

    res.json({
      message: 'Google sign-in successful',
      token,
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Google auth error:', error);
    if (error.message && error.message.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token expired, please try again' });
    }
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// @route   POST /api/auth/register/app
// @desc    Manual registration from Flutter app (email mandatory, phone optional)
// @access  Public
router.post('/register/app', validate(schemas.registerApp), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
    }

    const user = await User.create({
      name,
      email,
      phone: phone || null,
      password,
      authProvider: 'local',
      role: role || 'user',
      location: { type: 'Point', coordinates: [0, 0] }
    });

    const token = generateToken(user._id);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Registration successful',
      token,
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('App registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// @route   POST /api/auth/check-email
// @desc    Check if an email already exists (for Flutter UX flow)
// @access  Public
router.post('/check-email', validate(schemas.checkEmail), async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select('authProvider');

    if (user) {
      const provider = user.authProvider || 'local';
      return res.json({
        exists: true,
        authProvider: provider,
        canResetPassword: canUseForgotPassword(user)
      });
    }

    res.json({ exists: false, authProvider: null, canResetPassword: false });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Exchange refresh token for a new access token + refresh token pair
// @access  Public
router.post('/refresh-token', validate(schemas.refreshToken), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const user = await User.findOne({ refreshToken }).select('+refreshToken');
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = await createRefreshToken(user._id);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

const INVALID_OTP_MESSAGE = 'Invalid or expired verification code';

/**
 * Load a user by email and validate the supplied OTP against the stored hash.
 * On a wrong (but non-expired) code, the attempt counter is incremented and the
 * request is invalidated once MAX_OTP_ATTEMPTS is reached (brute-force guard).
 * Returns { status, error } on failure or { user } on success.
 */
const verifyResetOtp = async (rawEmail, otp) => {
  const email = String(rawEmail || '').toLowerCase().trim();
  // Only override the select:false fields with `+`. Do NOT list normally-selected
  // fields here (email, name, ...) — mixing inclusion with `+` makes Mongoose return
  // only the listed fields, which previously dropped `email` and silently broke sending.
  const user = await User.findOne({ email }).select(
    '+passwordResetToken +passwordResetExpires +passwordResetAttempts +password'
  );

  if (!user || !canUseForgotPassword(user) || !user.passwordResetToken || !user.passwordResetExpires) {
    return { status: 400, error: INVALID_OTP_MESSAGE };
  }

  if (user.passwordResetExpires.getTime() < Date.now()) {
    return { status: 400, error: INVALID_OTP_MESSAGE };
  }

  if ((user.passwordResetAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    // Too many wrong guesses — invalidate the code and force a new request.
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetAttempts = 0;
    await user.save({ validateBeforeSave: false });
    return { status: 429, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  const otpHash = hashOtp(otp);
  if (!safeCompareHash(otpHash, user.passwordResetToken)) {
    user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    return { status: 400, error: INVALID_OTP_MESSAGE };
  }

  return { user };
};

// @route   POST /api/auth/forgot-password
// @desc    Send a password-reset OTP (always same response — no account enumeration)
// @access  Public
router.post('/forgot-password', validate(schemas.forgotPassword), async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select(
      '+passwordResetToken +passwordResetExpires +passwordResetAttempts'
    );

    if (user && canUseForgotPassword(user)) {
      const { code, hash } = generateOtp();
      user.passwordResetToken = hash;
      user.passwordResetExpires = getOtpExpiresAt();
      user.passwordResetAttempts = 0;
      await user.save({ validateBeforeSave: false });

      await sendPasswordResetOtpEmail({
        to: user.email,
        name: user.name,
        otp: code,
        expiresMinutes: getOtpExpiryMinutes()
      });
    }

    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// @route   POST /api/auth/verify-reset-otp
// @desc    Check a reset OTP is valid before showing the new-password step (does not consume it)
// @access  Public
router.post('/verify-reset-otp', validate(schemas.verifyResetOtp), async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyResetOtp(email, otp);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ valid: true, message: 'Code verified. You can now set a new password.' });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Set a new password using the emailed OTP
// @access  Public
router.post('/reset-password', validate(schemas.resetPassword), async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const result = await verifyResetOtp(email, otp);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const { user } = result;
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetAttempts = 0;
    user.refreshToken = null;
    await user.save();

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password while logged in (requires current password)
// @access  Private
router.post('/change-password', protect, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.password) {
      return res.status(400).json({
        error: 'This account uses Google Sign-In only. Please sign in with Google.'
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
