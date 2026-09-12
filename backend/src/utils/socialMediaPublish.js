/**
 * First-publish social posts (Facebook Page, X, Instagram Business).
 *
 * Env (skip platform if unset — never throws):
 *   FACEBOOK_PAGE_ID
 *   FACEBOOK_PAGE_ACCESS_TOKEN
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID
 *   INSTAGRAM_ACCESS_TOKEN
 *   X_API_KEY
 *   X_API_SECRET
 *   X_ACCESS_TOKEN
 *   X_ACCESS_TOKEN_SECRET
 *   FRONTEND_URL — article link base
 *
 * Instagram needs a public image URL (Business/Creator + Facebook Page).
 * X media uses upload.twitter.com v1.1 (OAuth 1.0a) then api.x.com/2/tweets.
 */

const crypto = require('crypto');
const axios = require('axios');
const languageCache = require('./languageCache');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const X_TWEET_URL = 'https://api.x.com/2/tweets';
const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const BODY_LANG_ORDER = ['te', 'en', 'hi'];
const X_LIMIT = 280;
const X_URL_WEIGHT = 23;
const INSTAGRAM_CAPTION_LIMIT = 2200;

const env = (key) => String(process.env[key] || '').trim();

const pickFirstNonEmpty = (mapLike, langOrder, defaultLang) => {
  if (!mapLike) return '';
  const get = typeof mapLike.get === 'function' ? (k) => mapLike.get(k) : (k) => mapLike[k];
  const seen = new Set();
  for (const code of [...langOrder, defaultLang, 'en']) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const value = get(code);
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
};

const truncate = (s, max) => {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
};

const getFrontendBase = () =>
  (process.env.FRONTEND_URL || 'https://taajanews.com').replace(/\/$/, '');

const buildArticleUrl = (article) => {
  const base = getFrontendBase();
  const slug = article && article.slug ? String(article.slug).trim() : '';
  if (slug) return `${base}/article/${encodeURIComponent(slug)}`;
  if (article && article.shortId) return `${base}/article/${encodeURIComponent(article.shortId)}`;
  return base;
};

const getImageUrl = (article) =>
  article?.featuredImage?.url || article?.featuredImage?.appUrl || '';

const buildCaption = (headline, url) => {
  const title = String(headline || '').trim();
  if (title && url) return `${title}\n\n${url}`;
  return title || url || '';
};

const percentEncode = (value) =>
  encodeURIComponent(String(value))
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

const xOAuthHeader = (method, url, extraParams = {}) => {
  const oauth = {
    oauth_consumer_key: env('X_API_KEY'),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env('X_ACCESS_TOKEN'),
    oauth_version: '1.0'
  };
  const all = { ...oauth, ...extraParams };
  const paramString = Object.keys(all)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(all[key])}`)
    .join('&');
  const baseUrl = url.split('?')[0];
  const base = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString)
  ].join('&');
  const signingKey = `${percentEncode(env('X_API_SECRET'))}&${percentEncode(env('X_ACCESS_TOKEN_SECRET'))}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
    .join(', ')}`;
};

const graphError = (err) =>
  err.response?.data?.error?.message || err.message || 'Unknown Graph API error';

const xError = (err) => {
  const data = err.response?.data;
  if (data?.detail) return data.detail;
  if (data?.title) return data.title;
  if (data?.errors?.[0]?.message) return data.errors[0].message;
  return err.message || 'Unknown X API error';
};

const postFacebook = async ({ headline, url, imageUrl }) => {
  const pageId = env('FACEBOOK_PAGE_ID');
  const token = env('FACEBOOK_PAGE_ACCESS_TOKEN');
  if (!pageId || !token) {
    return { skipped: 'missing_credentials' };
  }

  const caption = buildCaption(headline, url);
  if (imageUrl) {
    const { data } = await axios.post(`${GRAPH_BASE}/${pageId}/photos`, {
      url: imageUrl,
      caption,
      access_token: token
    });
    return { posted: true, id: data.id || data.post_id };
  }

  const { data } = await axios.post(`${GRAPH_BASE}/${pageId}/feed`, {
    message: caption,
    link: url,
    access_token: token
  });
  return { posted: true, id: data.id };
};

const postInstagram = async ({ headline, url, imageUrl }) => {
  const igUserId = env('INSTAGRAM_BUSINESS_ACCOUNT_ID');
  const token = env('INSTAGRAM_ACCESS_TOKEN');
  if (!igUserId || !token) {
    return { skipped: 'missing_credentials' };
  }
  if (!imageUrl) {
    return { skipped: 'missing_image' };
  }

  const caption = truncate(buildCaption(headline, url), INSTAGRAM_CAPTION_LIMIT);
  const container = await axios.post(`${GRAPH_BASE}/${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token
  });
  const creationId = container.data?.id;
  if (!creationId) {
    return { skipped: 'instagram_container_failed' };
  }

  const published = await axios.post(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token
  });
  return { posted: true, id: published.data?.id };
};

