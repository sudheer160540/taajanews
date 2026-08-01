const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Promotion = require('../models/Promotion');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const languageCache = require('../utils/languageCache');

// Strict allow-list for YouTube URLs (HTTPS only, known hosts only)
const youtubeUrlSchema = Joi.string()
  .uri({ scheme: ['https'] })
  .pattern(/^https:\/\/(www\.youtube\.com\/(watch\?v=|embed\/|shorts\/)[A-Za-z0-9_-]{6,}(\S*)?|youtu\.be\/[A-Za-z0-9_-]{6,}(\S*)?)$/)
  .messages({
    'string.pattern.base': 'youtubeUrl must be a valid HTTPS YouTube URL'
  });

const schemas = {
  createPromotion: Joi.object({
    image: Joi.string().uri().required(),
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(500).allow(null, ''),
    type: Joi.string().valid('advertisement', 'goodwords').required(),
    languages: Joi.array()
      .items(Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/))
      .min(1)
      .required(),
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
    youtubeUrl: youtubeUrlSchema.allow(null, ''),
    priority: Joi.number().integer().min(0).default(0),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null)
  }),

  updatePromotion: Joi.object({
    image: Joi.string().uri(),
    title: Joi.string().min(1).max(200),
    description: Joi.string().max(500).allow(null, ''),
    type: Joi.string().valid('advertisement', 'goodwords'),
    languages: Joi.array()
      .items(Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/))
      .min(1),
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
    youtubeUrl: youtubeUrlSchema.allow(null, ''),
    priority: Joi.number().integer().min(0),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null)
  }).min(1)
};

/** Normalize and validate language codes against active languages in DB. */
const normalizePromotionLanguages = async (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) {
    return { error: 'At least one language must be selected' };
  }

  const activeCodes = await languageCache.getActiveLanguageCodes();
  const normalized = [...new Set(
    codes.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
  )];

  if (normalized.length === 0) {
    return { error: 'At least one language must be selected' };
  }

  const invalid = normalized.filter((c) => !activeCodes.includes(c));
  if (invalid.length > 0) {
    return { error: `Invalid or inactive language code(s): ${invalid.join(', ')}` };
  }

  return { languages: normalized };
};

// @route   GET /api/promotions/feed
// @desc    Promotion feed for mobile app — active, newest first, optional location
// @access  Public
router.get('/feed', async (req, res) => {
  try {
    const {
      type,
      lat,
      lng,
      radiusKM = 50,
      limit = 20,
      page = 1,
      lang
    } = req.query;

    const now = new Date();
    // Compare by calendar date only (ignore time-of-day). Promotions store dates
    // at midnight UTC, so a promo ending "today" must stay active for the whole day.
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0
    ));
    const endOfToday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999
    ));
    const pageNum = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(Number(limit) || 20, 100);
    const skip = (pageNum - 1) * pageLimit;

    const dateFilter = {
      $or: [
        { startDate: null, endDate: null },
        { startDate: { $lte: endOfToday }, endDate: null },
        { startDate: null, endDate: { $gte: startOfToday } },
        { startDate: { $lte: endOfToday }, endDate: { $gte: startOfToday } }
      ]
    };

    let nearbyIds = [];

    // If location provided, find nearby promotions first, but also include non-located ones
    // if (lat && lng) {
    //   const geoPipeline = [
    //     {
    //       $geoNear: {
    //         near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
    //         distanceField: 'distance',
    //         maxDistance: Number(radiusKM) * 1000,
    //         spherical: true,
    //         query: { status: 'active' }
    //       }
    //     },
    //     { $project: { _id: 1, distance: 1 } }
    //   ];
    //   const geoResults = await Promotion.aggregate(geoPipeline);
    //   nearbyIds = geoResults.map(r => r._id);
    // }

    // Build the main query: active + date valid
    const baseMatch = { status: 'active', ...dateFilter };
    // if (type) baseMatch.type = type;

    // Language filter for mobile — empty/missing languages = visible in all languages
    const langCode = String(lang || '').toLowerCase().trim();
    if (langCode) {
      const langFilter = {
        $or: [
          { languages: { $exists: false } },
          { languages: { $size: 0 } },
          { languages: langCode }
        ]
      };
      baseMatch.$and = baseMatch.$and ? [...baseMatch.$and, langFilter] : [langFilter];
    }

    if (lat && lng) {
      // Include: nearby promotions OR promotions without a real location (coordinates [0,0])
      baseMatch.$and = [
        ...(baseMatch.$and || []),
        {
          $or: [
            { _id: { $in: nearbyIds } },
            { 'location.coordinates': { $eq: [0, 0] } },
            { 'location.coordinates': { $exists: false } },
            { location: null }
          ]
        }
      ];
    }

    const total = await Promotion.countDocuments(baseMatch);

    const promotions = await Promotion.find(baseMatch)
      .populate('createdBy', 'name')
      .sort({ priority: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean();

    res.json({
      promotions,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
        hasMore: skip + promotions.length < total
      }
    });
  } catch (error) {
    console.error('Get promotion feed error:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// @route   GET /api/promotions/manage/list
// @desc    Get all promotions for admin dashboard
// @access  Private/Admin
router.get('/manage/list', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, sortBy, sortOrder, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const searchTerm = String(search || '').trim().slice(0, 100);
    if (searchTerm) {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { 'location.city': regex },
        { 'location.formattedAddress': regex },
        { link: regex }
      ];
    }

    // Allow-list sortable fields to prevent arbitrary field injection.
    const ALLOWED_SORT_FIELDS = ['priority', 'endDate', 'startDate', 'createdAt'];
    const sortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    // Keep a stable secondary sort so equal values have a deterministic order.
    const sort = sortField === 'createdAt'
      ? { createdAt: sortDir }
      : { [sortField]: sortDir, createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .populate('createdBy', 'name')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Promotion.countDocuments(query)
    ]);

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
    const langResult = await normalizePromotionLanguages(req.body.languages);
    if (langResult.error) {
      return res.status(400).json({ error: langResult.error });
    }

    const data = { ...req.body, languages: langResult.languages, createdBy: req.user._id };

    if (data.link === '') data.link = null;
    if (data.youtubeUrl === '') data.youtubeUrl = null;

    const promotion = await Promotion.create(data);
    await promotion.populate([
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

    if (updates.languages !== undefined) {
      const langResult = await normalizePromotionLanguages(updates.languages);
      if (langResult.error) {
        return res.status(400).json({ error: langResult.error });
      }
      updates.languages = langResult.languages;
    }

    if (updates.link === '') updates.link = null;
    if (updates.youtubeUrl === '') updates.youtubeUrl = null;

    const promotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
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
