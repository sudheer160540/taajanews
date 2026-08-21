const mongoose = require('mongoose');
const SourceArticle = require('../models/SourceArticle');
const Article = require('../models/Article');
const User = require('../models/User');
const { buildSourceArticleMultilingual } = require('../utils/translateService');
const { calculatePlagiarismMatchPercentage } = require('../utils/plagiarismAnalysis');
const {
  notifySourceArticleProcessedTelegram,
  notifySourceArticleFailedTelegram
} = require('../utils/telegramNotification');
const { ensureArticleIdentity } = require('../utils/articleIdentity');
const { nanoid } = require('nanoid');
const languageCache = require('../utils/languageCache');

// Hint removed — anchor language resolved via TELUGU_SOURCES / ENGLISH_SOURCES / detect
const DEFAULT_FEATURED_IMAGE_URL =
  'https://taajanews.blob.core.windows.net/images/taajanews_defaultposter.png';

const toMap = (obj) => new Map(Object.entries(obj || {}));

const getDefaultFeaturedImageUrl = () =>
  process.env.DEFAULT_FEATURED_IMAGE_URL || DEFAULT_FEATURED_IMAGE_URL;

/**
 * Claim the next SourceArticle with status "New".
 */
async function claimNextSourceArticle() {
  return SourceArticle.findOneAndUpdate(
    { status: 'New' },
    { $set: { status: 'Inprogress', processingError: null } },
    { sort: { createdAt: 1 }, new: true }
  );
}

async function markSourceFailed(sourceDoc, message) {
  const errText = String(message || 'Unknown processing error').slice(0, 2000);
  await SourceArticle.findByIdAndUpdate(sourceDoc._id, {
    $set: { status: 'Failed', processingError: errText }
  });
}

async function markSourceComplete(sourceDoc, articleId) {
  await SourceArticle.findByIdAndUpdate(sourceDoc._id, {
    $set: {
      status: 'Complete',
      articleId,
      processingError: null
    }
  });
}

/**
 * Generate headline (from content), Super Lead (summary), and Detailed Story in te/en/hi.
 * Scraped source title is context only — saved Article.title comes from AI rewrite.
 */
async function buildMultilingualFields(sourceDoc) {
  const { title, summary, content, tags, anchorLang } = await buildSourceArticleMultilingual({
    title: sourceDoc.title,
    contentText: sourceDoc.contentText,
    source: sourceDoc.source
  });

  return {
    title: toMap(title),
    summary: toMap(summary),
    content: toMap(content),
    tags: Array.isArray(tags) ? tags : [],
    anchorLang
  };
}

/**
 * Create a draft Article from a claimed SourceArticle.
 */
