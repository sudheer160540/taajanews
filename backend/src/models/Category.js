const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const languageCache = require('../utils/languageCache');

// Validator for required multilingual fields (checks default language)
const validateDefaultLanguage = async function(map) {
  if (!map || map.size === 0) return false;
  const defaultLang = await languageCache.getDefaultLanguageCode();
  return map.has(defaultLang) && map.get(defaultLang)?.trim().length > 0;
};

const categorySchema = new mongoose.Schema({
  name: {
    type: Map,
    of: String,
    required: [true, 'Name is required'],
    validate: {
      validator: validateDefaultLanguage,
      message: 'Name in default language is required'
    }
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: Map,
    of: String,
    default: new Map()
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  ancestors: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    name: {
      type: Map,
      of: String
    },
    slug: String
  }],
  level: {
    type: Number,
    default: 0
  },
  icon: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: '#1976d2'
  },
  image: {
    type: String,
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  articleCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ 'ancestors._id': 1, level: 1 });
categorySchema.index({ isActive: 1, order: 1 });
categorySchema.index({ isFeatured: 1, isActive: 1 });

// Generate slug before saving - always use English for URL-friendly slugs
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    // Always use English for slug generation since URLs should be ASCII
    const nameInEnglish = this.name?.get('en');
    
    if (nameInEnglish) {
      this.slug = slugify(nameInEnglish);
      
      // Ensure unique slug
      const existingCategory = await this.constructor.findOne({ 
        slug: this.slug, 
        _id: { $ne: this._id } 
      });
      
      if (existingCategory) {
        this.slug = `${this.slug}-${Date.now()}`;
      }
    }
  }
  next();
});

// Build ancestors array before saving
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent);
      if (parentCategory) {
        this.ancestors = [
          ...parentCategory.ancestors,
          {
            _id: parentCategory._id,
            name: parentCategory.name,
            slug: parentCategory.slug
          }
        ];
        this.level = parentCategory.level + 1;
      }
    } else {
      this.ancestors = [];
      this.level = 0;
    }
  }
  next();
});

// Virtual for children categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function(parentId = null) {
  const defaultLang = await languageCache.getDefaultLanguageCode();
  const categories = await this.find({ parent: parentId, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  for (let category of categories) {
    category.children = await this.getCategoryTree(category._id);
  }
  
  return categories;
};

// Static method to get breadcrumb
categorySchema.statics.getBreadcrumb = async function(categoryId) {
  const category = await this.findById(categoryId).lean();
  if (!category) return [];
  
  return [
    ...category.ancestors,
    {
      _id: category._id,
      name: category.name,
      slug: category.slug
    }
  ];
};

// Helper method to get localized value from Map
categorySchema.methods.getLocalizedField = function(field, lang, fallbackLang = 'en') {
  const map = this[field];
  if (!map) return '';
  return map.get(lang) || map.get(fallbackLang) || map.values().next().value || '';
};

// Static helper to transform category for response
categorySchema.statics.toLocalizedJSON = function(category, lang, fallbackLang = 'en') {
  if (!category) return null;
  
  const getMapValue = (map, key, fallback) => {
    if (!map) return '';
    if (map instanceof Map) {
      return map.get(key) || map.get(fallback) || '';
    }
    return map[key] || map[fallback] || '';
  };
  
  return {
    ...category,
    name: getMapValue(category.name, lang, fallbackLang),
    description: getMapValue(category.description, lang, fallbackLang)
  };
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
