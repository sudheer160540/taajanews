const mongoose = require('mongoose');

const accountDeletionRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  reason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminNotes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

accountDeletionRequestSchema.index({ email: 1 });
accountDeletionRequestSchema.index({ status: 1, createdAt: -1 });
accountDeletionRequestSchema.index({ user: 1 });

module.exports = mongoose.model('AccountDeletionRequest', accountDeletionRequestSchema);
