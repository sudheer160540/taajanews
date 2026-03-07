const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const { protect, adminOnly } = require('../middleware/auth');
const { deleteBlob } = require('../config/azure');

const extractBlobName = (blobUrl) => {
  if (!blobUrl) return null;
  try {
    const url = new URL(blobUrl);
    const parts = url.pathname.split('/');
    return parts.slice(2).join('/');
  } catch {
    return null;
  }
};

// @route   GET /api/videos
// @desc    Get all videos (admin list)
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [videos, total] = await Promise.all([
      Video.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Video.countDocuments(query)
    ]);

    res.json({
      videos,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// @route   GET /api/videos/public
// @desc    Get published videos (public feed for mobile app)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const perPage = parseInt(limit, 10);

    const [videos, total] = await Promise.all([
      Video.find({ status: 'published' })
        .select('title description videoUrl thumbnail createdBy createdAt')
        .populate('createdBy', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Video.countDocuments({ status: 'published' })
    ]);

    const currentPage = parseInt(page, 10);
    const totalPages = Math.ceil(total / perPage);

    res.json({
      videos,
      pagination: {
        total,
        page: currentPage,
        pages: totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    console.error('Get public videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// @route   GET /api/videos/public/:id
// @desc    Get single published video (for mobile app)
// @access  Public
router.get('/public/:id', async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.id, status: 'published' })
      .select('title description videoUrl thumbnail createdBy createdAt')
      .populate('createdBy', 'name avatar')
      .lean();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Get public video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// @route   GET /api/videos/:id
// @desc    Get single video
// @access  Private/Admin
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// @route   POST /api/videos
// @desc    Create video
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnail, status } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Title and video file are required' });
    }

    const video = await Video.create({
      title,
      description: description || '',
      videoUrl,
      thumbnail: thumbnail || null,
      status: status || 'draft',
      createdBy: req.user._id
    });

    res.status(201).json({ message: 'Video created', video });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// @route   PUT /api/videos/:id
// @desc    Update video
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const existingVideo = await Video.findById(req.params.id).lean();
    if (!existingVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const allowedUpdates = ['title', 'description', 'videoUrl', 'thumbnail', 'status'];
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Clean up old Azure blobs when video/thumbnail is replaced
    for (const field of ['videoUrl', 'thumbnail']) {
      if (field in updates && existingVideo[field] && existingVideo[field] !== updates[field]) {
        const oldBlobName = extractBlobName(existingVideo[field]);
        if (oldBlobName) deleteBlob(oldBlobName);
      }
    }

    const video = await Video.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Video updated', video });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// @route   DELETE /api/videos/:id
// @desc    Delete video and clean up Azure blobs
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete blobs from Azure
    const videoBlobName = extractBlobName(video.videoUrl);
    if (videoBlobName) deleteBlob(videoBlobName);

    const thumbBlobName = extractBlobName(video.thumbnail);
    if (thumbBlobName) deleteBlob(thumbBlobName);

    await Video.findByIdAndDelete(req.params.id);

    res.json({ message: 'Video deleted' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
