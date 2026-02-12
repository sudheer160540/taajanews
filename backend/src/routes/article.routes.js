const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const Category = require('../models/Category');
const { protect, optionalAuth, reporterOrAdmin, adminOnly } = require('../middleware/auth');
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

// @route   GET /api/articles
// @desc    Get published articles (public feed)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { 
      page = 1, 
      limit = 20, 
      category, 
      city, 
      area, 
      featured,
      breaking,
      search,
      lang = defaultLang
    } = req.query;

    const query = { status: 'published' };
    
    if (category) {
      // Include articles from this category and all descendants
      query.$or = [
        { category },
        { categoryAncestors: category }
      ];
    }
    if (city) query.city = city;
    if (area) query.area = area;
    if (featured === 'true') query.isFeatured = true;
    if (breaking === 'true') query.isBreaking = true;
    if (search) {
      query.$text = { $search: search };
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .populate('category', 'name slug')
      .populate('city', 'name')
      .populate('area', 'name')
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Article.countDocuments(query);

    // Transform for single language response
    const transformedArticles = articles.map(article => ({
      ...article,
      title: getLocalizedValue(article.title, lang, defaultLang),
      summary: getLocalizedValue(article.summary, lang, defaultLang),
      // Transform nested objects
      category: article.category ? {
        ...article.category,
        name: getLocalizedValue(article.category.name, lang, defaultLang)
      } : null,
      city: article.city ? {
        ...article.city,
        name: getLocalizedValue(article.city.name, lang, defaultLang)
      } : null,
      area: article.area ? {
        ...article.area,
        name: getLocalizedValue(article.area.name, lang, defaultLang)
      } : null
    }));

    res.json({
      articles: transformedArticles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// @route   GET /api/articles/nearby
// @desc    Get articles near a location
// @access  Public
router.get('/nearby', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lng, lat, distance = 10000, limit = 20, lang = defaultLang } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ error: 'Longitude and latitude are required' });
    }

    const articles = await Article.findNearby(
      [parseFloat(lng), parseFloat(lat)],
      parseInt(distance),
      parseInt(limit)
    );

    // Transform for language
    const transformedArticles = articles.map(article => ({
      ...article,
      title: getLocalizedValue(article.title, lang, defaultLang),
      summary: getLocalizedValue(article.summary, lang, defaultLang),
      distance: Math.round(article.distance) // in meters
    }));

    res.json({ articles: transformedArticles });
  } catch (error) {
    console.error('Get nearby articles error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby articles' });
  }
});

// @route   GET /api/articles/trending
// @desc    Get trending articles
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { limit = 10, lang = defaultLang } = req.query;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const articles = await Article.find({
      status: 'published',
      publishedAt: { $gte: oneDayAgo }
    })
      .select('title slug featuredImage engagement publishedAt author category')
      .populate('author', 'name avatar')
      .populate('category', 'name slug')
      .sort({ 'engagement.views': -1, 'engagement.likes': -1 })
      .limit(Number(limit))
      .lean();

    const transformedArticles = articles.map(article => ({
      ...article,
      title: getLocalizedValue(article.title, lang, defaultLang),
      category: article.category ? {
        ...article.category,
        name: getLocalizedValue(article.category.name, lang, defaultLang)
      } : null
    }));

    res.json({ articles: transformedArticles });
  } catch (error) {
    console.error('Get trending articles error:', error);
    res.status(500).json({ error: 'Failed to fetch trending articles' });
  }
});

