const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const languageCache = require('../utils/languageCache');

// Helper to get value from Map or plain object
const getLocalizedValue = (field, lang, fallbackLang = 'en') => {
  if (!field) return '';
  if (field instanceof Map) {
    return field.get(lang) || field.get(fallbackLang) || [...field.values()][0] || '';
  }
  // Plain object (from lean query)
  return field[lang] || field[fallbackLang] || Object.values(field)[0] || '';
};

// Transform category for localized response
const transformCategory = (category, lang, fallbackLang) => {
  if (!category) return null;
  return {
    ...category,
    name: getLocalizedValue(category.name, lang, fallbackLang),
    description: getLocalizedValue(category.description, lang, fallbackLang),
    // Keep original multilingual data for admin
    _multilingual: {
      name: category.name,
      description: category.description
    }
  };
};

// @route   GET /api/categories
// @desc    Get all categories (flat list)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { active = 'true', parent, featured, lang = defaultLang, raw } = req.query;

    const query = {};
    if (active === 'true') query.isActive = true;
    if (parent === 'null') query.parent = null;
    else if (parent) query.parent = parent;
    if (featured === 'true') query.isFeatured = true;

    const categories = await Category.find(query)
      .sort({ order: 1 })
      .lean();

    // If raw=true, return full multilingual data (for admin)
    if (raw === 'true') {
      return res.json({ categories });
    }

    // Transform for single language
    const transformedCategories = categories.map(cat => transformCategory(cat, lang, defaultLang));

    res.json({ categories: transformedCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// @route   GET /api/categories/tree
// @desc    Get category tree
// @access  Public
router.get('/tree', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;
    
    const tree = await Category.getCategoryTree(null);
    
    // Transform tree recursively
    const transformTree = (categories) => {
      return categories.map(cat => ({
        ...transformCategory(cat, lang, defaultLang),
        children: cat.children ? transformTree(cat.children) : []
      }));
    };

    res.json({ categories: transformTree(tree) });
  } catch (error) {
    console.error('Get category tree error:', error);
    res.status(500).json({ error: 'Failed to fetch category tree' });
  }
});

// @route   GET /api/categories/:id
// @desc    Get single category
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang, raw } = req.query;

    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get children
    const children = await Category.find({ 
      parent: category._id, 
      isActive: true 
    }).sort({ order: 1 }).lean();

    const breadcrumb = await Category.getBreadcrumb(category._id);

    // If raw=true, return full multilingual data
    if (raw === 'true') {
      return res.json({ category, children, breadcrumb });
    }

    res.json({ 
      category: transformCategory(category, lang, defaultLang),
      children: children.map(c => transformCategory(c, lang, defaultLang)),
      breadcrumb: breadcrumb.map(b => ({
        ...b,
        name: getLocalizedValue(b.name, lang, defaultLang)
      }))
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// @route   GET /api/categories/slug/:slug
// @desc    Get category by slug
// @access  Public
router.get('/slug/:slug', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;

    const category = await Category.findOne({ slug: req.params.slug })
      .populate('parent', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const children = await Category.find({ 
      parent: category._id, 
      isActive: true 
    }).sort({ order: 1 }).lean();

    const breadcrumb = await Category.getBreadcrumb(category._id);

    res.json({ 
      category: transformCategory(category, lang, defaultLang),
      children: children.map(c => transformCategory(c, lang, defaultLang)),
      breadcrumb: breadcrumb.map(b => ({
        ...b,
        name: getLocalizedValue(b.name, lang, defaultLang)
      }))
    });
  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// @route   POST /api/categories
// @desc    Create category
// @access  Private/Admin
router.post('/', protect, adminOnly, validate(schemas.createCategory), async (req, res) => {
  try {
    // Convert plain objects to Maps for multilingual fields
    const categoryData = {
      ...req.body,
      name: new Map(Object.entries(req.body.name || {})),
      description: req.body.description ? new Map(Object.entries(req.body.description)) : new Map()
    };

    const category = await Category.create(categoryData);
    res.status(201).json({ 
      message: 'Category created',
      category 
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Category slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'description', 'parent', 'icon', 'color', 
      'image', 'order', 'isActive', 'isFeatured'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Convert multilingual fields to Maps
        if (key === 'name' || key === 'description') {
          updates[key] = new Map(Object.entries(req.body[key] || {}));
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ 
      message: 'Category updated',
      category 
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete category (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Check if category has children
    const hasChildren = await Category.exists({ parent: req.params.id });
    if (hasChildren) {
      return res.status(400).json({ 
        error: 'Cannot delete category with subcategories. Delete or move subcategories first.' 
      });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deactivated' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// @route   PUT /api/categories/reorder
// @desc    Reorder categories
// @access  Private/Admin
router.put('/reorder', protect, adminOnly, async (req, res) => {
  try {
    const { categoryOrders } = req.body; // [{ id, order }]

    const bulkOps = categoryOrders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { order }
      }
    }));

    await Category.bulkWrite(bulkOps);

    res.json({ message: 'Categories reordered' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

module.exports = router;
