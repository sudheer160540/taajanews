// filepath: /Users/sudheernunna/taaja_news/backend/src/models/FcmToken.js
const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema(
  {
    fcmToken: {
      type: String,
      required: [true, 'FCM token is required'],
      unique: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: [false, 'userId is required']
    },
    // Optional device location at the time of token registration
    location: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be >= -90'],
        max: [90, 'Latitude must be <= 90'],
        default: null
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be >= -180'],
        max: [180, 'Longitude must be <= 180'],
        default: null
      }
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

// Fast lookup by userId (e.g. "get all tokens for this user")
fcmTokenSchema.index({ userId: 1 });

const FcmToken = mongoose.model('FcmToken', fcmTokenSchema);

module.exports = FcmToken;
