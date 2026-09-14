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
 * Facebook Page photo only — never user profile /me/feed, never publish_actions.
 * Page token from GET /me/accounts (pages_show_list, pages_read_engagement, pages_manage_posts).
 * Instagram: create container → require id → media_publish (public HTTPS image_url).
 * X media uses upload.twitter.com v1.1 (OAuth 1.0a) then api.x.com/2/tweets.
 */

const crypto = require('crypto');
const axios = require('axios');
const { getFacebookPageAuth, markFacebookStale, isGraph190, graphBase } = require('./facebookToken');

const GRAPH_VERSION = 'v26.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

const instagramGraphBase = (token) => (
  String(token || '').startsWith('IG') ? INSTAGRAM_GRAPH_BASE : GRAPH_BASE
);
const X_TWEET_URL = 'https://api.x.com/2/tweets';
const X_MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const BODY_LANG_ORDER = ['te', 'en', 'hi'];
const X_LIMIT = 280;
const X_URL_WEIGHT = 23;
const INSTAGRAM_CAPTION_LIMIT = 2200;

const env = (key) => String(process.env[key] || '').trim();

/** Telugu summary for social captions; fallback other summary langs, then Telugu title. */
const pickSocialText = (article) => {
  const teSummary = pickFirstNonEmpty(article?.summary, ['te'], 'te');
  if (teSummary) return teSummary;
  const anySummary = pickFirstNonEmpty(article?.summary, BODY_LANG_ORDER, 'te');
  if (anySummary) return anySummary;
  return pickFirstNonEmpty(article?.title, ['te'], 'te');
};

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

const getPlayStoreUrl = () =>
  env('ANDROID_APP_URL') || 'https://play.google.com/store/apps/details?id=com.taajanews.app&hl=en_IN';

const getPlayStoreLabel = () => env('ANDROID_APP_LINK_NAME') || 'Download TAAJA News';

const buildCaption = (headline, url) => {
  const text = String(headline || '').trim();
  const link = `${getPlayStoreLabel()}\n${url || getPlayStoreUrl()}`;
  return text ? `${text}\n\n${link}` : link;
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

const graphError = (err) => {
  const e = err.response?.data?.error;
  if (!e) return err.message || 'Unknown Graph API error';
  const parts = [e.message || 'Graph API error'];
  if (e.error_user_msg) parts.push(e.error_user_msg);
  if (e.code != null) parts.push(`code ${e.code}`);
  if (e.error_subcode != null) parts.push(`subcode ${e.error_subcode}`);
  return parts.join(' — ');
};

const isPublicHttpsUrl = (value) => {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
};

const graphFormPost = (url, fields) =>
  axios.post(url, new URLSearchParams(fields), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000
  });

const resolveFacebookPageAuth = async () => {
  const auth = await getFacebookPageAuth();
  if (auth.skipped) {
    return {
      skipped: auth.skipped,
      error: auth.error || (auth.skipped === 'facebook_reconnect_required'
        ? 'Facebook session expired — reconnect'
        : undefined)
    };
  }
  return auth;
};

const resolveInstagramUserId = async (token) => {
  const configured = env('INSTAGRAM_BUSINESS_ACCOUNT_ID');
  if (configured) return configured;

  const pageId = env('FACEBOOK_PAGE_ID');
  const pageToken = env('FACEBOOK_PAGE_ACCESS_TOKEN');
  if (!pageId || !pageToken) return '';

  const { data } = await axios.get(`${GRAPH_BASE}/${pageId}`, {
    params: { fields: 'instagram_business_account', access_token: pageToken },
    timeout: 15000
  });
  const igId = data?.instagram_business_account?.id || '';
  if (igId) console.log(`[social] instagram resolved ig-user-id from Page ${pageId}`);
  return igId;
};

