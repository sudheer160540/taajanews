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
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: ['user', 'reporter', 'admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
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
  lastLogin: {
    type: Date
  },
  refreshToken: {
    type: String,
    select: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'preferences.city': 1, 'preferences.area': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
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
    role: this.role,
    avatar: this.avatar,
    preferences: this.preferences,
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
