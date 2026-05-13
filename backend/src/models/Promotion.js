const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  image: {
    type: String,
    required: [true, 'Image URL is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: null
  },
  type: {
    type: String,
    enum: ['advertisement', 'goodwords'],
    required: [true, 'Type is required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    formattedAddress: String,
    city: String,
    area: String,
    state: String,
    country: String,
    pincode: String,
    placeId: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  link: {
    type: String,
    trim: true,
    default: null
  },
  youtubeUrl: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        if (v == null || v === '') return true;
        // Allow only HTTPS YouTube URLs from known hosts (allow-list)
        // Prevents javascript:, data:, file:, and arbitrary domains
        return /^https:\/\/(www\.youtube\.com\/(watch\?v=|embed\/|shorts\/)[A-Za-z0-9_-]{6,}(\S*)?|youtu\.be\/[A-Za-z0-9_-]{6,}(\S*)?)$/.test(v);
      },
      message: 'youtubeUrl must be a valid HTTPS YouTube URL'
    }
  },
  priority: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

promotionSchema.index({ status: 1, type: 1, priority: -1 });
promotionSchema.index({ status: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ location: '2dsphere' });

const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = Promotion;
