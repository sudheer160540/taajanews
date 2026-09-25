const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const router = express.Router();
const VideoCategory = require('../models/VideoCategory');
const Video = require('../models/Video');
const { protect, authorize, canAccessScreen } = require('../middleware/auth');

const categoryBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true)
});

const categoryUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  description: Joi.string().trim().max(500).allow('', null),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean()
}).min(1);

const manageVideos = authorize('admin', 'chief-editor');
// Read-only category list for anyone with the Videos screen (incl. technical-staff)
const viewVideoCategories = canAccessScreen('videos');

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: error.details.map((d) => d.message).join('; ')
    });
  }
  req.validatedBody = value;
  next();
};

// @route   GET /api/video-categories/public
// @desc    Active video categories (for public app / video filters)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const categories = await VideoCategory.find({ isActive: true })
      .select('name slug description order')
      .sort({ order: 1, name: 1 })
      .lean();

    res.json({ categories });
  } catch (error) {
    console.error('Get public video categories error:', error);
    res.status(500).json({ error: 'Failed to fetch video categories' });
  }
});

// @route   GET /api/video-categories
// @desc    List video categories (admin)
// @access  Private/Admin
router.get('/', protect, viewVideoCategories, async (req, res) => {
  try {
    const { isActive, page = 1, limit = 50 } = req.query;
    const query = {};
    if (isActive === 'true') query.isActive = true;
    if (isActive === 'false') query.isActive = false;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const perPage = parseInt(limit, 10);

    const [categories, total] = await Promise.all([
      VideoCategory.find(query)
        .populate('createdBy', 'name email')
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      VideoCategory.countDocuments(query)
    ]);

    res.json({
      categories,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    console.error('Get video categories error:', error);
    res.status(500).json({ error: 'Failed to fetch video categories' });
  }
});

// @route   GET /api/video-categories/:id
// @desc    Get single video category
// @access  Private/Admin
router.get('/:id', protect, viewVideoCategories, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const category = await VideoCategory.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();

    if (!category) {
      return res.status(404).json({ error: 'Video category not found' });
    }

    res.json({ category });
  } catch (error) {
    console.error('Get video category error:', error);
    res.status(500).json({ error: 'Failed to fetch video category' });
  }
});

// @route   POST /api/video-categories
// @desc    Create video category
// @access  Private/Admin
router.post('/', protect, manageVideos, validateBody(categoryBodySchema), async (req, res) => {
  try {
    const category = await VideoCategory.create({
      ...req.validatedBody,
      createdBy: req.user._id
    });

    res.status(201).json({ message: 'Video category created', category });
  } catch (error) {
    console.error('Create video category error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create video category' });
  }
});

// @route   PUT /api/video-categories/:id
// @desc    Update video category
// @access  Private/Admin
router.put('/:id', protect, manageVideos, validateBody(categoryUpdateSchema), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const category = await VideoCategory.findByIdAndUpdate(
      req.params.id,
      req.validatedBody,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Video category not found' });
    }

    res.json({ message: 'Video category updated', category });
  } catch (error) {
    console.error('Update video category error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update video category' });
  }
});

// @route   DELETE /api/video-categories/:id
// @desc    Delete video category (blocked when videos are assigned)
// @access  Private/Admin
router.delete('/:id', protect, manageVideos, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const category = await VideoCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Video category not found' });
    }

    const videoCount = await Video.countDocuments({ videoCategory: category._id });
    if (videoCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category assigned to ${videoCount} video(s). Reassign or remove those videos first.`
      });
    }

    await VideoCategory.findByIdAndDelete(category._id);
    res.json({ message: 'Video category deleted' });
  } catch (error) {
    console.error('Delete video category error:', error);
    res.status(500).json({ error: 'Failed to delete video category' });
  }
});

module.exports = router;
