const mongoose = require('mongoose');

// Track individual user engagement with articles
const engagementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for anonymous views
    default: null
  },
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  type: {
    type: String,
    enum: ['view', 'like', 'dislike', 'share', 'bookmark'],
    required: true
  },
  sessionId: {
    type: String // For anonymous view tracking
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes for efficient lookups
// For authenticated users - unique per user/article/type
engagementSchema.index(
  { user: 1, article: 1, type: 1 }, 
  { unique: true, partialFilterExpression: { user: { $ne: null } } }
);
// For anonymous users - unique per sessionId/article/type
engagementSchema.index(
  { sessionId: 1, article: 1, type: 1 },
  { unique: true, sparse: true, partialFilterExpression: { user: null, sessionId: { $ne: null } } }
);
engagementSchema.index({ article: 1, type: 1, createdAt: -1 });
engagementSchema.index({ user: 1, type: 1, createdAt: -1 });

// Static method to check if user has engaged
engagementSchema.statics.hasEngaged = async function(userId, articleId, type) {
  const engagement = await this.findOne({ user: userId, article: articleId, type });
  return !!engagement;
};

// Static method to toggle engagement
engagementSchema.statics.toggleEngagement = async function(userId, articleId, type) {
  const existing = await this.findOne({ user: userId, article: articleId, type });
  
  if (existing) {
    await existing.deleteOne();
    return { action: 'removed', type };
  } else {
    await this.create({ user: userId, article: articleId, type });
    return { action: 'added', type };
  }
};

// Static method to get user's engagement on an article
engagementSchema.statics.getUserEngagement = async function(userId, articleId) {
  const engagements = await this.find({ user: userId, article: articleId });
  const result = {
    liked: false,
    disliked: false,
    bookmarked: false,
    shared: false,
    viewed: false
  };
  
  engagements.forEach(e => {
    if (e.type === 'like') result.liked = true;
    if (e.type === 'dislike') result.disliked = true;
    if (e.type === 'bookmark') result.bookmarked = true;
    if (e.type === 'share') result.shared = true;
    if (e.type === 'view') result.viewed = true;
  });
  
  return result;
};

// Static method to track view with rate limiting
engagementSchema.statics.trackView = async function(articleId, { userId, sessionId, ip, userAgent }) {
  // Check if view already recorded in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const query = {
    article: articleId,
    type: 'view',
    createdAt: { $gte: oneDayAgo }
  };
  
  // Prioritize: userId > sessionId > IP for deduplication
  if (userId) {
    query.user = userId;
  } else if (sessionId) {
    query.sessionId = sessionId;
    query.user = null;
  } else if (ip) {
    query.ip = ip;
    query.user = null;
  } else {
    // No identifier available, always count as new view
    await this.create({
      user: null,
      article: articleId,
      type: 'view',
      sessionId: null,
      ip,
      userAgent
    });
    return true;
  }
  
  const existingView = await this.findOne(query);
  
  if (!existingView) {
    await this.create({
      user: userId || null,
      article: articleId,
      type: 'view',
      sessionId: sessionId || null,
      ip,
      userAgent
    });
    return true; // New view recorded
  }
  
  return false; // View already counted
};

const Engagement = mongoose.model('Engagement', engagementSchema);

module.exports = Engagement;