const waitForIgContainer = async (igBase, containerId, token) => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const { data } = await axios.get(`${igBase}/${containerId}`, {
      params: { fields: 'status_code,status', access_token: token },
      timeout: 15000
    });
    const code = data?.status_code;
    console.log(`[social] instagram container ${containerId} status_code=${code || 'none'}`);
    if (!code || code === 'FINISHED') return data;
    if (code === 'ERROR' || code === 'EXPIRED') {
      const error = new Error(data.status || `Instagram container ${code}`);
      error.response = { data: { error: { message: data.status || `container ${code}` } } };
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return {};
};

const xError = (err) => {
  const data = err.response?.data;
  if (data?.detail) return data.detail;
  if (data?.title) return data.title;
  if (data?.errors?.[0]?.message) return data.errors[0].message;
  return err.message || 'Unknown X API error';
};

const postFacebook = async ({ headline, url, imageUrl }) => {
  const auth = await resolveFacebookPageAuth();
  if (auth.skipped) {
    return { skipped: auth.skipped, error: auth.error };
  }
  if (!imageUrl || !isPublicHttpsUrl(imageUrl)) {
    return { skipped: 'missing_image', error: 'Facebook publish requires a public HTTPS image (Page /photos only)' };
  }

  const caption = buildCaption(headline, url);
  const photoUrl = `${graphBase()}/${auth.pageId}/photos`;
  console.log(`[social] facebook POST ${photoUrl} url=${imageUrl} source=${auth.source || 'unknown'}`);
  try {
    const { data } = await graphFormPost(photoUrl, {
      url: imageUrl,
      caption,
      access_token: auth.token
    });
    console.log('[social] facebook photos response', { id: data.id, post_id: data.post_id });
    return { posted: true, id: data.id || data.post_id };
  } catch (err) {
    if (isGraph190(err)) {
      await markFacebookStale('Facebook session expired — reconnect');
      return { failed: true, error: 'Facebook session expired — reconnect' };
    }
    throw err;
  }
};

const postInstagram = async ({ headline, url, imageUrl }) => {
  const token = env('INSTAGRAM_ACCESS_TOKEN');
  if (!token) {
    return { skipped: 'missing_credentials' };
  }
  if (!imageUrl) {
    return { skipped: 'missing_image' };
  }
  if (!isPublicHttpsUrl(imageUrl)) {
    return { failed: true, error: 'Instagram image_url must be public HTTPS (not localhost)' };
  }

  const igUserId = await resolveInstagramUserId(token);
  if (!igUserId) {
    return { skipped: 'missing_credentials' };
  }

  const caption = truncate(buildCaption(headline, url), INSTAGRAM_CAPTION_LIMIT);
  const igBase = instagramGraphBase(token);
  const createUrl = `${igBase}/${igUserId}/media`;
  console.log(`[social] instagram POST ${createUrl} image_url=${imageUrl}`);

  let container;
  try {
    container = await graphFormPost(createUrl, {
      image_url: imageUrl,
      caption,
      access_token: token
    });
  } catch (err) {
    console.error('[social] instagram container create failed', err.response?.data || err.message);
    throw err;
  }

  const creationId = container.data?.id;
  console.log('[social] instagram container response', container.data);
  if (!creationId) {
    const message = graphError({
      response: { data: container.data }
    }) || 'Instagram container create returned no id';
    return { failed: true, error: message };
  }

  await waitForIgContainer(igBase, creationId, token);

  const publishUrl = `${igBase}/${igUserId}/media_publish`;
  console.log(`[social] instagram POST ${publishUrl} creation_id=${creationId}`);
  const published = await graphFormPost(publishUrl, {
    creation_id: creationId,
    access_token: token
  });
  console.log('[social] instagram publish response', published.data);
  if (!published.data?.id) {
    return { failed: true, error: 'Instagram media_publish returned no media id' };
  }
  return { posted: true, id: published.data.id };
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

  const linkLabel = getPlayStoreLabel();
  const maxHeadline = Math.max(1, X_LIMIT - X_URL_WEIGHT - linkLabel.length - 3);
  const text = `${truncate(headline, maxHeadline)}\n${linkLabel}\n${url}`.trim();

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

  const headline = pickSocialText(article);
  const url = getPlayStoreUrl();
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
