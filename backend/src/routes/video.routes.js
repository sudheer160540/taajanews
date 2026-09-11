const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Video = require('../models/Video');
const VideoCategory = require('../models/VideoCategory');
const { protect, authorize } = require('../middleware/auth');
const { deleteBlob } = require('../config/azure');

const manageVideos = authorize('admin', 'chief-editor');

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

const resolveVideoCategoryId = async (videoCategoryInput, { requireActive = false } = {}) => {
  if (videoCategoryInput === null || videoCategoryInput === '') return null;
  if (videoCategoryInput === undefined) return undefined;

  if (!mongoose.Types.ObjectId.isValid(videoCategoryInput)) {
    return { error: 'Invalid video category id' };
  }

  const category = await VideoCategory.findById(videoCategoryInput).select('_id isActive').lean();
  if (!category) {
    return { error: 'Video category not found' };
  }
  if (requireActive && !category.isActive) {
    return { error: 'Video category is not active' };
  }

  return category._id;
};

const buildVideoCategoryFilter = async (videoCategoryParam) => {
  if (!videoCategoryParam) return {};

  if (mongoose.Types.ObjectId.isValid(videoCategoryParam)) {
    return { videoCategory: videoCategoryParam };
  }

  const category = await VideoCategory.findOne({
    slug: String(videoCategoryParam).trim().toLowerCase(),
    isActive: true
  }).select('_id').lean();

  if (!category) {
    return { videoCategory: null, notFound: true };
  }

  return { videoCategory: category._id };
};

const PUBLIC_VIDEO_SELECT = 'title description videoUrl thumbnail videoCategory createdBy createdAt';

const mapPublicVideo = (video) => ({
  _id: video._id,
  title: video.title,
  description: video.description,
  videoUrl: video.videoUrl,
  thumbnail: video.thumbnail,
  videoCategory: video.videoCategory
    ? {
      _id: video.videoCategory._id,
      name: video.videoCategory.name,
      slug: video.videoCategory.slug
    }
    : null,
  createdBy: video.createdBy
    ? {
      _id: video.createdBy._id,
      name: video.createdBy.name,
      avatar: video.createdBy.avatar || null
    }
    : null,
  createdAt: video.createdAt
});

