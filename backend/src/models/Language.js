const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Language code is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format (e.g., en, hi, en-US)']
  },
  name: {
    type: String,
    required: [true, 'Language name is required'],
    trim: true,
    maxlength: [50, 'Language name cannot exceed 50 characters']
  },
  nativeName: {
    type: String,
    required: [true, 'Native name is required'],
    trim: true,
    maxlength: [50, 'Native name cannot exceed 50 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isRTL: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
languageSchema.index({ isActive: 1, order: 1 });
languageSchema.index({ isDefault: 1 });

// Ensure only one default language
languageSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default from other languages
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

// Static method to get default language
languageSchema.statics.getDefault = async function() {
  const defaultLang = await this.findOne({ isDefault: true, isActive: true });
  if (defaultLang) return defaultLang;
  
  // Fallback to first active language or 'en'
  const firstActive = await this.findOne({ isActive: true }).sort({ order: 1 });
  return firstActive || { code: 'en', name: 'English', nativeName: 'English' };
};

// Static method to get all active languages
languageSchema.statics.getActive = async function() {
  return this.find({ isActive: true }).sort({ order: 1 });
};

// Static method to get language codes
languageSchema.statics.getActiveCodes = async function() {
  const languages = await this.find({ isActive: true }).select('code');
  return languages.map(l => l.code);
};

// Static method to check if code exists
languageSchema.statics.isValidCode = async function(code) {
  const language = await this.findOne({ code, isActive: true });
  return !!language;
};

const Language = mongoose.model('Language', languageSchema);

module.exports = Language;
