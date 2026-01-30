const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const languageCache = require('../utils/languageCache');

// Validator for required multilingual fields (checks default language)
const validateDefaultLanguage = async function(map) {
  if (!map || map.size === 0) return false;
  const defaultLang = await languageCache.getDefaultLanguageCode();
  return map.has(defaultLang) && map.get(defaultLang)?.trim().length > 0;
};

const areaSchema = new mongoose.Schema({
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
    lowercase: true
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: [true, 'City is required']
  },
  // GeoJSON for area boundary (optional)
  boundary: {
    type: {
      type: String,
      enum: ['Polygon']
    },
    coordinates: {
      type: [[[Number]]] // Array of linear rings [[[lng, lat], [lng, lat], ...]]
    }
  },
  // Center point for the area
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
  pincode: {
    type: String,
    trim: true
  },
  pincodes: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  // For popular/featured areas
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
areaSchema.index({ slug: 1, city: 1 }, { unique: true });
areaSchema.index({ city: 1, isActive: 1, order: 1 });
areaSchema.index({ pincode: 1 });
areaSchema.index({ pincodes: 1 });
areaSchema.index({ center: '2dsphere' });
// Boundary index is sparse since not all areas have boundary polygons
areaSchema.index({ boundary: '2dsphere' }, { sparse: true });
areaSchema.index({ isFeatured: 1, isActive: 1 });

// Generate slug before saving - always use English for URL-friendly slugs
areaSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    // Always use English for slug generation since URLs should be ASCII
    const nameInEnglish = this.name?.get('en');
    
    if (nameInEnglish) {
      this.slug = slugify(nameInEnglish);
    }
  }
  next();
});

// Static method to get areas by city
areaSchema.statics.getByCity = async function(cityId) {
  return this.find({
    city: cityId,
    isActive: true
  }).sort({ order: 1 });
};

// Static method to find area containing a point
areaSchema.statics.findContainingPoint = async function(coordinates) {
  return this.findOne({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        }
      }
    }
  });
};

// Static method to find areas near coordinates
areaSchema.statics.findNearby = async function(coordinates, maxDistanceMeters = 5000, limit = 10) {
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
  }).limit(limit).populate('city', 'name slug');
};

// Helper method to get localized value from Map
areaSchema.methods.getLocalizedField = function(field, lang, fallbackLang = 'en') {
  const map = this[field];
  if (!map) return '';
  return map.get(lang) || map.get(fallbackLang) || map.values().next().value || '';
};

// Static helper to transform area for response
areaSchema.statics.toLocalizedJSON = function(area, lang, fallbackLang = 'en') {
  if (!area) return null;
  
  const getMapValue = (map, key, fallback) => {
    if (!map) return '';
    if (map instanceof Map) {
      return map.get(key) || map.get(fallback) || '';
    }
    return map[key] || map[fallback] || '';
  };
  
  return {
    ...area,
    name: getMapValue(area.name, lang, fallbackLang)
  };
};

const Area = mongoose.model('Area', areaSchema);

module.exports = Area;
