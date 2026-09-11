const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const videoCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

videoCategorySchema.pre('save', function ensureSlug(next) {
  if (this.isModified('name') || !this.slug) {
    const base = slugify(this.name);
    this.slug = base || `video-category-${Date.now()}`;
  }
  next();
});

videoCategorySchema.index({ isActive: 1, order: 1, name: 1 });

const VideoCategory = mongoose.model('VideoCategory', videoCategorySchema);

module.exports = VideoCategory;
