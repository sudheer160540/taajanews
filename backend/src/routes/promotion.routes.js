const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Joi = require('joi');
const Promotion = require('../models/Promotion');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const schemas = {
  createPromotion: Joi.object({
    image: Joi.string().uri().required(),
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(500).allow(null, ''),
    type: Joi.string().valid('advertisement', 'goodwords').required(),
    location: Joi.object({
      type: Joi.string().valid('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2),
      formattedAddress: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      area: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
      pincode: Joi.string().allow('', null),
      placeId: Joi.string().allow('', null)
    }).allow(null),
    status: Joi.string().valid('active', 'inactive').default('active'),
    link: Joi.string().uri().allow(null, ''),
    category: Joi.string().hex().length(24).allow(null, ''),
    priority: Joi.number().integer().min(0).default(0),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null)
  }),

  updatePromotion: Joi.object({
    image: Joi.string().uri(),
    title: Joi.string().min(1).max(200),
    description: Joi.string().max(500).allow(null, ''),
    type: Joi.string().valid('advertisement', 'goodwords'),
    location: Joi.object({
      type: Joi.string().valid('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2),
      formattedAddress: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      area: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
      pincode: Joi.string().allow('', null),
      placeId: Joi.string().allow('', null)
    }).allow(null),
    status: Joi.string().valid('active', 'inactive'),
    link: Joi.string().uri().allow(null, ''),
    category: Joi.string().hex().length(24).allow(null, ''),
    priority: Joi.number().integer().min(0),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null)
  }).min(1)
};

// @route   GET /api/promotions
// @desc    Get active promotions (public — for mobile app)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      type,
      category,
      lat,
      lng,
      radiusKM = 50,
      limit = 20,
      page = 1
    } = req.query;

    const now = new Date();

    if (lat && lng) {
      const radiusMeters = Number(radiusKM) * 1000;
      const pipeline = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
            distanceField: 'distance',
            maxDistance: radiusMeters,
            spherical: true,
            query: { status: 'active' }
          }
        }
      ];

      const matchStage = {};
      if (type) matchStage.type = type;
      if (category) matchStage.category = new mongoose.Types.ObjectId(category);
      matchStage.$or = [
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $gte: now } }
      ];

      if (Object.keys(matchStage).length > 1 || matchStage.$or) {
        pipeline.push({ $match: matchStage });
      }

      pipeline.push({ $sort: { priority: -1, createdAt: -1 } });
      pipeline.push({ $skip: (Number(page) - 1) * Number(limit) });
      pipeline.push({ $limit: Number(limit) });

      const promotions = await Promotion.aggregate(pipeline);
      await Promotion.populate(promotions, [
        { path: 'category', select: 'name slug' },
        { path: 'createdBy', select: 'name' }
      ]);

      return res.json({ promotions });
    }

    const query = { status: 'active' };
    if (type) query.type = type;
    if (category) query.category = category;
    query.$or = [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: { $gte: now } }
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const promotions = await Promotion.find(query)
      .populate('category', 'name slug')
      .populate('createdBy', 'name')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Promotion.countDocuments(query);

    res.json({
      promotions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasMore: skip + promotions.length < total
      }
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// @route   GET /api/promotions/manage/list
// @desc    Get all promotions for admin dashboard
// @access  Private/Admin
router.get('/manage/list', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const promotions = await Promotion.find(query)
      .populate('category', 'name slug')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Promotion.countDocuments(query);

    res.json({
      promotions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get manage promotions error:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// @route   GET /api/promotions/:id
// @desc    Get single promotion
// @access  Private/Admin
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('createdBy', 'name');

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ promotion });
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ error: 'Failed to fetch promotion' });
  }
});

// @route   POST /api/promotions
// @desc    Create promotion
// @access  Private/Admin
router.post('/', protect, adminOnly, validate(schemas.createPromotion), async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };

    if (data.category === '') data.category = null;
    if (data.link === '') data.link = null;

    const promotion = await Promotion.create(data);
    await promotion.populate([
      { path: 'category', select: 'name slug' },
      { path: 'createdBy', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Promotion created successfully',
      promotion
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

// @route   PUT /api/promotions/:id
// @desc    Update promotion
// @access  Private/Admin
router.put('/:id', protect, adminOnly, validate(schemas.updatePromotion), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.category === '') updates.category = null;
    if (updates.link === '') updates.link = null;

    const promotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('category', 'name slug')
      .populate('createdBy', 'name');

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({
      message: 'Promotion updated successfully',
      promotion
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// @route   DELETE /api/promotions/:id
// @desc    Delete promotion
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndDelete(req.params.id);

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ message: 'Promotion deleted successfully' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

module.exports = router;
