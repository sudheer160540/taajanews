/**
 * Push notification service (FCM).
 *
 * Responsibilities:
 *   - Pull FCM tokens from the FcmToken collection.
 *   - Build a notification + data payload from an Article document.
 *   - Send via firebase-admin's `sendEachForMulticast` in 500-token chunks
 *     (FCM hard limit per request).
 *   - Garbage-collect tokens that come back as permanently invalid
 *     (NOT_FOUND / unregistered / invalid-argument).
 *
 * Failure mode:
 *   This module NEVER throws to the caller. All operations are best-effort
 *   and errors are logged. Callers (route handlers) should fire-and-forget
 *   so that a push-notification outage does not break the article publish
 *   flow.
 */

const FcmToken = require('../models/FcmToken');
const { getMessaging, isConfigured } = require('../config/firebase');
const languageCache = require('./languageCache');

const FCM_MULTICAST_LIMIT = 500;
const NOTIFICATION_BODY_LIMIT = 240;

// Fixed brand heading shown on every push. Body carries the article headline.
const NOTIFICATION_BRAND_TITLE = 'Taaja News';
// Preferred language order for the notification body. The first non-empty
// title in this list wins. Telugu is the primary publishing language.
const NOTIFICATION_BODY_LANG_ORDER = ['te', 'en', 'hi'];

// Error codes that mean the token is permanently dead and should be deleted.
// See: https://firebase.google.com/docs/reference/admin/error-handling
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential'
]);

const truncate = (s, n) => {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

const pickLang = (mapLike, lang, fallbackLang) => {
  if (!mapLike) return '';
  // mongoose Maps: use .get; plain objects: index access
  const get = typeof mapLike.get === 'function' ? (k) => mapLike.get(k) : (k) => mapLike[k];
  return get(lang) || get(fallbackLang) || get('en') || '';
};

// Walk an ordered list of preferred language codes plus the system default
// and return the first non-empty value found. Used to pick the headline that
// goes into the push-notification body.
const pickFirstNonEmpty = (mapLike, langOrder, defaultLang) => {
  if (!mapLike) return '';
  const get = typeof mapLike.get === 'function' ? (k) => mapLike.get(k) : (k) => mapLike[k];
  const seen = new Set();
  const tryLangs = [...langOrder, defaultLang, 'en'];
  for (const code of tryLangs) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const value = get(code);
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
};

/**
 * Build the FCM message payload for a published article.
 *
 * Notification shape:
 *   title — fixed brand heading ("Taaja News")
 *   body  — article headline in the preferred language (te → default → en → hi)
 *
 * Returns null if the article has no usable headline (we won't send empty pushes).
 */
const buildArticleMessage = async (article) => {
  const defaultLang = await languageCache.getDefaultLanguageCode().catch(() => 'en');

  const headline = pickFirstNonEmpty(article.title, NOTIFICATION_BODY_LANG_ORDER, defaultLang);
  if (!headline) return null;

  const body = truncate(headline, NOTIFICATION_BODY_LIMIT);
  const imageUrl = article.featuredImage && article.featuredImage.url ? article.featuredImage.url : undefined;

  // `data` is string-only per FCM contract.
  const data = {
    type: 'article_published',
    articleId: String(article._id),
    shortId: article.shortId || '',
    slug: article.slug || '',
    publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString()
  };
  if (imageUrl) data.imageUrl = imageUrl;

  return {
    notification: {
      title: NOTIFICATION_BRAND_TITLE,
      body
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'taaja_news_articles',
        ...(imageUrl ? { imageUrl } : {})
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'mutable-content': 1
        }
      },
      ...(imageUrl ? { fcmOptions: { imageUrl } } : {})
    }
  };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Send a notification announcing a newly-published article to every
 * registered FCM token. Fire-and-forget safe.
 *
 * @param {object} article - A populated Article mongoose document (or lean obj).
 * @returns {Promise<{sent:number, failed:number, removed:number, skipped?:string}>}
 */
// Mask an FCM token for safe logging: keep enough to identify a row without
// putting the full token (which is a credential) into application logs.
const maskToken = (t) => {
  if (!t || typeof t !== 'string') return '<empty>';
  if (t.length <= 12) return `${t.slice(0, 4)}…${t.slice(-2)}`;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
};