// @route   GET /api/articles/ref/:articleId
// @desc    Get article by articleId reference
// @access  Public
router.get('/ref/:articleId', optionalAuth, async (req, res) => {
  try {
    const article = await Article.findOne({ articleId: req.params.articleId })
      .populate('author', 'name avatar')
      .populate('category', 'name slug color');

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Get article by articleId error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// @route   GET /api/articles/:slug
// @desc    Get single article by slug
// @access  Public
router.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;

    const article = await Article.findOne({ 
      slug: req.params.slug,
      status: 'published'
    })
      .populate('author', 'name avatar bio')
      .populate('category', 'name slug')
      .populate('city', 'name')
      .populate('area', 'name')
      .lean();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get breadcrumb
    const breadcrumb = await Category.getBreadcrumb(article.category._id);

    // Get related articles
    const relatedArticles = await Article.find({
      status: 'published',
      _id: { $ne: article._id },
      $or: [
        { category: article.category._id },
        { tags: { $in: article.tags || [] } }
      ]
    })
      .select('title slug featuredImage publishedAt')
      .limit(5)
      .lean();

    res.json({
      article: {
        ...article,
        title: getLocalizedValue(article.title, lang, defaultLang),
        summary: getLocalizedValue(article.summary, lang, defaultLang),
        content: getLocalizedValue(article.content, lang, defaultLang),
        category: article.category ? {
          ...article.category,
          name: getLocalizedValue(article.category.name, lang, defaultLang)
        } : null,
        city: article.city ? {
          ...article.city,
          name: getLocalizedValue(article.city.name, lang, defaultLang)
        } : null,
        area: article.area ? {
          ...article.area,
          name: getLocalizedValue(article.area.name, lang, defaultLang)
        } : null
      },
      breadcrumb: breadcrumb.map(b => ({
        ...b,
        name: getLocalizedValue(b.name, lang, defaultLang)
      })),
      relatedArticles: relatedArticles.map(a => ({
        ...a,
        title: getLocalizedValue(a.title, lang, defaultLang)
      }))
    });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// @route   GET /api/articles/:id
// @desc    Get article by ID (for editing)
// @access  Private/Reporter
router.get('/:id', protect, reporterOrAdmin, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'name avatar')
      .populate('category', 'name slug');

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check permission - reporters can only view their own articles
    if (req.user.role === 'reporter' && 
        article.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this article' });
    }

    // Return full multilingual data for editing
    res.json({ article });
  } catch (error) {
    console.error('Get article by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// @route   POST /api/articles
// @desc    Create article
// @access  Private/Reporter
router.post('/', protect, reporterOrAdmin, validate(schemas.createArticle), async (req, res) => {
  try {
    // Get category ancestors
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Convert plain objects to Maps for multilingual fields
    const articleData = {
      ...req.body,
      title: new Map(Object.entries(req.body.title || {})),
      summary: new Map(Object.entries(req.body.summary || {})),
      content: new Map(Object.entries(req.body.content || {})),
      author: req.user._id,
      categoryAncestors: category.ancestors.map(a => a._id)
    };

    // Handle featured image caption
    if (articleData.featuredImage?.caption) {
      articleData.featuredImage.caption = new Map(Object.entries(articleData.featuredImage.caption));
    }

    const article = await Article.create(articleData);

    // Update category article count
    await Category.findByIdAndUpdate(req.body.category, {
      $inc: { articleCount: 1 }
    });

    // Update reporter article count
    await require('../models/User').findByIdAndUpdate(req.user._id, {
      $inc: { articlesCount: 1 }
    });

    res.status(201).json({
      message: 'Article created',
      article
    });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// @route   PUT /api/articles/:id
// @desc    Update article
// @access  Private/Reporter
router.put('/:id', protect, reporterOrAdmin, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check permission
    if (req.user.role === 'reporter' && 
        article.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this article' });
    }

    // If category changed, update ancestors
    if (req.body.category && req.body.category !== article.category.toString()) {
      const newCategory = await Category.findById(req.body.category);
      if (newCategory) {
        req.body.categoryAncestors = newCategory.ancestors.map(a => a._id);
      }
    }

    // Convert plain objects to Maps for multilingual fields
    const updateData = { ...req.body };
    if (updateData.title) {
      updateData.title = new Map(Object.entries(updateData.title));
    }
    if (updateData.summary) {
      updateData.summary = new Map(Object.entries(updateData.summary));
    }
    if (updateData.content) {
      updateData.content = new Map(Object.entries(updateData.content));
    }
    if (updateData.featuredImage?.caption) {
      updateData.featuredImage.caption = new Map(Object.entries(updateData.featuredImage.caption));
    }

    const updatedArticle = await Article.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Article updated',
      article: updatedArticle
    });
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// @route   PUT /api/articles/:id/status
// @desc    Update article status
// @access  Private/Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['draft', 'pending', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        publishedAt: status === 'published' ? new Date() : undefined
      },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      message: `Article ${status}`,
      article
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update article status' });
  }
});

// @route   DELETE /api/articles/:id
// @desc    Delete article (archive)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article archived' });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// @route   GET /api/articles/manage/list
// @desc    Get articles for management (reporter dashboard)
// @access  Private/Reporter
router.get('/manage/list', protect, reporterOrAdmin, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { page = 1, limit = 20, status, category, lang = defaultLang } = req.query;

    const query = {};
    
    // Reporters can only see their own articles
    if (req.user.role === 'reporter') {
      query.author = req.user._id;
    }
    
    if (status) query.status = status;
    if (category) query.category = category;

    const articles = await Article.find(query)
      .select('title slug status publishedAt createdAt engagement author category')
      .populate('author', 'name')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Article.countDocuments(query);

    // Transform articles for display
    const transformedArticles = articles.map(article => ({
      ...article,
      title: getLocalizedValue(article.title, lang, defaultLang),
      category: article.category ? {
        ...article.category,
        name: getLocalizedValue(article.category.name, lang, defaultLang)
      } : null
    }));

    res.json({
      articles: transformedArticles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get managed articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

module.exports = router;
