const express = require('express');
const router = express.Router();
const ScrapedArticle = require('../models/ScrapedArticle');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/scraped-articles
// @desc    Create single scraped article
// @access  Private/Admin
router.post('/', async (req, res) => {
  try {
    const { url, title, published, body, articleStatus, status } = req.body;

    if (!url || !title) {
      return res.status(400).json({ error: 'URL and title are required' });
    }

    // Check if URL already exists
    const existing = await ScrapedArticle.findOne({ url });
    if (existing) {
      return res.status(400).json({ error: 'Article with this URL already exists', existingId: existing._id });
    }

    const scrapedArticle = new ScrapedArticle({
      url,
      title,
      published,
      body,
      articleStatus: articleStatus || 'draft',
      status: status || 'active'
    });

    await scrapedArticle.save();

    res.status(201).json({
      message: 'Scraped article created successfully',
      scrapedArticle
    });
  } catch (error) {
    console.error('Create scraped article error:', error);
    res.status(500).json({ error: 'Failed to create scraped article' });
  }
});

// @route   POST /api/scraped-articles/bulk
// @desc    Create multiple scraped articles (bulk insert)
// @access  Private/Admin
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const articles = req.body;

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of articles' });
    }

    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    for (const article of articles) {
      try {
        if (!article.url || !article.title) {
          results.errors.push({ url: article.url, error: 'URL and title are required' });
          continue;
        }

        // Check if URL already exists
        const existing = await ScrapedArticle.findOne({ url: article.url });
        if (existing) {
          results.skipped.push({ url: article.url, reason: 'Already exists', existingId: existing._id });
          continue;
        }

        const scrapedArticle = new ScrapedArticle({
          url: article.url,
          title: article.title,
          published: article.published || '',
          body: article.body || '',
          articleStatus: 'draft',
          status: 'active'
        });

        await scrapedArticle.save();
        results.created.push({ url: article.url, id: scrapedArticle._id });
      } catch (err) {
        results.errors.push({ url: article.url, error: err.message });
      }
    }

    res.status(201).json({
      message: 'Bulk import completed',
      summary: {
        total: articles.length,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('Bulk create scraped articles error:', error);
    res.status(500).json({ error: 'Failed to bulk create scraped articles' });
  }
});

// @route   GET /api/scraped-articles
// @desc    Get all scraped articles with pagination and filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      articleStatus,
      status,
      source,
      search
    } = req.query;

    const query = {};

    if (articleStatus) {
      query.articleStatus = articleStatus;
    }

    if (status) {
      query.status = status;
    }

    if (source) {
      query.source = source;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [articles, total] = await Promise.all([
      ScrapedArticle.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('articleId', 'title slug status'),
      ScrapedArticle.countDocuments(query)
    ]);

    res.json({
      articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get scraped articles error:', error);
    res.status(500).json({ error: 'Failed to fetch scraped articles' });
  }
});

// @route   GET /api/scraped-articles/stats
// @desc    Get statistics of scraped articles
// @access  Private/Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [statusCounts, sourceCounts, total] = await Promise.all([
      ScrapedArticle.aggregate([
        { $group: { _id: '$articleStatus', count: { $sum: 1 } } }
      ]),
      ScrapedArticle.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      ScrapedArticle.countDocuments()
    ]);

    res.json({
      total,
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      topSources: sourceCounts
    });
  } catch (error) {
    console.error('Get scraped articles stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// @route   GET /api/scraped-articles/:id
// @desc    Get single scraped article
// @access  Private/Admin
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const article = await ScrapedArticle.findById(req.params.id)
      .populate('articleId', 'title slug status');

    if (!article) {
      return res.status(404).json({ error: 'Scraped article not found' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Get scraped article error:', error);
    res.status(500).json({ error: 'Failed to fetch scraped article' });
  }
});

// @route   PUT /api/scraped-articles/:id
// @desc    Update scraped article
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { title, published, body, articleStatus, status, articleId, processingError } = req.body;

    const article = await ScrapedArticle.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Scraped article not found' });
    }

    if (title !== undefined) article.title = title;
    if (published !== undefined) article.published = published;
    if (body !== undefined) article.body = body;
    if (articleStatus !== undefined) article.articleStatus = articleStatus;
    if (status !== undefined) article.status = status;
    if (articleId !== undefined) article.articleId = articleId;
    if (processingError !== undefined) article.processingError = processingError;

    await article.save();

    res.json({
      message: 'Scraped article updated successfully',
      article
    });
  } catch (error) {
    console.error('Update scraped article error:', error);
    res.status(500).json({ error: 'Failed to update scraped article' });
  }
});

// @route   PUT /api/scraped-articles/:id/status
// @desc    Update article processing status
// @access  Private/Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { articleStatus, articleId, processingError } = req.body;

    const article = await ScrapedArticle.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Scraped article not found' });
    }

    if (articleStatus) article.articleStatus = articleStatus;
    if (articleId) article.articleId = articleId;
    if (processingError !== undefined) article.processingError = processingError;

    await article.save();

    res.json({
      message: 'Status updated successfully',
      article
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// @route   DELETE /api/scraped-articles/:id
// @desc    Delete scraped article
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const article = await ScrapedArticle.findByIdAndDelete(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Scraped article not found' });
    }

    res.json({ message: 'Scraped article deleted successfully' });
  } catch (error) {
    console.error('Delete scraped article error:', error);
    res.status(500).json({ error: 'Failed to delete scraped article' });
  }
});

// @route   DELETE /api/scraped-articles/bulk/delete
// @desc    Delete multiple scraped articles
// @access  Private/Admin
router.post('/bulk/delete', protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const result = await ScrapedArticle.deleteMany({ _id: { $in: ids } });

    res.json({
      message: 'Articles deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete articles' });
  }
});

module.exports = router;
