const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const Engagement = require('../models/Engagement');
const Comment = require('../models/Comment');
const { protect, optionalAuth, adminOnly, reporterOrAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// @route   POST /api/engagement/view/:articleId
// @desc    Record article view
// @access  Public
router.post('/view/:articleId', optionalAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { sessionId } = req.body;

    // Get user info
    const userId = req.user?._id;
    const ip = req.ip;
    const userAgent = req.get('user-agent');

    // Track view with rate limiting
    const isNewView = await Engagement.trackView(articleId, {
      userId,
      sessionId,
      ip,
      userAgent
    });

    // If new view, increment article counter (atomic)
    if (isNewView) {
      await Article.incrementViews(articleId);
    }

    const article = await Article.findById(articleId).select('engagement.views');

    res.json({
      recorded: isNewView,
      views: article?.engagement?.views || 0
    });
  } catch (error) {
    console.error('Record view error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// @route   POST /api/engagement/like/:articleId
// @desc    Like/unlike article
// @access  Private
router.post('/like/:articleId', protect, async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user._id;

    // Check if already liked
    const existingLike = await Engagement.findOne({
      user: userId,
      article: articleId,
      type: 'like'
    });

    let action;
    if (existingLike) {
      // Remove like
      await existingLike.deleteOne();
      await Article.toggleLike(articleId, false);
      action = 'unliked';
    } else {
      // Remove dislike if exists, then add like
      const existingDislike = await Engagement.findOne({
        user: userId,
        article: articleId,
        type: 'dislike'
      });
      
      if (existingDislike) {
        await existingDislike.deleteOne();
        await Article.toggleDislike(articleId, false);
      }

      await Engagement.create({
        user: userId,
        article: articleId,
        type: 'like'
      });
      await Article.toggleLike(articleId, true);
      action = 'liked';
    }

    const article = await Article.findById(articleId).select('engagement');

    res.json({
      action,
      likes: article.engagement.likes,
      dislikes: article.engagement.dislikes
    });
  } catch (error) {
    console.error('Like article error:', error);
    res.status(500).json({ error: 'Failed to like article' });
  }
});

// @route   POST /api/engagement/dislike/:articleId
// @desc    Dislike/undislike article
// @access  Private
router.post('/dislike/:articleId', protect, async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user._id;

    const existingDislike = await Engagement.findOne({
      user: userId,
      article: articleId,
      type: 'dislike'
    });

    let action;
    if (existingDislike) {
      await existingDislike.deleteOne();
      await Article.toggleDislike(articleId, false);
      action = 'undisliked';
    } else {
      // Remove like if exists
      const existingLike = await Engagement.findOne({
        user: userId,
        article: articleId,
        type: 'like'
      });
      
      if (existingLike) {
        await existingLike.deleteOne();
        await Article.toggleLike(articleId, false);
      }

      await Engagement.create({
        user: userId,
        article: articleId,
        type: 'dislike'
      });
      await Article.toggleDislike(articleId, true);
      action = 'disliked';
    }

    const article = await Article.findById(articleId).select('engagement');

    res.json({
      action,
      likes: article.engagement.likes,
      dislikes: article.engagement.dislikes
    });
  } catch (error) {
    console.error('Dislike article error:', error);
    res.status(500).json({ error: 'Failed to dislike article' });
  }
});

// @route   POST /api/engagement/share/:articleId
// @desc    Record article share
// @access  Private
router.post('/share/:articleId', protect, async (req, res) => {
  try {
    const { articleId } = req.params;
    const { platform } = req.body;

    await Engagement.create({
      user: req.user._id,
      article: articleId,
      type: 'share'
    });

    await Article.findByIdAndUpdate(articleId, {
      $inc: { 'engagement.shares': 1 }
    });

    res.json({ message: 'Share recorded' });
  } catch (error) {
    // Ignore duplicate share errors
    if (error.code !== 11000) {
      console.error('Record share error:', error);
      return res.status(500).json({ error: 'Failed to record share' });
    }
    res.json({ message: 'Share already recorded' });
  }
});

// @route   POST /api/engagement/bookmark/:articleId
// @desc    Bookmark/unbookmark article
// @access  Private
router.post('/bookmark/:articleId', protect, async (req, res) => {
  try {
    const { articleId } = req.params;
    const result = await Engagement.toggleEngagement(req.user._id, articleId, 'bookmark');
    
    res.json({
      action: result.action === 'added' ? 'bookmarked' : 'unbookmarked'
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ error: 'Failed to bookmark article' });
  }
});

