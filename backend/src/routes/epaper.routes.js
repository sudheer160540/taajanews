const express = require('express');
const router = express.Router();
const Joi = require('joi');
const EPaper = require('../models/EPaper');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const objectIdSchema = Joi.string().hex().length(24);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  area: objectIdSchema.optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});

const feedQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  area: objectIdSchema.optional()
});

const schemas = {
  createEPaper: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    date: Joi.date().required(),
    pdfUrl: Joi.string().uri().required(),
    area: objectIdSchema.allow(null, ''),
    status: Joi.string().valid('active', 'inactive').default('active')
  }),

  updateEPaper: Joi.object({
    title: Joi.string().min(1).max(200),
    date: Joi.date(),
    pdfUrl: Joi.string().uri(),
    area: objectIdSchema.allow(null, ''),
    status: Joi.string().valid('active', 'inactive')
  }).min(1)
};

// @route   GET /api/epapers/feed
// @desc    E-paper feed for mobile app — active only, newest date first
// @access  Public
router.get('/feed', validate(feedQuerySchema, 'query'), async (req, res) => {
  try {
    const { area } = req.query;
    const { pageNum, pageLimit, skip } = parsePagination(req.query);

    const query = { status: 'active' };
    if (area) query.area = area;

    const [epapers, total] = await Promise.all([
      EPaper.find(query)
        .select('title date pdfUrl area createdAt')
        .populate('area', 'name slug city')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      EPaper.countDocuments(query)
    ]);

    res.json({
      epapers,
      pagination: buildPaginationMeta({
        pageNum,
        pageLimit,
        total,
        count: epapers.length
      })
    });
  } catch (error) {
    console.error('Get e-paper feed error:', error);
    res.status(500).json({ error: 'Failed to fetch e-papers' });
  }
});

// @route   GET /api/epapers/manage/list
// @desc    Get all e-papers for admin dashboard
// @access  Private/Admin
router.get('/manage/list', protect, adminOnly, validate(listQuerySchema, 'query'), async (req, res) => {
  try {
    const { status, area } = req.query;
    const { pageNum, pageLimit, skip } = parsePagination(req.query);

    const query = {};
    if (status) query.status = status;
    if (area) query.area = area;

    const [epapers, total] = await Promise.all([
      EPaper.find(query)
        .populate('area', 'name slug city')
        .populate('createdBy', 'name')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      EPaper.countDocuments(query)
    ]);

    res.json({
      epapers,
      pagination: buildPaginationMeta({
        pageNum,
        pageLimit,
        total,
        count: epapers.length
      })
    });
  } catch (error) {
    console.error('Get manage e-papers error:', error);
    res.status(500).json({ error: 'Failed to fetch e-papers' });
  }
});

// @route   GET /api/epapers/:id
// @desc    Get single e-paper
// @access  Private/Admin
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const epaper = await EPaper.findById(req.params.id)
      .populate('area', 'name slug city')
      .populate('createdBy', 'name');

    if (!epaper) {
      return res.status(404).json({ error: 'E-paper not found' });
    }

    res.json({ epaper });
  } catch (error) {
    console.error('Get e-paper error:', error);
    res.status(500).json({ error: 'Failed to fetch e-paper' });
  }
});

// @route   POST /api/epapers
// @desc    Create e-paper
// @access  Private/Admin
router.post('/', protect, adminOnly, validate(schemas.createEPaper), async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };
    if (data.area === '') data.area = null;

    const epaper = await EPaper.create(data);
    await epaper.populate([
      { path: 'area', select: 'name slug city' },
      { path: 'createdBy', select: 'name' }
    ]);

    res.status(201).json({
      message: 'E-paper created successfully',
      epaper
    });
  } catch (error) {
    console.error('Create e-paper error:', error);
    res.status(500).json({ error: 'Failed to create e-paper' });
  }
});

// @route   PUT /api/epapers/:id
// @desc    Update e-paper
// @access  Private/Admin
router.put('/:id', protect, adminOnly, validate(schemas.updateEPaper), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.area === '') updates.area = null;

    const epaper = await EPaper.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('area', 'name slug city')
      .populate('createdBy', 'name');

    if (!epaper) {
      return res.status(404).json({ error: 'E-paper not found' });
    }

    res.json({
      message: 'E-paper updated successfully',
      epaper
    });
  } catch (error) {
    console.error('Update e-paper error:', error);
    res.status(500).json({ error: 'Failed to update e-paper' });
  }
});

// @route   DELETE /api/epapers/:id
// @desc    Delete e-paper
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const epaper = await EPaper.findByIdAndDelete(req.params.id);

    if (!epaper) {
      return res.status(404).json({ error: 'E-paper not found' });
    }

    res.json({ message: 'E-paper deleted successfully' });
  } catch (error) {
    console.error('Delete e-paper error:', error);
    res.status(500).json({ error: 'Failed to delete e-paper' });
  }
});

module.exports = router;
