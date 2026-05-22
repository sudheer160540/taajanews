const { nanoid } = require('nanoid');
const slugify = require('./slugify');
const languageCache = require('./languageCache');
const Article = require('../models/Article');

const generateArticleId = () => `TJ-${nanoid(8)}`;
const generateShortId = () => nanoid(10);

const getMapValue = (mapLike, key) => {
  if (!mapLike) return '';
  if (typeof mapLike.get === 'function') return mapLike.get(key) || '';
  return mapLike[key] || '';
};

/**
 * Build a URL slug from multilingual title (prefers English).
 */
const buildSlugFromTitle = async (titleMap) => {
  const titleInEnglish = getMapValue(titleMap, 'en');

  if (titleInEnglish && titleInEnglish.trim()) {
    return slugify(titleInEnglish.trim());
  }

  const defaultLang = await languageCache.getDefaultLanguageCode();
  const titleInDefault = getMapValue(titleMap, defaultLang);
  if (titleInDefault && titleInDefault.trim()) {
    const baseSlug = slugify(titleInDefault.trim()) || 'article';
    return baseSlug !== '' ? `${baseSlug}-${Date.now()}` : `article-${Date.now()}`;
  }

  return `article-${Date.now()}`;
};

const generateUniqueArticleId = async () => {
  let id = generateArticleId();
  let existing = await Article.findOne({ articleId: id }).select('_id').lean();
  while (existing) {
    id = generateArticleId();
    existing = await Article.findOne({ articleId: id }).select('_id').lean();
  }
  return id;
};

const generateUniqueShortId = async () => {
  let sid = generateShortId();
  let existing = await Article.findOne({ shortId: sid }).select('_id').lean();
  while (existing) {
    sid = generateShortId();
    existing = await Article.findOne({ shortId: sid }).select('_id').lean();
  }
  return sid;
};

const generateUniqueSlug = async (titleMap) => {
  let slug = await buildSlugFromTitle(titleMap);
  if (!slug) slug = `article-${Date.now()}`;

  let existing = await Article.findOne({ slug }).select('_id').lean();
  while (existing) {
    slug = `${slug}-${Date.now()}`;
    existing = await Article.findOne({ slug }).select('_id').lean();
  }
  return slug;
};

/**
 * Generate articleId, shortId, and slug before Article.insert/create.
 */
const buildArticleIdentity = async (titleMap) => {
  const [articleId, shortId, slug] = await Promise.all([
    generateUniqueArticleId(),
    generateUniqueShortId(),
    generateUniqueSlug(titleMap)
  ]);

  return { articleId, shortId, slug };
};

/**
 * Fill in articleId / shortId / slug only when missing (safe for retries).
 */
const ensureArticleIdentity = async (titleMap, existing = {}) => {
  const [articleId, shortId, slug] = await Promise.all([
    existing.articleId ? Promise.resolve(existing.articleId) : generateUniqueArticleId(),
    existing.shortId ? Promise.resolve(existing.shortId) : generateUniqueShortId(),
    existing.slug ? Promise.resolve(existing.slug) : generateUniqueSlug(titleMap)
  ]);

  return { articleId, shortId, slug };
};

module.exports = {
  buildArticleIdentity,
  ensureArticleIdentity,
  buildSlugFromTitle,
  generateUniqueArticleId,
  generateUniqueShortId,
  generateUniqueSlug
};
