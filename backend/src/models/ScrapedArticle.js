const mongoose = require('mongoose');

const scrapedArticleSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL is required'],
    unique: true
  },
  title: {
    type: String,
    required: [true, 'Title is required']
  },
  published: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    default: ''
  },
  // Reference to processed Article (if converted)
  articleId: {
    type: String,
    default: null
  },
  // Processing status
  articleStatus: {
    type: String,
    enum: ['draft', 'processing', 'processed', 'completed'],
    default: 'draft'
  },
  // Active/Inactive status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Source website
  source: {
    type: String,
    default: ''
  },
  // Any processing errors
  processingError: {
    type: String,
    default: null
  },
  // Metadata
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes
scrapedArticleSchema.index({ url: 1 });
scrapedArticleSchema.index({ articleStatus: 1 });
scrapedArticleSchema.index({ status: 1 });
scrapedArticleSchema.index({ createdAt: -1 });
scrapedArticleSchema.index({ source: 1, articleStatus: 1 });

// Extract source from URL
scrapedArticleSchema.pre('save', function(next) {
  if (this.url && !this.source) {
    try {
      const urlObj = new URL(this.url);
      this.source = urlObj.hostname;
    } catch (e) {
      this.source = 'unknown';
    }
  }
  next();
});

const ScrapedArticle = mongoose.model('ScrapedArticle', scrapedArticleSchema);

module.exports = ScrapedArticle;
