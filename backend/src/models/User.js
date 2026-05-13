const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Base User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  googleId: {
    type: String,
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: ['user', 'reporter', 'sub-editor', 'chief-editor', 'admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  // Profile photo with metadata (size, dimensions) for consistent profile pictures
  // across the app. The `avatar` field above remains for backward compatibility
  // and is kept in sync with `profilePhoto.url` on update.
  profilePhoto: {
    url: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2048, 'Profile photo URL is too long']
    },
    width: {
      type: Number,
      default: null,
      min: [16, 'Profile photo width is too small'],
      max: [4096, 'Profile photo width is too large']
    },
    height: {
      type: Number,
      default: null,
      min: [16, 'Profile photo height is too small'],
      max: [4096, 'Profile photo height is too large']
    },
    size: {
      type: Number,
      default: null,
      min: [0, 'Profile photo size cannot be negative'],
      max: [5 * 1024 * 1024, 'Profile photo size cannot exceed 5MB']
    },
    contentType: {
      type: String,
      default: null,
      enum: ['image/jpeg', 'image/png', 'image/webp', null]
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferences: {
    language: {
      type: String,
      default: 'en' // Validated dynamically against active languages
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      default: null
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Area',
      default: null
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }]
  },
  // Reporter-specific fields (using discriminator pattern inline)
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  assignedCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  articlesCount: {
    type: Number,
    default: 0
  },
  seenArticles: [{
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    seenAt: { type: Date, default: Date.now }
  }],
  lastLogin: {
    type: Date
  },
  refreshToken: {
    type: String,
    select: false
  },

  // Yellow Page fields
  isEnableYelloPage: {
    type: Boolean,
    default: false
  },
  workingProfessional: {
    type: String,
    trim: true,
    maxlength: [200, 'Working professional cannot exceed 200 characters'],
    default: null
  },
  // Location is fully optional — NO defaults on any subfield.
  // Mongoose must never auto-create a partial { coordinates:[0,0] } or { type:"Point" }
  // because both cause the 2dsphere index to throw "unknown GeoJSON type".
  // The sparse index means documents without location are simply not indexed.
  location: {
    type: {
      type: String,
      enum: ['Point']
      // no default
    },
    coordinates: {
      type: [Number]
      // no default
    },
    formattedAddress: {
      type: String
      // no default — prevents Mongoose auto-creating { formattedAddress: null }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'preferences.city': 1, 'preferences.area': 1 });
userSchema.index({ isEnableYelloPage: 1 });
userSchema.index({ location: '2dsphere' }, { sparse: true });

// Sanitize location before saving — if only formattedAddress is set (no coordinates),
// fill in valid GeoJSON defaults so the 2dsphere index never throws
userSchema.pre('save', function(next) {
  if (this.location) {
    const hasCoords = Array.isArray(this.location.coordinates) && this.location.coordinates.length === 2;
    const hasType = this.location.type === 'Point';

    if (!hasCoords || !hasType) {
      this.location = {
        type: 'Point',
        coordinates: [0, 0],
        ...(this.location.formattedAddress && { formattedAddress: this.location.formattedAddress })
      };
    }
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone || null,
    authProvider: this.authProvider || 'local',
    role: this.role,
    avatar: this.avatar,
    profilePhoto: this.profilePhoto && this.profilePhoto.url
      ? {
          url: this.profilePhoto.url,
          width: this.profilePhoto.width || null,
          height: this.profilePhoto.height || null,
          size: this.profilePhoto.size || null,
          contentType: this.profilePhoto.contentType || null,
          updatedAt: this.profilePhoto.updatedAt || null
        }
      : null,
    bio: this.bio || null,
    preferences: this.preferences,
    isEnableYelloPage: this.isEnableYelloPage,
    workingProfessional: this.workingProfessional || null,
    location: this.location || null,
    createdAt: this.createdAt
  };
};

// Virtual for articles (for reporters)
userSchema.virtual('articles', {
  ref: 'Article',
  localField: '_id',
  foreignField: 'author'
});

const User = mongoose.model('User', userSchema);

module.exports = User;