const notifyArticlePublished = async (article) => {
  const aid = article && article._id ? String(article._id) : '<unknown>';
  const startedAt = Date.now();

  try {
    if (!isConfigured()) {
      console.warn(`[push] articleId=${aid} SKIPPED reason=firebase-not-configured (set FIREBASE_SERVICE_ACCOUNT_* env var)`);
      return { sent: 0, failed: 0, removed: 0, skipped: 'firebase-not-configured' };
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.warn(`[push] articleId=${aid} SKIPPED reason=messaging-unavailable`);
      return { sent: 0, failed: 0, removed: 0, skipped: 'messaging-unavailable' };
    }

    const payload = await buildArticleMessage(article);
    if (!payload) {
      console.warn(`[push] articleId=${aid} SKIPPED reason=no-title (article.title is empty)`);
      return { sent: 0, failed: 0, removed: 0, skipped: 'no-title' };
    }

    // Pull all tokens. `.lean()` keeps this lightweight.
    // If/when the user base is large, replace with a streamed cursor + batching.
    const tokenDocs = await FcmToken.find({
      fcmToken: { $exists: true, $ne: null, $nin: ['', null] }
    })
      .select('_id fcmToken')
      .lean();

    if (tokenDocs.length === 0) {
      console.warn(`[push] articleId=${aid} SKIPPED reason=no-tokens (FcmToken collection is empty)`);
      return { sent: 0, failed: 0, removed: 0, skipped: 'no-tokens' };
    }

    const batches = chunk(tokenDocs, FCM_MULTICAST_LIMIT);
    console.log(
      `[push] articleId=${aid} START title=${JSON.stringify(payload.notification.title)} ` +
      `body=${JSON.stringify((payload.notification.body || '').slice(0, 60))} ` +
      `tokens=${tokenDocs.length} batches=${batches.length}`
    );

    let sent = 0;
    let failed = 0;
    const deadTokens = [];
    const failureReasons = {}; // { 'messaging/...': count }

    for (let i = 0; i < batches.length; i++) {
      const group = batches[i];
      const tokens = group.map((d) => d.fcmToken);
      try {
        const response = await messaging.sendEachForMulticast({ ...payload, tokens });
        sent += response.successCount;
        failed += response.failureCount;

        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const code = (res.error && res.error.code) || 'unknown';
            failureReasons[code] = (failureReasons[code] || 0) + 1;
            if (DEAD_TOKEN_CODES.has(code)) {
              deadTokens.push(tokens[idx]);
            }
          }
        });

        console.log(
          `[push] articleId=${aid} batch=${i + 1}/${batches.length} ` +
          `size=${tokens.length} success=${response.successCount} failure=${response.failureCount}`
        );
      } catch (batchErr) {
        failed += tokens.length;
        console.error(
          `[push] articleId=${aid} batch=${i + 1}/${batches.length} multicast failed:`,
          batchErr.message
        );
      }
    }

    let removed = 0;
    if (deadTokens.length) {
      try {
        const del = await FcmToken.deleteMany({ fcmToken: { $in: deadTokens } });
        removed = del.deletedCount || 0;
        console.log(
          `[push] articleId=${aid} pruned ${removed} dead tokens (example=${maskToken(deadTokens[0])})`
        );
      } catch (cleanupErr) {
        console.error(`[push] articleId=${aid} failed to prune dead tokens:`, cleanupErr.message);
      }
    }

    const took = Date.now() - startedAt;
    const reasonsLine = Object.keys(failureReasons).length
      ? ` failureReasons=${JSON.stringify(failureReasons)}`
      : '';
    console.log(
      `[push] articleId=${aid} DONE delivered=${sent}/${tokenDocs.length} ` +
      `failed=${failed} removed=${removed} took=${took}ms${reasonsLine}`
    );
    return { sent, failed, removed, totalTokens: tokenDocs.length, failureReasons };
  } catch (err) {
    // Never let a notification failure escape to the caller.
    console.error(`[push] articleId=${aid} notifyArticlePublished error:`, err.message);
    return { sent: 0, failed: 0, removed: 0, skipped: 'error' };
  }
};

module.exports = {
  notifyArticlePublished,
  // exported for tests
  _internal: {
    buildArticleMessage,
    chunk,
    pickFirstNonEmpty,
    DEAD_TOKEN_CODES,
    NOTIFICATION_BRAND_TITLE,
    NOTIFICATION_BODY_LANG_ORDER
  }
};
