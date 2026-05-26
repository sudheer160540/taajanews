const mongoose = require('mongoose');

const SOURCE_STATUSES = ['New', 'Inprogress', 'Complete', 'Failed'];

const sourceArticleSchema = new mongoose.Schema({
  source: {
    type: String,
    required: [true, 'source is required'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'source is too long']
  },
  sourceId: {
    type: String,
    required: [true, 'sourceId is required'],
    trim: true,
    maxlength: [200, 'sourceId is too long']
  },
  type: {
    type: String,
    trim: true,
    default: 'automate',
    maxlength: [50, 'type is too long']
  },
  url: {
    type: String,
    required: [true, 'url is required'],
    trim: true,
    maxlength: [2048, 'url is too long']
  },
  title: {
    type: String,
    required: [true, 'title is required'],
    trim: true,
    maxlength: [1000, 'title is too long']
  },
  publishedAt: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'publishedAt is too long']
  },
  contentText: {
    type: String,
    default: '',
    maxlength: [500000, 'contentText is too long']
  },
  status: {
    type: String,
    enum: {
      values: SOURCE_STATUSES,
      message: `status must be one of: ${SOURCE_STATUSES.join(', ')}`
    },
    default: 'New'
  },
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null
  },
  processingError: {
    type: String,
    default: null,
    maxlength: [2000, 'processingError is too long']
  }
}, {
  timestamps: true
});

// Unique per external article within a source (e.g. eenadu + 126089639)
sourceArticleSchema.index({ source: 1, sourceId: 1 }, { unique: true });
sourceArticleSchema.index({ status: 1, createdAt: -1 });
sourceArticleSchema.index({ source: 1, status: 1 });

const SourceArticle = mongoose.model('SourceArticle', sourceArticleSchema);

module.exports = SourceArticle;
module.exports.SOURCE_STATUSES = SOURCE_STATUSES;
