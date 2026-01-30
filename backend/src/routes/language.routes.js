const express = require('express');
const router = express.Router();
const Language = require('../models/Language');
const { protect, adminOnly } = require('../middleware/auth');
const languageCache = require('../utils/languageCache');

// @route   GET /api/languages
// @desc    Get all active languages
// @access  Public
router.get('/', async (req, res) => {
  try {
    const languages = await languageCache.getActiveLanguages();
    res.json({ languages });
  } catch (error) {
    console.error('Get languages error:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// @route   GET /api/languages/default
// @desc    Get default language
// @access  Public
router.get('/default', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguage();
    res.json({ language: defaultLang });
  } catch (error) {
    console.error('Get default language error:', error);
    res.status(500).json({ error: 'Failed to fetch default language' });
  }
});

// @route   GET /api/languages/all
// @desc    Get all languages including inactive (admin only)
// @access  Private/Admin
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const languages = await Language.find().sort({ order: 1 });
    res.json({ languages });
  } catch (error) {
    console.error('Get all languages error:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// @route   POST /api/languages
// @desc    Create new language
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { code, name, nativeName, isRTL, order } = req.body;

    // Check if code already exists
    const existing = await Language.findOne({ code: code.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Language code already exists' });
    }

    const language = await Language.create({
      code: code.toLowerCase(),
      name,
      nativeName,
      isRTL: isRTL || false,
      order: order || 0,
      isActive: true,
      isDefault: false
    });

    // Refresh cache
    await languageCache.refreshCache();

    res.status(201).json({
      message: 'Language created successfully',
      language
    });
  } catch (error) {
    console.error('Create language error:', error);
    res.status(500).json({ error: 'Failed to create language' });
  }
});

// @route   PUT /api/languages/:id
// @desc    Update language
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, nativeName, isActive, isRTL, order } = req.body;

    const language = await Language.findById(req.params.id);
    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }

    // Prevent deactivating default language
    if (language.isDefault && isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate the default language. Set another language as default first.' });
    }

    // Update fields
    if (name !== undefined) language.name = name;
    if (nativeName !== undefined) language.nativeName = nativeName;
    if (isActive !== undefined) language.isActive = isActive;
    if (isRTL !== undefined) language.isRTL = isRTL;
    if (order !== undefined) language.order = order;

    await language.save();

    // Refresh cache
    await languageCache.refreshCache();

    res.json({
      message: 'Language updated successfully',
      language
    });
  } catch (error) {
    console.error('Update language error:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

// @route   PUT /api/languages/:id/default
// @desc    Set language as default
// @access  Private/Admin
router.put('/:id/default', protect, adminOnly, async (req, res) => {
  try {
    const language = await Language.findById(req.params.id);
    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }

    if (!language.isActive) {
      return res.status(400).json({ error: 'Cannot set inactive language as default' });
    }

    // The pre-save hook will handle removing default from other languages
    language.isDefault = true;
    await language.save();

    // Refresh cache
    await languageCache.refreshCache();

    res.json({
      message: `${language.name} is now the default language`,
      language
    });
  } catch (error) {
    console.error('Set default language error:', error);
    res.status(500).json({ error: 'Failed to set default language' });
  }
});

// @route   DELETE /api/languages/:id
// @desc    Delete/deactivate language
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const language = await Language.findById(req.params.id);
    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }

    // Prevent deleting default language
    if (language.isDefault) {
      return res.status(400).json({ error: 'Cannot delete the default language. Set another language as default first.' });
    }

    // Soft delete by deactivating
    language.isActive = false;
    await language.save();

    // Refresh cache
    await languageCache.refreshCache();

    res.json({
      message: 'Language deactivated successfully',
      language
    });
  } catch (error) {
    console.error('Delete language error:', error);
    res.status(500).json({ error: 'Failed to delete language' });
  }
});

// @route   PUT /api/languages/reorder
// @desc    Reorder languages
// @access  Private/Admin
router.put('/reorder/batch', protect, adminOnly, async (req, res) => {
  try {
    const { orders } = req.body; // Array of { id, order }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders must be an array' });
    }

    const bulkOps = orders.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { order: item.order }
      }
    }));

    await Language.bulkWrite(bulkOps);

    // Refresh cache
    await languageCache.refreshCache();

    const languages = await Language.find({ isActive: true }).sort({ order: 1 });

    res.json({
      message: 'Languages reordered successfully',
      languages
    });
  } catch (error) {
    console.error('Reorder languages error:', error);
    res.status(500).json({ error: 'Failed to reorder languages' });
  }
});

module.exports = router;
