const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect, generateToken, generateAccessToken, createRefreshToken, setTokenCookie } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
// @desc    Create admin user (first-time setup only)
// @access  Public (only works if no admin exists)
router.post('/admin/create', validate(schemas.register), async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(403).json({ error: 'Admin account already exists' });
    }

    const { name, email, password } = req.body;

    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      location: { type: 'Point', coordinates: [0, 0] }
    });

    const token = generateToken(admin._id);
    const accessToken = generateAccessToken(admin._id);
    const refreshToken = await createRefreshToken(admin._id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Admin account created successfully',
      token,
      accessToken,
      refreshToken,
      user: admin.toPublicJSON()
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// @route   POST /api/auth/google
// @desc    Google Sign-In (Flutter / Web)
// @access  Public
router.post('/google', validate(schemas.googleAuth), async (req, res) => {
  try {
    const { idToken, role } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
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
      return res.json({
        exists: true,
        authProvider: user.authProvider || 'local'
      });
    }

    res.json({ exists: false, authProvider: null });
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

module.exports = router;
