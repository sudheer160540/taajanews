const Article = require('../models/Article');

/**
 * Recalculate trendingScore for all published articles.
 * Formula: Score = (views + likes * 2) / (hoursSinceCreation + 1) ^ 1.8
 * Run every 15 minutes via setInterval in server.js
 */
async function recalculateTrendingScores() {
  try {
    const now = new Date();

    await Article.updateMany(
      { status: 'published' },
      [
        {
          $set: {
            trendingScore: {
              $divide: [
                {
                  $add: [
                    { $ifNull: ['$engagement.views', 0] },
                    { $multiply: [{ $ifNull: ['$engagement.likes', 0] }, 2] }
                  ]
                },
                {
                  $pow: [
                    {
                      $add: [
                        {
                          $divide: [
                            { $subtract: [now, { $ifNull: ['$publishedAt', '$createdAt'] }] },
                            3600000 // ms -> hours
                          ]
                        },
                        1
                      ]
                    },
                    1.8
                  ]
                }
              ]
            }
          }
        }
      ]
    );

    console.log(`[Cron] Trending scores updated at ${now.toISOString()}`);
  } catch (error) {
    console.error('[Cron] Failed to update trending scores:', error.message);
  }
}

function startTrendingCron(intervalMs = 15 * 60 * 1000) {
  recalculateTrendingScores();
  setInterval(recalculateTrendingScores, intervalMs);
  console.log(`[Cron] Trending score job scheduled every ${intervalMs / 60000} minutes`);
}

module.exports = { startTrendingCron, recalculateTrendingScores };
