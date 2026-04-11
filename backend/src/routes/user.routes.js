const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// ─────────────────────────────────────────────
//  GET ALL USERS (admin)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
//  STATIC PATHS  (must come before /:id)
// ─────────────────────────────────────────────

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

// @route   GET /api/users/yellow-pages/nearby
// @desc    Get yellow-page users. If lat/lng provided → within radius. If not → return all.
// @access  Public
router.get('/yellow-pages/nearby', validate(schemas.nearbyYelloPage, 'query'), async (req, res) => {
  try {
    const { latitude, longitude, radius = 50, page = 1, limit = 20 } = req.query;

    const hasLocation = latitude !== undefined && longitude !== undefined;
    const radiusInMeters = Number(radius) * 1000; // km → metres

    const baseFilter = { isEnableYelloPage: true, isActive: true };

    let users, total;

    // if (hasLocation) {
    //   // ── Geo query: nearest first within radius ──────────────────────────────
    //   const [geoUsers, countResult] = await Promise.all([
    //     User.find({
    //       ...baseFilter,
    //       location: {
    //         $near: {
    //           $geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    //           $maxDistance: radiusInMeters
    //         }
    //       }
    //     })
    //       .select('-password -refreshToken -seenArticles')
    //       .skip((Number(page) - 1) * Number(limit))
    //       .limit(Number(limit)),

    //     User.aggregate([
    //       {
    //         $geoNear: {
    //           near: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    //           distanceField: 'dist',
    //           maxDistance: radiusInMeters,
    //           query: baseFilter,
    //           spherical: true
    //         }
    //       },
    //       { $count: 'total' }
    //     ])
    //   ]);

    //   users = geoUsers;
    //   total = countResult.length ? countResult[0].total : 0;

    // } else {
    //   // ── No location: return all yellow-page users, sorted by name ──────────
    //   [users, total] = await Promise.all([
    //     User.find(baseFilter)
    //       .select('-password -refreshToken -seenArticles')
    //       .sort({ name: 1 })
    //       .skip((Number(page) - 1) * Number(limit))
    //       .limit(Number(limit)),

    //     User.countDocuments(baseFilter)
    //   ]);
    // }

    [users, total] = await Promise.all([
      User.find(baseFilter)
        .select('-password -refreshToken -seenArticles')
        .sort({ name: 1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),

      User.countDocuments(baseFilter)
    ]);

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      query: {
        latitude: hasLocation ? Number(latitude) : null,
        longitude: hasLocation ? Number(longitude) : null,
        radiusKm: hasLocation ? Number(radius) : null
      }
    });
  } catch (error) {
    console.error('Get nearby yellow pages error:', error);
    res.status(500).json({ error: 'Failed to fetch yellow page users' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update current user's profile (name, avatar, bio)
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
// @desc    Update current user's preferences
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

// ─────────────────────────────────────────────
//  DYNAMIC /:id  ROUTES  (must come last)
// ─────────────────────────────────────────────

// @route   GET /api/users/:id
// @desc    Get user by ID (all fields except password & refreshToken)
// @access  Private (self or admin)
router.get('/:id', protect, async (req, res) => {
  try {
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .select('-password -refreshToken')
      .populate('preferences.city', 'name slug')
      .populate('preferences.area', 'name slug')
      .populate('assignedCategories', 'name slug');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// @route   PUT /api/users/:id/yellow-page
// @desc    Update yellow page fields for a user
// @access  Private (self or admin)
router.put('/:id/yellow-page', protect, validate(schemas.updateYelloPage), async (req, res) => {
  try {
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { isEnableYelloPage, workingProfessional, location } = req.body;

    const $set = {};
    const $unset = {};

    if (isEnableYelloPage !== undefined) {
      $set.isEnableYelloPage = isEnableYelloPage;
    }

    if (workingProfessional !== undefined) {
      $set.workingProfessional = workingProfessional || null;
    }

    if (location !== undefined) {
      if (location === null) {
        // Completely remove the location field — avoids { type:"Point" } with no coordinates
        $unset.location = 1;
      } else {
        // Always write a fully-formed GeoJSON Point — never a partial object
        $set.location = {
          type: 'Point',
          coordinates: [Number(location.longitude), Number(location.latitude)],
          formattedAddress: location.formattedAddress || null
        };
      }
    }

    // Build the final mongo update — only include $unset when there's something to unset
    const mongoUpdate = { $set };
    if (Object.keys($unset).length) mongoUpdate.$unset = $unset;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      mongoUpdate,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Yellow page details updated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEnableYelloPage: user.isEnableYelloPage,
        workingProfessional: user.workingProfessional,
        location: user.location || null
      }
    });
  } catch (error) {
    console.error('Update yellow page error:', error);
    res.status(500).json({ error: 'Failed to update yellow page details' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (admin only)
// @access  Private/Admin
router.put('/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'reporter', 'sub-editor', 'chief-editor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

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

// @route   DELETE /api/users/:id
// @desc    Delete a user (admin only)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', userId: req.params.id });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
