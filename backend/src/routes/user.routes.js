const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, validate(schemas.updateProfile), async (req, res) => {
  try {
    const { name, avatar, bio } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', protect, validate(schemas.updatePreferences), async (req, res) => {
  try {
    const { language, city, area, categories } = req.body;

    const updateData = { preferences: { ...req.user.preferences } };
    if (language) updateData.preferences.language = language;
    if (city !== undefined) updateData.preferences.city = city;
    if (area !== undefined) updateData.preferences.area = area;
    if (categories) updateData.preferences.categories = categories;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('preferences.city', 'name slug')
      .populate('preferences.area', 'name slug');

    res.json({ 
      message: 'Preferences updated',
      preferences: user.preferences 
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (admin only)
// @access  Private/Admin
router.put('/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'reporter', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent changing own role
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: `User role updated to ${role}`,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// @route   PUT /api/users/:id/status
// @desc    Activate/deactivate user (admin only)
// @access  Private/Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { isActive } = req.body;

    // Prevent deactivating self
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// @route   GET /api/users/reporters
// @desc    Get all reporters
// @access  Private/Admin
router.get('/reporters', protect, adminOnly, async (req, res) => {
  try {
    const reporters = await User.find({ role: 'reporter', isActive: true })
      .select('name email avatar bio articlesCount assignedCategories')
      .populate('assignedCategories', 'name slug');

    res.json({ reporters });
  } catch (error) {
    console.error('Get reporters error:', error);
    res.status(500).json({ error: 'Failed to fetch reporters' });
  }
});

// @route   PUT /api/users/reporters/:id/categories
// @desc    Assign categories to reporter
// @access  Private/Admin
router.put('/reporters/:id/categories', protect, adminOnly, async (req, res) => {
  try {
    const { categories } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'reporter' },
      { assignedCategories: categories },
      { new: true }
    ).populate('assignedCategories', 'name slug');

    if (!user) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    res.json({ 
      message: 'Categories assigned',
      reporter: user
    });
  } catch (error) {
    console.error('Assign categories error:', error);
    res.status(500).json({ error: 'Failed to assign categories' });
  }
});

module.exports = router;
