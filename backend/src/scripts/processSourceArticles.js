/**
 * Standalone cron entry: process SourceArticle (New) → draft Article (translated).
 *
 * Usage: npm run process-source-articles
 * Schedule hourly, e.g.:
 *   0 * * * * cd /path/to/taaja_news/backend && npm run process-source-articles
 */

require('dotenv').config();
const mongoose = require('mongoose');
const languageCache = require('../utils/languageCache');
const { processNewSourceArticles } = require('../jobs/sourceArticleProcessor');
const { notifySourceBatchSummaryTelegram } = require('../utils/telegramNotification');

const REQUIRED_ENV = ['MONGODB_URL', 'OPEN_API_KEY', 'AUTOMATION_AUTHOR_ID'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[source-cron] Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main() {
  validateEnv();

  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('[source-cron] MongoDB connected');

    await languageCache.initializeCache();

    const result = await processNewSourceArticles();

    await notifySourceBatchSummaryTelegram(result);

    console.log('[source-cron] Done:', JSON.stringify(result));
    process.exitCode = result.failed > 0 && result.succeeded === 0 ? 1 : 0;
  } catch (error) {
    console.error('[source-cron] Fatal error:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('[source-cron] MongoDB connection closed');
    }
  }
}

main();
