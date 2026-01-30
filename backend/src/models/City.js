const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const languageCache = require('../utils/languageCache');

// Validator for required multilingual fields (checks default language)
const validateDefaultLanguage = async function(map) {
  if (!map || map.size === 0) return false;
  const defaultLang = await languageCache.getDefaultLanguageCode();
  return map.has(defaultLang) && map.get(defaultLang)?.trim().length > 0;
};

const citySchema = new mongoose.Schema({
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
  state: {
    type: Map,
    of: String,
    required: [true, 'State is required'],
    validate: {
      validator: validateDefaultLanguage,
      message: 'State in default language is required'
    }
  },
  country: {
    type: String,
    default: 'India'
  },
  // GeoJSON for city boundary (polygon) or center point
  location: {
    type: {
      type: String,
      enum: ['Point', 'Polygon'],
      default: 'Point'
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed, // [lng, lat] for Point, [[[lng, lat]]] for Polygon
      required: true
    }
  },
  // Center point for distance calculations
  center: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  population: {
    type: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  image: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
citySchema.index({ slug: 1 });
citySchema.index({ isActive: 1, order: 1 });
citySchema.index({ isFeatured: 1, isActive: 1 });
citySchema.index({ center: '2dsphere' });
citySchema.index({ location: '2dsphere' });

// Generate slug before saving - always use English for URL-friendly slugs
citySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    // Always use English for slug generation since URLs should be ASCII
    const nameInEnglish = this.name?.get('en');
    const stateInEnglish = this.state?.get('en');
    
    if (nameInEnglish) {
      this.slug = slugify(nameInEnglish);
      
      const existingCity = await this.constructor.findOne({ 
        slug: this.slug, 
        _id: { $ne: this._id } 
      });
      
      if (existingCity && stateInEnglish) {
        this.slug = `${this.slug}-${slugify(stateInEnglish)}`;
      }
    }
  }
  next();
});

// Virtual for areas
citySchema.virtual('areas', {
  ref: 'Area',
  localField: '_id',
  foreignField: 'city'
});

// Static method to find cities near coordinates
citySchema.statics.findNearby = async function(coordinates, maxDistanceMeters = 100000, limit = 10) {
  return this.find({
    isActive: true,
    center: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistanceMeters
      }
    }
  }).limit(limit);
};

// Static method to get cities by state
citySchema.statics.getByState = async function(stateName) {
  // Search in all language values of the state Map
  const cities = await this.find({ isActive: true }).lean();
  
  const filtered = cities.filter(city => {
    if (!city.state) return false;
    const stateMap = city.state instanceof Map ? city.state : new Map(Object.entries(city.state));
    for (const [, value] of stateMap) {
      if (value && new RegExp(stateName, 'i').test(value)) {
        return true;
      }
    }
    return false;
  });
  
  return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
};

// Helper method to get localized value from Map
citySchema.methods.getLocalizedField = function(field, lang, fallbackLang = 'en') {
  const map = this[field];
  if (!map) return '';
  return map.get(lang) || map.get(fallbackLang) || map.values().next().value || '';
};

// Static helper to transform city for response
citySchema.statics.toLocalizedJSON = function(city, lang, fallbackLang = 'en') {
  if (!city) return null;
  
  const getMapValue = (map, key, fallback) => {
    if (!map) return '';
    if (map instanceof Map) {
      return map.get(key) || map.get(fallback) || '';
    }
    return map[key] || map[fallback] || '';
  };
  
  return {
    ...city,
    name: getMapValue(city.name, lang, fallbackLang),
    state: getMapValue(city.state, lang, fallbackLang)
  };
};

const City = mongoose.model('City', citySchema);

module.exports = City;