const calcReadingTime = async (contentMap) => {
  const defaultLang = await languageCache.getDefaultLanguageCode();
  const text =
    contentMap.get(defaultLang) ||
    contentMap.get('en') ||
    contentMap.get('te') ||
    '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

const buildShortLinks = async (title, content) => {
  const activeLangs = await languageCache.getActiveLanguageCodes();
  const shortLinks = new Map();

  for (const lang of activeLangs) {
    const hasTitle = title.get(lang)?.trim();
    const hasContent = content.get(lang)?.trim();
    if (!hasTitle && !hasContent) continue;

    let link = nanoid(10);
    let dup = await Article.findOne({ [`shortLinks.${lang}`]: link }).select('_id').lean();
    while (dup) {
      link = nanoid(10);
      dup = await Article.findOne({ [`shortLinks.${lang}`]: link }).select('_id').lean();
    }
    shortLinks.set(lang, link);
  }

  return shortLinks;
};

async function createArticleFromSource(sourceDoc, authorId) {
  const { title, summary, content, tags, anchorLang } = await buildMultilingualFields(sourceDoc);

  const rewrittenText =
    content.get(anchorLang) ||
    content.get('en') ||
    content.get('te') ||
    '';
  const plagiarismScore = await calculatePlagiarismMatchPercentage(
    sourceDoc.contentText,
    rewrittenText
  );

  // Dynamic identity: TJ-{nanoid}, shortId, slug from English headline (create only if missing)
  const { articleId, shortId, slug } = await ensureArticleIdentity(title, {});
  const readingTime = await calcReadingTime(content);
  const shortLinks = await buildShortLinks(title, content);

  const articlePayload = {
    title,
    summary,
    content,
    articleId,
    shortId,
    slug,
    author: authorId,
    reporterName: '',
    status: 'draft',
    source: 'Taaja News Network',
    sourceUrl: '',
    referenceSource: sourceDoc.source || '',
    featuredImage: {
      url: getDefaultFeaturedImageUrl(),
      alt: 'default_breaking_news',
      caption: new Map()
    },
    tags: tags || [],
    plagiarismScore,
    isFeatured: false,
    isBreaking: false,
    youtubeUrl: '',
    readingTime,
    shortLinks
  };

  // insertMany keeps pre-built articleId / shortId / slug (save hooks would regenerate slug)
  const [inserted] = await Article.insertMany([articlePayload]);
  let article = await Article.findById(inserted._id);

  // Safety net: backfill identity if anything failed to persist
  if (!article.articleId || !article.shortId || !article.slug) {
    const backfill = await ensureArticleIdentity(title, {
      articleId: article.articleId,
      shortId: article.shortId,
      slug: article.slug
    });
    article = await Article.findByIdAndUpdate(inserted._id, { $set: backfill }, { new: true });
  }

  return article;
}

/**
 * Process up to batchSize SourceArticle rows (status New → draft Article → Complete).
 *
 * @returns {Promise<{ processed: number, succeeded: number, failed: number, errors: Array }>}
 */
async function processNewSourceArticles() {
  const batchSize = Math.max(1, parseInt(process.env.SOURCE_CRON_BATCH_SIZE, 10) || 5);
  const authorId = process.env.AUTOMATION_AUTHOR_ID;

  if (!authorId || !mongoose.Types.ObjectId.isValid(authorId)) {
    throw new Error('AUTOMATION_AUTHOR_ID must be a valid MongoDB ObjectId');
  }

  const author = await User.findById(authorId).select('_id isActive');
  if (!author || !author.isActive) {
    throw new Error('AUTOMATION_AUTHOR_ID user not found or inactive');
  }

  const summary = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  for (let i = 0; i < batchSize; i++) {
    const sourceDoc = await claimNextSourceArticle();
    if (!sourceDoc) break;

    summary.processed++;
    const label = `${sourceDoc.source}/${sourceDoc.sourceId}`;

    try {
      const article = await createArticleFromSource(sourceDoc, author._id);
      await markSourceComplete(sourceDoc, article._id);
      summary.succeeded++;
      console.log(
        `[source-cron] OK ${label} → article ${article._id} ` +
        `articleId=${article.articleId} slug=${article.slug} ` +
        `referenceSource=${article.referenceSource || 'n/a'} plagiarism=${article.plagiarismScore ?? 'n/a'}`
      );
      notifySourceArticleProcessedTelegram(article, sourceDoc).catch((tgErr) => {
        console.error(`[source-cron] Telegram notify failed for ${label}:`, tgErr.message);
      });
    } catch (err) {
      const message =
        err?.message ||
        (err?.errors && Object.values(err.errors).map((e) => e.message).join('; ')) ||
        String(err);
      await markSourceFailed(sourceDoc, message);
      summary.failed++;
      summary.errors.push({ source: label, error: message });
      console.error(`[source-cron] FAIL ${label}:`, message);
      notifySourceArticleFailedTelegram(sourceDoc, message).catch((tgErr) => {
        console.error(`[source-cron] Telegram fail-notify error for ${label}:`, tgErr.message);
      });
    }
  }

  return summary;
}

module.exports = {
  processNewSourceArticles,
  claimNextSourceArticle,
  createArticleFromSource
};
