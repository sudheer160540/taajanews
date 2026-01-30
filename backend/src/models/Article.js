const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const languageCache = require('../utils/languageCache');

// Helper to create multilingual Map field
const createMultilingualField = (required = false) => ({
  type: Map,
  of: String,
  required: required,
  default: new Map()
});

// Validator for required multilingual fields (checks default language)
const validateDefaultLanguage = async function(map) {
  if (!map || map.size === 0) return false;
  const defaultLang = await languageCache.getDefaultLanguageCode();
  return map.has(defaultLang) && map.get(defaultLang)?.trim().length > 0;
};

const articleSchema = new mongoose.Schema({
  title: {
    type: Map,
    of: String,
    required: [true, 'Title is required'],
    validate: {
      validator: validateDefaultLanguage,
      message: 'Title in default language is required'
    }
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  summary: {
    type: Map,
    of: String,
    required: [true, 'Summary is required'],
    validate: {
      validator: validateDefaultLanguage,
      message: 'Summary in default language is required'
    }
  },
  content: {
    type: Map,
    of: String,
    required: [true, 'Content is required'],
    validate: {
      validator: validateDefaultLanguage,
      message: 'Content in default language is required'
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  categoryAncestors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  featuredImage: {
    url: String,
    caption: {
      type: Map,
      of: String,
      default: new Map()
    },
    alt: String
  },
  images: [{
    url: String,
    caption: {
      type: Map,
      of: String,
      default: new Map()
    },
    alt: String,
    order: Number
  }],
  videos: [{
    url: String,
    thumbnail: String,
    caption: {
      type: Map,
      of: String,
      default: new Map()
    },
    duration: Number
  }],
  // Geospatial location for localized news
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City'
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  // Engagement metrics (using atomic operations)
  engagement: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isBreaking: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  readingTime: {
    type: Number, // in minutes
    default: 1
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
articleSchema.index({ slug: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ categoryAncestors: 1, status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, status: 1 });
articleSchema.index({ city: 1, area: 1, status: 1, publishedAt: -1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 });
articleSchema.index({ isBreaking: 1, status: 1 });
articleSchema.index({ 'engagement.views': -1 });
articleSchema.index({ location: '2dsphere' });

// Generate slug before saving - use English if available, otherwise generate from timestamp
articleSchema.pre('save', async function(next) {
  // Only generate slug if it's a new document or title is modified and slug is not set
  if (this.isNew || (this.isModified('title') && !this.slug)) {
    // Prefer English for slug generation since URLs should be ASCII
    const titleInEnglish = this.title?.get('en');
    
    if (titleInEnglish) {
      this.slug = slugify(titleInEnglish);
    } else {
      // Fallback: generate slug from default language title or use timestamp-based slug
      const defaultLang = await languageCache.getDefaultLanguageCode();
      const titleInDefault = this.title?.get(defaultLang) || this.title?.values().next().value;
      
      if (titleInDefault) {
        // For non-ASCII titles, create a slug using transliteration or timestamp
        // Use first few words + timestamp for uniqueness
        const baseSlug = slugify(titleInDefault) || 'article';
        this.slug = baseSlug !== '' ? `${baseSlug}-${Date.now()}` : `article-${Date.now()}`;
      } else {
        this.slug = `article-${Date.now()}`;
      }
    }
    
    // Ensure unique slug
    const existingArticle = await this.constructor.findOne({ 
      slug: this.slug, 
      _id: { $ne: this._id } 
    });
    
    if (existingArticle) {
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }
  next();
});

// Set publishedAt when status changes to published
articleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Calculate reading time
articleSchema.pre('save', async function(next) {
  if (this.isModified('content')) {
    const defaultLang = await languageCache.getDefaultLanguageCode();
    const contentInDefault = this.content?.get(defaultLang) || this.content?.get('en') || '';
    const wordCount = contentInDefault.split(/\s+/).length;
    this.readingTime = Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute
  }
  next();
});

// Virtual for comments
articleSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'article'
});

// Static method for incrementing views (atomic)
articleSchema.statics.incrementViews = async function(articleId) {
  return this.findByIdAndUpdate(
    articleId,
    { $inc: { 'engagement.views': 1 } },
    { new: true }
  );
};

// Static method for liking (atomic)
articleSchema.statics.toggleLike = async function(articleId, increment = true) {
  return this.findByIdAndUpdate(
    articleId,
    { $inc: { 'engagement.likes': increment ? 1 : -1 } },
    { new: true }
  );
};

// Static method for disliking (atomic)
articleSchema.statics.toggleDislike = async function(articleId, increment = true) {
  return this.findByIdAndUpdate(
    articleId,
    { $inc: { 'engagement.dislikes': increment ? 1 : -1 } },
    { new: true }
  );
};

// Static method for geospatial query
articleSchema.statics.findNearby = async function(coordinates, maxDistanceMeters = 10000, limit = 20) {
  return this.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: coordinates
        },
        distanceField: 'distance',
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: { status: 'published' }
      }
    },
    { $limit: limit },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' }
  ]);
};

// Helper method to get localized value from Map
articleSchema.methods.getLocalizedField = function(field, lang, fallbackLang = 'en') {
  const map = this[field];
  if (!map) return '';
  return map.get(lang) || map.get(fallbackLang) || map.values().next().value || '';
};

// Static helper to transform article for response
articleSchema.statics.toLocalizedJSON = function(article, lang, fallbackLang = 'en') {
  if (!article) return null;
  
  const getMapValue = (map, key, fallback) => {
    if (!map) return '';
    if (map instanceof Map) {
      return map.get(key) || map.get(fallback) || '';
    }
    // Handle plain object (after toJSON)
    return map[key] || map[fallback] || '';
  };
  
  return {
    ...article,
    title: getMapValue(article.title, lang, fallbackLang),
    summary: getMapValue(article.summary, lang, fallbackLang),
    content: getMapValue(article.content, lang, fallbackLang),
    featuredImage: article.featuredImage ? {
      ...article.featuredImage,
      caption: getMapValue(article.featuredImage?.caption, lang, fallbackLang)
    } : null
  };
};

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;