const uploadXMedia = async (imageUrl) => {
  const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
  const buffer = Buffer.from(imageRes.data);
  const contentType = imageRes.headers['content-type'] || 'image/jpeg';
  const form = new FormData();
  form.append('media', new Blob([buffer], { type: contentType }), 'featured.jpg');

  const { data } = await axios.post(X_MEDIA_UPLOAD_URL, form, {
    headers: {
      Authorization: xOAuthHeader('POST', X_MEDIA_UPLOAD_URL)
    },
    timeout: 30000
  });
  return data.media_id_string || (data.media_id != null ? String(data.media_id) : '');
};

const postX = async ({ headline, url, imageUrl }) => {
  if (!env('X_API_KEY') || !env('X_API_SECRET') || !env('X_ACCESS_TOKEN') || !env('X_ACCESS_TOKEN_SECRET')) {
    return { skipped: 'missing_credentials' };
  }

  const maxHeadline = Math.max(1, X_LIMIT - X_URL_WEIGHT - 2);
  const text = `${truncate(headline, maxHeadline)}\n${url}`.trim();

  let mediaId = '';
  if (imageUrl) {
    try {
      mediaId = await uploadXMedia(imageUrl);
    } catch (err) {
      console.error('[social] X media upload failed, posting text only:', xError(err));
    }
  }

  const payload = { text };
  if (mediaId) payload.media = { media_ids: [mediaId] };

  const { data } = await axios.post(X_TWEET_URL, payload, {
    headers: {
      Authorization: xOAuthHeader('POST', X_TWEET_URL),
      'Content-Type': 'application/json'
    }
  });
  return { posted: true, id: data.data?.id };
};

const runPlatform = async (name, enabled, fn, payload) => {
  if (!enabled) return { platform: name, skipped: 'not_selected' };
  try {
    const result = await fn(payload);
    return { platform: name, ...result };
  } catch (err) {
    const message = name === 'x' ? xError(err) : graphError(err);
    console.error(`[social] ${name} error:`, message);
    return { platform: name, failed: true, error: message };
  }
};

/**
 * Post to selected platforms. Never throws.
 */
const publishToSocialMedia = async (article, flags = {}) => {
  const facebook = flags.facebook === true;
  const x = flags.x === true;
  const instagram = flags.instagram === true;
  if (!facebook && !x && !instagram) {
    return { skipped: 'none_selected' };
  }

  const defaultLang = await languageCache.getDefaultLanguageCode().catch(() => 'te');
  const headline = pickFirstNonEmpty(article.title, BODY_LANG_ORDER, defaultLang);
  const url = buildArticleUrl(article);
  if (!headline && !url) {
    return { skipped: 'missing_headline' };
  }

  const payload = {
    headline: headline || 'Taaja News',
    url,
    imageUrl: getImageUrl(article)
  };

  const results = await Promise.all([
    runPlatform('facebook', facebook, postFacebook, payload),
    runPlatform('x', x, postX, payload),
    runPlatform('instagram', instagram, postInstagram, payload)
  ]);

  return { results };
};

module.exports = { publishToSocialMedia };
