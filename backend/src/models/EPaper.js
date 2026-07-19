const mongoose = require('mongoose');

const epaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  pdfUrl: {
    type: String,
    required: [true, 'PDF URL is required'],
    trim: true
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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

epaperSchema.index({ status: 1, date: -1 });
epaperSchema.index({ area: 1, status: 1, date: -1 });

const EPaper = mongoose.model('EPaper', epaperSchema);

module.exports = EPaper;
