const express = require('express');
const router = express.Router();
const AccountDeletionRequest = require('../models/AccountDeletionRequest');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/account-deletion — Submit a deletion request (public, email-based)
router.post('/', async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existing = await AccountDeletionRequest.findOne({
      email: email.trim().toLowerCase(),
      status: { $in: ['pending', 'processing'] }
    });

    if (existing) {
      return res.status(409).json({
        error: 'A deletion request for this email is already being processed',
        requestId: existing._id,
        status: existing.status,
        createdAt: existing.createdAt
      });
    }

    const request = await AccountDeletionRequest.create({
      email: email.trim().toLowerCase(),
      reason: reason ? reason.trim().substring(0, 1000) : undefined
    });

    res.status(201).json({
      message: 'Account deletion request submitted successfully. It will be processed within 7 days.',
      requestId: request._id,
      status: request.status
    });
  } catch (error) {
    console.error('Account deletion request error:', error);
    res.status(500).json({ error: 'Failed to submit deletion request' });
  }
});

// GET /api/account-deletion/status/:email — Check request status (public)
router.get('/status/:email', async (req, res) => {
  try {
    const email = req.params.email.trim().toLowerCase();
    const request = await AccountDeletionRequest.findOne({ email })
      .sort({ createdAt: -1 })
      .select('status createdAt processedAt');

    if (!request) {
      return res.status(404).json({ error: 'No deletion request found for this email' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Check deletion status error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// GET /api/account-deletion — Admin: list all requests
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      AccountDeletionRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('user', 'name email avatar')
        .populate('processedBy', 'name email'),
      AccountDeletionRequest.countDocuments(filter)
    ]);

    res.json({
      requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('List deletion requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// PUT /api/account-deletion/:id — Admin: update request status
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ['pending', 'processing', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = {
      status,
      processedBy: req.user._id
    };
    if (adminNotes) update.adminNotes = adminNotes;
    if (status === 'completed' || status === 'rejected') {
      update.processedAt = new Date();
    }

    const request = await AccountDeletionRequest.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Update deletion request error:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

module.exports = router;
