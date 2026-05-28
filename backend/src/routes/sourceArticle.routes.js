const express = require('express');
const Joi = require('joi');
const router = express.Router();
const SourceArticle = require('../models/SourceArticle');
const { validate } = require('../middleware/validate');

const sourceArticleItemSchema = Joi.object({
  source: Joi.string().trim().lowercase().min(1).max(100).required(),
  sourceId: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().trim().max(50).default('automate'),
  url: Joi.string().uri().max(2048).required(),
  title: Joi.string().trim().min(1).max(1000).required(),
  publishedAt: Joi.string().trim().max(500).allow('', null).default(''),
  contentText: Joi.string().max(500000).allow('', null).default(''),
  status: Joi.string().valid('New', 'Inprogress', 'Complete', 'Failed')
});

const ingestSourceArticlesSchema = Joi.alternatives().try(
  Joi.array().items(sourceArticleItemSchema).min(1).max(500),
  Joi.object({
    items: Joi.array().items(sourceArticleItemSchema).min(1).max(500).required()
  }),
  Joi.object({
    articles: Joi.array().items(sourceArticleItemSchema).min(1).max(500).required()
  }),
  sourceArticleItemSchema
);

const normalizeItems = (body) => {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  if (body && Array.isArray(body.articles)) return body.articles;
  if (body && typeof body === 'object' && (body.source || body.sourceId || body.url)) return [body];
  return null;
};

const toUpsertOp = (item) => {
  const source = item.source.trim().toLowerCase();
  const sourceId = String(item.sourceId).trim();

  const setFields = {
    source,
    sourceId,
    type: item.type || 'automate',
    url: item.url.trim(),
    title: item.title.trim(),
    publishedAt: item.publishedAt || '',
    contentText: item.contentText || ''
  };

  if (item.status) {
    setFields.status = item.status;
  }

  const updateDoc = { $set: setFields };
  // Default status only on first insert; re-ingest keeps workflow status.
  if (!item.status) {
    updateDoc.$setOnInsert = { status: 'New' };
  }

  return {
    updateOne: {
      filter: { source, sourceId },
      update: updateDoc,
      upsert: true
    }
  };
};

// @route   POST /api/source-articles
// @desc    Ingest articles from external sources. Body may be:
//          - [ { source, sourceId, url, title, ... }, ... ]
//          - { items: [ ... ] } or { articles: [ ... ] }  (same as GET list shape)
//          - { source, sourceId, url, title, ... }  (single article)
//          Upserts on unique (source, sourceId). Default status is "New".
// @access  Public (automation / scraper)
router.post('/', async (req, res) => {
  try {
    const items = normalizeItems(req.body);
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of articles' });
    }

    const operations = items.map(toUpsertOp);
    const result = await SourceArticle.bulkWrite(operations, { ordered: false });

    const upserted = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    const matched = result.matchedCount || 0;

    res.status(201).json({
      message: 'Source articles ingested',
      summary: {
        total: items.length,
        created: upserted,
        updated: modified,
        matched
      }
    });
  } catch (error) {
    console.error('Ingest source articles error:', error);

    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Duplicate source and sourceId combination' });
    }

    res.status(500).json({ error: 'Failed to ingest source articles' });
  }
});

// @route   GET /api/source-articles
// @desc    List ingested source articles (filter by source, status)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      source,
      status,
      type
    } = req.query;

    const query = {};
    if (source) query.source = String(source).trim().toLowerCase();
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);

    const [articles, total] = await Promise.all([
      SourceArticle.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SourceArticle.countDocuments(query)
    ]);

    res.json({
      articles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('List source articles error:', error);
    res.status(500).json({ error: 'Failed to fetch source articles' });
  }
});

module.exports = router;