const fetchPublishedVideos = (query, { skip = 0, limit = 20 } = {}) =>
  Video.find({ status: 'published', ...query })
    .select(PUBLIC_VIDEO_SELECT)
    .populate('videoCategory', 'name slug')
    .populate('createdBy', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

// @route   GET /api/videos/public/grouped
// @desc    Published videos grouped by active category (mobile home sections)
// @access  Public
router.get('/public/grouped', async (req, res) => {
  try {
    const videosPerGroup = Math.min(
      50,
      Math.max(1, parseInt(req.query.videosPerGroup, 10) || parseInt(req.query.limit, 10) || 10)
    );
    const includeEmpty = req.query.includeEmpty === 'true';
    const includeUncategorized = req.query.includeUncategorized !== 'false';

    const categories = await VideoCategory.find({ isActive: true })
      .select('name slug description order')
      .sort({ order: 1, name: 1 })
      .lean();

    const groups = await Promise.all(
      categories.map(async (category) => {
        const query = { videoCategory: category._id };
        const [videos, totalVideos] = await Promise.all([
          fetchPublishedVideos(query, { limit: videosPerGroup }),
          Video.countDocuments({ status: 'published', ...query })
        ]);

        return {
          category: {
            _id: category._id,
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            order: category.order ?? 0
          },
          videos: videos.map(mapPublicVideo),
          totalVideos,
          hasMore: totalVideos > videos.length
        };
      })
    );

    let filteredGroups = includeEmpty
      ? groups
      : groups.filter((group) => group.totalVideos > 0);

    if (includeUncategorized) {
      const uncategorizedQuery = {
        $or: [{ videoCategory: null }, { videoCategory: { $exists: false } }]
      };
      const [videos, totalVideos] = await Promise.all([
        fetchPublishedVideos(uncategorizedQuery, { limit: videosPerGroup }),
        Video.countDocuments({ status: 'published', ...uncategorizedQuery })
      ]);

      if (includeEmpty || totalVideos > 0) {
        filteredGroups = [
          ...filteredGroups,
          {
            category: {
              _id: null,
              name: 'General',
              slug: 'general',
              description: 'Videos without a category',
              order: 9999
            },
            videos: videos.map(mapPublicVideo),
            totalVideos,
            hasMore: totalVideos > videos.length
          }
        ];
      }
    }

    const totalVideos = filteredGroups.reduce((sum, group) => sum + group.totalVideos, 0);

    res.json({
      groups: filteredGroups,
      summary: {
        totalGroups: filteredGroups.length,
        totalVideos,
        videosPerGroup
      }
    });
  } catch (error) {
    console.error('Get grouped public videos error:', error);
    res.status(500).json({ error: 'Failed to fetch grouped videos' });
  }
});

// @route   GET /api/videos/public/group/:category
// @desc    Paginated published videos for one category group (mobile "See all")
// @access  Public
router.get('/public/group/:category', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const categoryParam = req.params.category;

    if (categoryParam === 'general') {
      const uncategorizedQuery = {
        $or: [{ videoCategory: null }, { videoCategory: { $exists: false } }]
      };
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const perPage = parseInt(limit, 10);

      const [videos, total] = await Promise.all([
        fetchPublishedVideos(uncategorizedQuery, { skip, limit: perPage }),
        Video.countDocuments({ status: 'published', ...uncategorizedQuery })
      ]);

      const currentPage = parseInt(page, 10);
      const totalPages = Math.ceil(total / perPage);

      return res.json({
        category: {
          _id: null,
          name: 'General',
          slug: 'general',
          description: 'Videos without a category',
          order: 9999
        },
        videos: videos.map(mapPublicVideo),
        pagination: {
          total,
          page: currentPage,
          pages: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1
        }
      });
    }

    const categoryFilter = await buildVideoCategoryFilter(categoryParam);
    if (categoryFilter.notFound) {
      return res.status(404).json({ error: 'Video category not found' });
    }

    const category = await VideoCategory.findOne({
      _id: categoryFilter.videoCategory,
      isActive: true
    })
      .select('name slug description order')
      .lean();

    if (!category) {
      return res.status(404).json({ error: 'Video category not found' });
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const perPage = parseInt(limit, 10);
    const query = { videoCategory: category._id };

    const [videos, total] = await Promise.all([
      fetchPublishedVideos(query, { skip, limit: perPage }),
      Video.countDocuments({ status: 'published', ...query })
    ]);

    const currentPage = parseInt(page, 10);
    const totalPages = Math.ceil(total / perPage);

    res.json({
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        order: category.order ?? 0
      },
      videos: videos.map(mapPublicVideo),
      pagination: {
        total,
        page: currentPage,
        pages: totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    console.error('Get public video group error:', error);
    res.status(500).json({ error: 'Failed to fetch video group' });
  }
});

// @route   GET /api/videos
// @desc    Get all videos (admin list)
// @access  Private/Admin
router.get('/', protect, manageVideos, async (req, res) => {
  try {
    const { status, videoCategory, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (videoCategory) {
      if (!mongoose.Types.ObjectId.isValid(videoCategory)) {
        return res.status(400).json({ error: 'Invalid video category id' });
      }
      query.videoCategory = videoCategory;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [videos, total] = await Promise.all([
      Video.find(query)
        .populate('createdBy', 'name email')
        .populate('videoCategory', 'name slug isActive')
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
    const { page = 1, limit = 20, videoCategory, category } = req.query;
    const categoryParam = videoCategory || category;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const perPage = parseInt(limit, 10);

    const query = { status: 'published' };
    if (categoryParam) {
      const categoryFilter = await buildVideoCategoryFilter(categoryParam);
      if (categoryFilter.notFound) {
        return res.json({
          videos: [],
          pagination: {
            total: 0,
            page: parseInt(page, 10),
            pages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }
      Object.assign(query, categoryFilter);
    }

    const [videos, total] = await Promise.all([
      Video.find(query)
        .select('title description videoUrl thumbnail videoCategory createdBy createdAt')
        .populate('videoCategory', 'name slug')
        .populate('createdBy', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Video.countDocuments(query)
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
      .select('title description videoUrl thumbnail videoCategory createdBy createdAt')
      .populate('videoCategory', 'name slug')
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
router.get('/:id', protect, manageVideos, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('videoCategory', 'name slug isActive')
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
router.post('/', protect, manageVideos, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnail, status, videoCategory } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Title and video file are required' });
    }

    const resolvedCategory = await resolveVideoCategoryId(videoCategory, { requireActive: true });
    if (resolvedCategory && resolvedCategory.error) {
      return res.status(400).json({ error: resolvedCategory.error });
    }

    const video = await Video.create({
      title,
      description: description || '',
      videoUrl,
      thumbnail: thumbnail || null,
      videoCategory: resolvedCategory ?? null,
      status: status || 'draft',
      createdBy: req.user._id
    });

    await video.populate('videoCategory', 'name slug isActive');

    res.status(201).json({ message: 'Video created', video });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// @route   PUT /api/videos/:id
// @desc    Update video
// @access  Private/Admin
router.put('/:id', protect, manageVideos, async (req, res) => {
  try {
    const existingVideo = await Video.findById(req.params.id).lean();
    if (!existingVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const allowedUpdates = ['title', 'description', 'videoUrl', 'thumbnail', 'status', 'videoCategory'];
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if ('videoCategory' in updates) {
      const resolvedCategory = await resolveVideoCategoryId(updates.videoCategory, { requireActive: true });
      if (resolvedCategory && resolvedCategory.error) {
        return res.status(400).json({ error: resolvedCategory.error });
      }
      updates.videoCategory = resolvedCategory ?? null;
    }

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
    ).populate('videoCategory', 'name slug isActive');

    res.json({ message: 'Video updated', video });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// @route   DELETE /api/videos/:id
// @desc    Delete video and clean up Azure blobs
// @access  Private/Admin
router.delete('/:id', protect, manageVideos, async (req, res) => {
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
