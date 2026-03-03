// filepath: /Users/sudheernunna/taaja_news/backend/src/routes/fcmToken.routes.js
const express = require('express');
const router = express.Router();
const FcmToken = require('../models/FcmToken');
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// ─────────────────────────────────────────────
//  UPSERT FCM TOKEN
// ─────────────────────────────────────────────

// @route   POST /api/fcm-tokens
// @desc    Register or update an FCM token.
//          If the fcmToken already exists → update userId & location.
//          If it is new → create a fresh document.
// @access  Private
router.post(
  '/',
  protect,
  validate(schemas.upsertFcmToken),
  async (req, res) => {
    try {
      const { fcmToken, location } = req.body;
      const userId = req.user._id;

      // Build the fields to set / update
      const updateFields = { userId };

      if (location !== undefined) {
        // Allow caller to explicitly clear location by sending null
        updateFields.location =
          location === null
            ? { latitude: null, longitude: null }
            : { latitude: location.latitude, longitude: location.longitude };
      }

      const doc = await FcmToken.findOneAndUpdate(
        { fcmToken },                          // filter — unique key
        { $set: updateFields },                // update
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const isNew = doc.createdAt.getTime() === doc.updatedAt.getTime();

      return res.status(isNew ? 201 : 200).json({
        message: isNew ? 'FCM token registered' : 'FCM token updated',
        fcmToken: {
          id: doc._id,
          fcmToken: doc.fcmToken,
          userId: doc.userId,
          location: doc.location ?? null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }
      });
    } catch (error) {
      console.error('Upsert FCM token error:', error);
      res.status(500).json({ error: 'Failed to register FCM token' });
    }
  }
);

// ─────────────────────────────────────────────
//  DELETE FCM TOKEN  (logout / uninstall)
// ─────────────────────────────────────────────

// @route   DELETE /api/fcm-tokens/:fcmToken
// @desc    Remove an FCM token (e.g. on logout or app uninstall)
// @access  Private
router.delete('/:fcmToken', protect, async (req, res) => {
  try {
    const doc = await FcmToken.findOneAndDelete({
      fcmToken: req.params.fcmToken,
      userId: req.user._id          // users can only delete their own tokens
    });

    if (!doc) {
      return res.status(404).json({ error: 'FCM token not found' });
    }

    res.json({ message: 'FCM token removed' });
  } catch (error) {
    console.error('Delete FCM token error:', error);
    res.status(500).json({ error: 'Failed to remove FCM token' });
  }
});

module.exports = router;
