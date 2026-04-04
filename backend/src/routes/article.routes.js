const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const { protect, optionalAuth, reporterOrAdmin, editorOrAdmin, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const languageCache = require('../utils/languageCache');

const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// Helper to get value from Map or plain object
const getLocalizedValue = (field, lang, fallbackLang = 'en') => {
  if (!field) return '';
  if (field instanceof Map) {
    return field.get(lang) || field.get(fallbackLang) || [...field.values()][0] || '';
  }
  return field[lang] || field[fallbackLang] || Object.values(field)[0] || '';
};

// ─────────────────────────────────────────────────────────────
// GET /api/articles/feed
// Geospatial + Personalized News Feed
//
// Query: lat, lng, radiusKM, category, lang, userId, limit, page
//
// Pipeline: $geoNear → $match (category + $nin seenArticles) →
//           $sort (trendingScore desc, createdAt desc) →
//           $project (localized lang with English fallback)
// ─────────────────────────────────────────────────────────────
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const {
      latitude,
      longitude,
      radiusKM = 50,
      category,
      lang = defaultLang,
      userId,
      limit = 20,
      page = 1,
      article: pinnedArticleId
    } = req.query;

    const pageLimit = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * pageLimit;

    // ── Shared $project stage for localized fields ──
    const projectStage = {
      $project: {
        _id: 1,
        articleId: 1,
        shortId: 1,
        shortLinks: 1,
        slug: 1,
        title: {
          $ifNull: [`$title.${lang}`, { $ifNull: ['$title.en', ''] }]
        },
        summary: {
          $ifNull: [`$summary.${lang}`, { $ifNull: ['$summary.en', ''] }]
        },
        audioUrl: {
          $ifNull: [`$audio.${lang}`, { $ifNull: ['$audio.en', null] }]
        },
        featuredImage: 1,
        tags: 1,
        location: 1,
        engagement: 1,
        trendingScore: 1,
        readingTime: 1,
        source: 1,
        sourceUrl: 1,
        isFeatured: 1,
        isBreaking: 1,
        publishedAt: 1,
        createdAt: 1,
        distance: 1,
        author: {
          _id: '$author._id',
          name: '$author.name',
          avatar: '$author.avatar'
        },
        category: {
          _id: '$category._id',
          name: { $ifNull: [`$category.name.${lang}`, { $ifNull: ['$category.name.en', ''] }] },
          slug: '$category.slug'
        }
      }
    };

    const lookupStages = [
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'author' } },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ];

    // ── Fetch pinned article (if requested) — no geo/category filter ──
    let pinnedArticle = null;
    const pinnedOid = toObjectId(pinnedArticleId);
    if (pinnedOid && Number(page) === 1) {
      const pinnedPipeline = [
        { $match: { _id: pinnedOid } },
        ...lookupStages,
        projectStage
      ];
      const pinnedResult = await Article.aggregate(pinnedPipeline);
      if (pinnedResult.length) pinnedArticle = pinnedResult[0];
    }

    // ── Resolve seen articles for exclusion ──
    let seenIds = [];
    const resolvedUserId = userId || req.user?._id;
    if (resolvedUserId) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const user = await User.findById(resolvedUserId)
        .select('seenArticles')
        .lean();

      if (user?.seenArticles?.length) {
        seenIds = user.seenArticles
          .filter(s => new Date(s.seenAt) >= thirtyDaysAgo)
          .map(s => s.articleId);
      }
    }

    // Exclude pinned article from regular feed to avoid duplicates
    const excludeIds = [...seenIds];
    if (pinnedOid) excludeIds.push(pinnedOid);

    const pipeline = [];

    // ── Stage 1: $geoNear (must be first) ──
    if (latitude && longitude) {
      const geoQuery = { status: 'published' };
      if (excludeIds.length) geoQuery._id = { $nin: excludeIds };

      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          distanceField: 'distance',
          maxDistance: Number(radiusKM) * 1000,
          spherical: true,
          query: geoQuery
        }
      });
    } else {
      const matchBase = { status: 'published' };
      if (excludeIds.length) matchBase._id = { $nin: excludeIds };
      pipeline.push({ $match: matchBase });
    }

    // ── Stage 2: $match — category filter (only for feed, not pinned) ──
    const filterMatch = {};
    if (category) {
      const catId = toObjectId(category);
      if (catId) {
        filterMatch.$or = [{ category: catId }, { categoryAncestors: catId }];
      }
    }
    if (Object.keys(filterMatch).length) {
      pipeline.push({ $match: filterMatch });
    }

    // ── Stage 3: $sort — newest first, then by trending score ──
    pipeline.push({ $sort: { createdAt: -1, trendingScore: -1 } });

    // ── Pagination — reserve slot for pinned article on page 1 ──
    const feedLimit = pinnedArticle ? pageLimit - 1 : pageLimit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: feedLimit });

    // ── Lookups + Projection ──
    pipeline.push(...lookupStages, projectStage);

    const feedArticles = await Article.aggregate(pipeline);

    // Prepend pinned article on page 1
    const articles = pinnedArticle ? [pinnedArticle, ...feedArticles] : feedArticles;

    // Count total (without skip/limit) for pagination info
    const countPipeline = pipeline.filter(
      s => !s.$skip && !s.$limit && !s.$lookup && !s.$unwind && !s.$project
    );
    countPipeline.push({ $count: 'total' });
    const countResult = await Article.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    res.json({
      articles,
      pagination: {
        page: Number(page),
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
        hasMore: skip + articles.length < total
      },
      meta: {
        lang,
        radiusKM: latitude && longitude ? Number(radiusKM) : null,
        seenExcluded: seenIds.length,
        pinnedArticle: pinnedArticle ? pinnedArticle._id : null
      }
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/articles/feed/seen
// Mark articles as seen by the authenticated user
// Body: { articleIds: ["id1", "id2", ...] }
// ─────────────────────────────────────────────────────────────
router.post('/feed/seen', protect, async (req, res) => {
  try {
    const { articleIds } = req.body;
    if (!articleIds || !Array.isArray(articleIds) || !articleIds.length) {
      return res.status(400).json({ error: 'articleIds array is required' });
    }

    const validIds = articleIds.map(toObjectId).filter(Boolean);
    if (!validIds.length) {
      return res.status(400).json({ error: 'No valid article IDs provided' });
    }

    const now = new Date();
    const seenEntries = validIds.map(id => ({ articleId: id, seenAt: now }));

    // Add to seenArticles, avoid duplicates using $addToSet-like logic
    const user = await User.findById(req.user._id).select('seenArticles');
    const existingIds = new Set((user.seenArticles || []).map(s => s.articleId.toString()));
    const newEntries = seenEntries.filter(e => !existingIds.has(e.articleId.toString()));

    if (newEntries.length) {
      // Rolling window: remove entries older than 30 days, then push new ones
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { seenArticles: { seenAt: { $lt: thirtyDaysAgo } } }
      });
      await User.findByIdAndUpdate(req.user._id, {
        $push: { seenArticles: { $each: newEntries } }
      });
    }

    res.json({ message: 'Articles marked as seen', added: newEntries.length });
  } catch (error) {
    console.error('Mark seen error:', error);
    res.status(500).json({ error: 'Failed to mark articles as seen' });
  }
});

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
    if (city) query['location.city'] = city;
    if (featured === 'true') query.isFeatured = true;
    if (breaking === 'true') query.isBreaking = true;
    if (search) {
      query.$text = { $search: search };
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .populate('category', 'name slug')
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

// @route   GET /api/articles/s/:shortId
// @desc    Get article by shortId or language short link
// @access  Public
router.get('/s/:shortId', optionalAuth, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { lang = defaultLang } = req.query;
    const sid = req.params.shortId;

    let article = await Article.findOne({ shortId: sid })
      .populate('author', 'name avatar')
      .populate('category', 'name slug color')
      .lean();

    if (!article) {
      const activeLangs = await languageCache.getActiveLanguageCodes();
      for (const lc of activeLangs) {
        article = await Article.findOne({ [`shortLinks.${lc}`]: sid })
          .populate('author', 'name avatar')
          .populate('category', 'name slug color')
          .lean();
        if (article) break;
      }
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      article: {
        ...article,
        title: getLocalizedValue(article.title, lang, defaultLang),
        summary: getLocalizedValue(article.summary, lang, defaultLang),
        content: getLocalizedValue(article.content, lang, defaultLang),
        audioUrl: article.audio?.[lang] || article.audio?.en || null,
        category: article.category ? {
          ...article.category,
          name: getLocalizedValue(article.category.name, lang, defaultLang)
        } : null
      }
    });
  } catch (error) {
    console.error('Get article by shortId error:', error);
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
      .lean();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get breadcrumb
    const breadcrumb = article.category?._id
      ? await Category.getBreadcrumb(article.category._id)
      : [];

    // Get related articles
    const relatedQuery = {
      status: 'published',
      _id: { $ne: article._id }
    };

    if (article.category?._id || (article.tags && article.tags.length)) {
      relatedQuery.$or = [
        ...(article.category?._id ? [{ category: article.category._id }] : []),
        ...(article.tags?.length ? [{ tags: { $in: article.tags } }] : [])
      ];
    }

    const relatedArticles = await Article.find(relatedQuery)
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
    // Convert plain objects to Maps for multilingual fields
    const articleData = {
      ...req.body,
      title: new Map(Object.entries(req.body.title || {})),
      summary: new Map(Object.entries(req.body.summary || {})),
      content: new Map(Object.entries(req.body.content || {})),
      author: req.user._id,
      source: req.body.source || 'TaajaNews',
      sourceUrl: req.body.sourceUrl || ''
    };

    // Get category ancestors if category provided
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (category) {
        articleData.categoryAncestors = category.ancestors.map(a => a._id);
      }
    }

    if (articleData.featuredImage?.caption) {
      articleData.featuredImage.caption = new Map(Object.entries(articleData.featuredImage.caption));
    }
    if (req.body.audio) {
      articleData.audio = new Map(Object.entries(req.body.audio));
    }

    const article = await Article.create(articleData);

    // Update category article count
    if (req.body.category) {
      await Category.findByIdAndUpdate(req.body.category, {
        $inc: { articleCount: 1 }
      });
    }

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
    if (updateData.audio) {
      updateData.audio = new Map(Object.entries(updateData.audio));
    }

    if (!updateData.source) {
      updateData.source = 'TaajaNews';
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
// @desc    Update article status (sub-editor, chief-editor, admin)
// @access  Private/Editor+
router.put('/:id/status', protect, editorOrAdmin, async (req, res) => {
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

// @route   GET /api/articles/manage/stats
// @desc    Aggregated stats for the logged-in user's articles
// @access  Private/Reporter
router.get('/manage/stats', protect, reporterOrAdmin, async (req, res) => {
  try {
    const match = {};
    if (req.user.role === 'reporter') {
      match.author = req.user._id;
    }

    const [result] = await Article.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalArticles: { $sum: 1 },
          publishedArticles: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftArticles: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          pendingArticles: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalViews: { $sum: '$engagement.views' },
          totalLikes: { $sum: '$engagement.likes' },
          totalShares: { $sum: '$engagement.shares' }
        }
      }
    ]);

    res.json({
      stats: result || {
        totalArticles: 0,
        publishedArticles: 0,
        draftArticles: 0,
        pendingArticles: 0,
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// @route   GET /api/articles/manage/list
// @desc    Get articles for management (reporter dashboard)
// @access  Private/Reporter
router.get('/manage/list', protect, reporterOrAdmin, async (req, res) => {
  try {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const { page = 1, limit = 20, status, category, fromDate, toDate, lang = defaultLang } = req.query;

    const query = {};
    
    // Reporters can only see their own articles
    if (req.user.role === 'reporter') {
      query.author = req.user._id;
    }
    
    if (status) query.status = status;
    if (category) query.category = category;

    // Date range filter on createdAt
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const articles = await Article.find(query)
      .select('title slug status publishedAt createdAt engagement author category source sourceUrl')
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
