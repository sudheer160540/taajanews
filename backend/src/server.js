require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const articleRoutes = require('./routes/article.routes');
const locationRoutes = require('./routes/location.routes');
const uploadRoutes = require('./routes/upload.routes');
const engagementRoutes = require('./routes/engagement.routes');
const languageRoutes = require('./routes/language.routes');
const scrapedArticleRoutes = require('./routes/scrapedArticle.routes');
const translateRoutes = require('./routes/translate.routes');
const promotionRoutes = require('./routes/promotion.routes');
const epaperRoutes = require('./routes/epaper.routes');
const videoRoutes = require('./routes/video.routes');
const fcmTokenRoutes = require('./routes/fcmToken.routes');
const accountDeletionRoutes = require('./routes/accountDeletion.routes');
const sourceArticleRoutes = require('./routes/sourceArticle.routes');
const seoRoutes = require('./routes/seo.routes');

// Import utilities
const languageCache = require('./utils/languageCache');
const { startTrendingCron } = require('./jobs/trendingCron');

const app = express();

// Connect to MongoDB
connectDB();

// CORS must be first — before helmet and everything else
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

// Security middleware — disable headers that conflict with CORS
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (more permissive in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// SEO (sitemap for search engines — submit URL in Google Search Console)
app.use('/', seoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/scraped-articles', scrapedArticleRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/epapers', epaperRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/fcm-tokens', fcmTokenRoutes);
app.use('/api/account-deletion', accountDeletionRoutes);
app.use('/api/source-articles', sourceArticleRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Taaja News Server running on port ${PORT}`);
  console.log(`📰 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize language cache after server starts
  try {
    await languageCache.initializeCache();
  } catch (error) {
    console.warn('Language cache initialization failed, will retry on first request');
  }

  // Start trending score cron (every 15 minutes)
  startTrendingCron();
});

module.exports = app;
