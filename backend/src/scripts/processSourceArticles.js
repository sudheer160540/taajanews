/**
 * Standalone cron entry: process SourceArticle (New) → draft Article (translated).
 *
 * Usage: npm run process-source-articles
 * Schedule hourly, e.g.:
 *   0 * * * * cd /path/to/taaja_news/backend && npm run process-source-articles
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const languageCache = require('../utils/languageCache');
const { processNewSourceArticles } = require('../jobs/sourceArticleProcessor');
const { notifySourceBatchSummaryTelegram } = require('../utils/telegramNotification');

function requiredEnvKeys() {
  const provider = (process.env.TRANSLATE_TYPE || 'openai').trim().toLowerCase();
  const base = ['MONGODB_URL', 'AUTOMATION_AUTHOR_ID'];
  if (provider === 'gemini') return [...base, 'GEMINI_API_KEY'];
  if (provider === 'anthropic') return [...base, 'ANTHROPIC_API_KEY'];
  // openai, sarvam (rewrite still uses OpenAI), or unset
  return [...base, 'OPEN_API_KEY'];
}

function validateEnv() {
  const missing = requiredEnvKeys().filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[source-cron] Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main() {
  validateEnv();
  const provider = (process.env.TRANSLATE_TYPE || 'openai').trim().toLowerCase() || 'openai';
  console.log(`[source-cron] AI provider: ${provider}`);

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
