const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: [true, 'Article is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'flagged', 'deleted'],
    default: 'approved'
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  moderationReason: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
commentSchema.index({ article: 1, status: 1, createdAt: -1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ user: 1, createdAt: -1 });
commentSchema.index({ status: 1, createdAt: -1 });

// Virtual for replies
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parent'
});

// Update article comment count after save
commentSchema.post('save', async function() {
  if (this.status === 'approved') {
    const Article = mongoose.model('Article');
    await Article.findByIdAndUpdate(this.article, {
      $inc: { 'engagement.commentsCount': 1 }
    });
  }
});

// Static method for toggling like (atomic)
commentSchema.statics.toggleLike = async function(commentId, userId, increment = true) {
  if (increment) {
    return this.findByIdAndUpdate(
      commentId,
      { 
        $inc: { likes: 1 },
        $addToSet: { likedBy: userId }
      },
      { new: true }
    );
  } else {
    return this.findByIdAndUpdate(
      commentId,
      { 
        $inc: { likes: -1 },
        $pull: { likedBy: userId }
      },
      { new: true }
    );
  }
};

// Static method to get threaded comments
commentSchema.statics.getThreadedComments = async function(articleId, limit = 50) {
  // Get top-level comments (approved and pending)
  const topLevelComments = await this.find({
    article: articleId,
    parent: null,
    status: { $in: ['approved', 'pending'] }
  })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Get all replies for these comments
  const commentIds = topLevelComments.map(c => c._id);
  const replies = await this.find({
    parent: { $in: commentIds },
    status: { $in: ['approved', 'pending'] }
  })
    .populate('user', 'name avatar')
    .sort({ createdAt: 1 })
    .lean();

  // Nest replies under their parent comments
  const replyMap = {};
  replies.forEach(reply => {
    const parentId = reply.parent.toString();
    if (!replyMap[parentId]) {
      replyMap[parentId] = [];
    }
    replyMap[parentId].push(reply);
  });

  topLevelComments.forEach(comment => {
    comment.replies = replyMap[comment._id.toString()] || [];
  });

  return topLevelComments;
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