// @route   GET /api/engagement/bookmarks
// @desc    Get user's bookmarked articles
// @access  Private
router.get('/bookmarks', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, lang = 'en' } = req.query;

    const bookmarks = await Engagement.find({
      user: req.user._id,
      type: 'bookmark'
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const articleIds = bookmarks.map(b => b.article);

    const articles = await Article.find({
      _id: { $in: articleIds },
      status: 'published'
    })
      .select('title slug featuredImage publishedAt category')
      .populate('category', 'name slug')
      .lean();

    const transformedArticles = articles.map(article => ({
      ...article,
      title: article.title[lang] || article.title.en
    }));

    const total = await Engagement.countDocuments({
      user: req.user._id,
      type: 'bookmark'
    });

    res.json({
      articles: transformedArticles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// @route   GET /api/engagement/status/:articleId
// @desc    Get user's engagement status for an article
// @access  Private
router.get('/status/:articleId', protect, async (req, res) => {
  try {
    const status = await Engagement.getUserEngagement(
      req.user._id,
      req.params.articleId
    );

    res.json({ status });
  } catch (error) {
    console.error('Get engagement status error:', error);
    res.status(500).json({ error: 'Failed to get engagement status' });
  }
});

// ============ COMMENTS ============

// @route   GET /api/engagement/comments/:articleId
// @desc    Get comments for an article
// @access  Public
router.get('/comments/:articleId', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const comments = await Comment.getThreadedComments(
      req.params.articleId,
      Number(limit)
    );

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// @route   POST /api/engagement/comments/:articleId
// @desc    Add comment to article
// @access  Private
router.post('/comments/:articleId', protect, validate(schemas.createComment), async (req, res) => {
  try {
    const { content, parent } = req.body;

    // If parent specified, verify it exists and belongs to same article
    if (parent) {
      const parentComment = await Comment.findOne({
        _id: parent,
        article: req.params.articleId
      });
      
      if (!parentComment) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const comment = await Comment.create({
      article: req.params.articleId,
      user: req.user._id,
      content,
      parent: parent || null,
      status: 'approved' // Auto-approve comments
    });

    await comment.populate('user', 'name avatar');

    res.status(201).json({
      message: 'Comment submitted for moderation',
      comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// @route   PUT /api/engagement/comments/:commentId
// @desc    Edit comment
// @access  Private
router.put('/comments/:commentId', protect, async (req, res) => {
  try {
    const { content } = req.body;

    const comment = await Comment.findOne({
      _id: req.params.commentId,
      user: req.user._id
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Can only edit within 10 minutes of creation
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (comment.createdAt < tenMinutesAgo) {
      return res.status(400).json({ error: 'Cannot edit comment after 10 minutes' });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    res.json({
      message: 'Comment updated',
      comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// @route   DELETE /api/engagement/comments/:commentId
// @desc    Delete comment
// @access  Private
router.delete('/comments/:commentId', protect, async (req, res) => {
  try {
    const query = { _id: req.params.commentId };
    
    // Regular users can only delete their own comments
    if (req.user.role === 'user') {
      query.user = req.user._id;
    }

    const comment = await Comment.findOne(query);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    comment.status = 'deleted';
    comment.content = '[Deleted]';
    await comment.save();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// @route   POST /api/engagement/comments/:commentId/like
// @desc    Like a comment
// @access  Private
router.post('/comments/:commentId/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const alreadyLiked = comment.likedBy.includes(req.user._id);
    
    const updatedComment = await Comment.toggleLike(
      req.params.commentId,
      req.user._id,
      !alreadyLiked
    );

    res.json({
      action: alreadyLiked ? 'unliked' : 'liked',
      likes: updatedComment.likes
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// @route   PUT /api/engagement/comments/:commentId/moderate
// @desc    Moderate comment (approve/flag)
// @access  Private/Reporter
router.put('/comments/:commentId/moderate', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['approved', 'flagged', 'deleted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const comment = await Comment.findByIdAndUpdate(
      req.params.commentId,
      {
        status,
        moderatedBy: req.user._id,
        moderatedAt: new Date(),
        moderationReason: reason
      },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({
      message: `Comment ${status}`,
      comment
    });
  } catch (error) {
    console.error('Moderate comment error:', error);
    res.status(500).json({ error: 'Failed to moderate comment' });
  }
});

// @route   GET /api/engagement/comments/pending
// @desc    Get pending comments for moderation
// @access  Private/Reporter
router.get('/comments/pending/list', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const comments = await Comment.find({ status: 'pending' })
      .populate('user', 'name avatar')
      .populate('article', 'title slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Comment.countDocuments({ status: 'pending' });

    res.json({
      comments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending comments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending comments' });
  }
});

module.exports = router;
