/**
 * Telegram notifications when an article is published.
 *
 * Uses the Bot API: https://core.telegram.org/bots/api#sendmessage
 *
 * Required env (both must be set):
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *   TELEGRAM_CHAT_ID   — your user id, group id, or channel id
 *                        (channels often look like -1001234567890)
 *
 * Optional:
 *   TELEGRAM_CHAT_IDS  — comma-separated list (overrides TELEGRAM_CHAT_ID)
 *   TELEGRAM_ENABLED   — set to "false" to disable without removing secrets
 *   TELEGRAM_NOTIFY_ON_PUBLISH — "false" to skip publish alerts (default on)
 *   TELEGRAM_NOTIFY_ON_SOURCE_PROCESS — "false" to skip source-cron alerts (default on)
 *   FRONTEND_URL       — base URL for article / dashboard links
 *
 * Failure mode: never throws; logs errors only (same as FCM push).
 */

const axios = require('axios');
const languageCache = require('./languageCache');

const TELEGRAM_API = 'https://api.telegram.org';
const MESSAGE_LIMIT = 4096;
const HEADLINE_LIMIT = 500;
const BODY_LANG_ORDER = ['te', 'en', 'hi'];

const isEnabledFlag = () => {
  const flag = (process.env.TELEGRAM_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'no';
};

const getBotToken = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();

const getChatIds = () => {
  const multi = process.env.TELEGRAM_CHAT_IDS || '';
  const single = process.env.TELEGRAM_CHAT_ID || '';
  const raw = multi || single;
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
};

const isConfigured = () =>
  isEnabledFlag() && Boolean(getBotToken()) && getChatIds().length > 0;

const isPublishNotifyEnabled = () => {
  const flag = (process.env.TELEGRAM_NOTIFY_ON_PUBLISH || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'no';
};

const isSourceProcessNotifyEnabled = () => {
  const flag = (process.env.TELEGRAM_NOTIFY_ON_SOURCE_PROCESS || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'no';
};

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

const buildDashboardEditUrl = (article) => {
  const base = getFrontendBase();
  const id = article && article._id ? String(article._id) : '';
  if (id) return `${base}/dashboard/articles/edit/${encodeURIComponent(id)}`;
  return `${base}/dashboard/articles`;
};

/**
 * HTML message for Telegram (parse_mode: HTML).
 */
const buildArticleTelegramMessage = async (article) => {
  const defaultLang = await languageCache.getDefaultLanguageCode().catch(() => 'te');
  const headline = pickFirstNonEmpty(article.title, BODY_LANG_ORDER, defaultLang);
  if (!headline) return null;

  const url = buildArticleUrl(article);
  const safeTitle = escapeHtml(truncate(headline, HEADLINE_LIMIT));
  const safeUrl = escapeHtml(url);
  const breaking = article.isBreaking ? '\n🔴 <b>Breaking</b>' : '';

  let text =
    `<b>📰 Taaja News</b>${breaking}\n\n` +
    `${safeTitle}\n\n` +
    `<a href="${safeUrl}">Read article</a>`;

  if (text.length > MESSAGE_LIMIT) {
    text = `${text.slice(0, MESSAGE_LIMIT - 1)}…`;
  }
  return text;
};

const sendToChat = async (botToken, chatId, text) => {
  const apiUrl = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const { data } = await axios.post(
    apiUrl,
    {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    },
    { timeout: 15000 }
  );
  if (!data || !data.ok) {
    throw new Error(data?.description || 'Telegram API returned ok=false');
  }
  return data;
};

const sendTelegramHtml = async (text, logLabel) => {
  if (!isConfigured()) {
    console.warn(`[telegram] ${logLabel} SKIPPED reason=not-configured`);
    return { sent: 0, failed: 0, skipped: 'not-configured' };
  }

  const botToken = getBotToken();
  const chatIds = getChatIds();
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const chatId of chatIds) {
    try {
      await sendToChat(botToken, chatId, text);
      sent++;
    } catch (err) {
      failed++;
      const desc = err.response?.data?.description || err.message;
      errors.push({ chatId, error: desc });
      console.error(`[telegram] ${logLabel} FAIL chatId=${chatId}:`, desc);
    }
  }

  return { sent, failed, totalChats: chatIds.length, errors };
};

/**
 * Post a published-article alert to configured Telegram chat(s).
 *
 * @returns {Promise<{ sent: number, failed: number, skipped?: string }>}
 */
const notifyArticlePublishedTelegram = async (article) => {
  const aid = article && article._id ? String(article._id) : '<unknown>';

  try {
    if (!isPublishNotifyEnabled()) {
      return { sent: 0, failed: 0, skipped: 'publish-notify-disabled' };
    }

    const text = await buildArticleTelegramMessage(article);
    if (!text) {
      console.warn(`[telegram] articleId=${aid} SKIPPED reason=no-title`);
      return { sent: 0, failed: 0, skipped: 'no-title' };
    }

    console.log(`[telegram] articleId=${aid} publish START`);
    return await sendTelegramHtml(text, `articleId=${aid} publish`);
  } catch (err) {
    console.error(`[telegram] articleId=${aid} notifyArticlePublishedTelegram error:`, err.message);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
};

/**
 * Alert editors when source-article cron creates a new draft Article.
 */
const buildSourceProcessedMessage = async (article, sourceDoc) => {
  const defaultLang = await languageCache.getDefaultLanguageCode().catch(() => 'te');
  const headline = pickFirstNonEmpty(article.title, BODY_LANG_ORDER, defaultLang);
  if (!headline) return null;

  const sourceLabel = sourceDoc
    ? `${sourceDoc.source || 'unknown'}/${sourceDoc.sourceId || '?'}`
    : 'unknown';
  const previewUrl = buildArticleUrl(article);
  const editUrl = buildDashboardEditUrl(article);
  const safeTitle = escapeHtml(truncate(headline, HEADLINE_LIMIT));
  const safeSource = escapeHtml(sourceLabel);
  const safePreview = escapeHtml(previewUrl);
  const safeEdit = escapeHtml(editUrl);

  let text =
    `<b>🤖 Source article processed</b>\n\n` +
    `<b>Source:</b> ${safeSource}\n` +
    `<b>Status:</b> draft (ready for review)\n\n` +
    `${safeTitle}\n\n` +
    `<a href="${safeEdit}">Edit in dashboard</a> · ` +
    `<a href="${safePreview}">Preview</a>`;

  if (text.length > MESSAGE_LIMIT) {
    text = `${text.slice(0, MESSAGE_LIMIT - 1)}…`;
  }
  return text;
};

const notifySourceArticleProcessedTelegram = async (article, sourceDoc) => {
  const aid = article && article._id ? String(article._id) : '<unknown>';
  const label = sourceDoc ? `${sourceDoc.source}/${sourceDoc.sourceId}` : 'unknown';

  try {
    if (!isSourceProcessNotifyEnabled()) {
      return { sent: 0, failed: 0, skipped: 'source-process-notify-disabled' };
    }

    const text = await buildSourceProcessedMessage(article, sourceDoc);
    if (!text) {
      console.warn(`[telegram] source=${label} SKIPPED reason=no-title`);
      return { sent: 0, failed: 0, skipped: 'no-title' };
    }

    console.log(`[telegram] source=${label} → articleId=${aid} source-process START`);
    return await sendTelegramHtml(text, `source=${label} articleId=${aid}`);
  } catch (err) {
    console.error(`[telegram] source-process articleId=${aid} error:`, err.message);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
};

const notifySourceArticleFailedTelegram = async (sourceDoc, errorMessage) => {
  const label = sourceDoc ? `${sourceDoc.source}/${sourceDoc.sourceId}` : 'unknown';

  try {
    if (!isSourceProcessNotifyEnabled()) {
      return { sent: 0, failed: 0, skipped: 'source-process-notify-disabled' };
    }

    const safeSource = escapeHtml(label);
    const safeErr = escapeHtml(truncate(String(errorMessage || 'Unknown error'), 800));
    const text =
      `<b>⚠️ Source article failed</b>\n\n` +
      `<b>Source:</b> ${safeSource}\n` +
      `<b>Error:</b> ${safeErr}`;

    return await sendTelegramHtml(text, `source=${label} failed`);
  } catch (err) {
    console.error(`[telegram] source=${label} failed-notify error:`, err.message);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
};

/**
 * Optional end-of-run summary for npm run process-source-articles.
 */
const notifySourceBatchSummaryTelegram = async (result) => {
  try {
    if (!isSourceProcessNotifyEnabled() || !isConfigured()) {
      return { sent: 0, failed: 0, skipped: 'disabled-or-not-configured' };
    }

    const processed = result?.processed || 0;
    const succeeded = result?.succeeded || 0;
    const failed = result?.failed || 0;
    if (processed === 0) {
      return { sent: 0, failed: 0, skipped: 'nothing-processed' };
    }

    let text =
      `<b>📋 Source cron batch done</b>\n\n` +
      `Processed: ${processed}\n` +
      `Succeeded: ${succeeded}\n` +
      `Failed: ${failed}`;

    if (failed > 0 && Array.isArray(result.errors) && result.errors.length) {
      const lines = result.errors
        .slice(0, 5)
        .map((e) => `• ${escapeHtml(e.source)}: ${escapeHtml(truncate(e.error, 120))}`);
      text += `\n\n${lines.join('\n')}`;
      if (result.errors.length > 5) {
        text += `\n… and ${result.errors.length - 5} more`;
      }
    }

    return await sendTelegramHtml(text, 'source-batch-summary');
  } catch (err) {
    console.error('[telegram] source-batch-summary error:', err.message);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
};

module.exports = {
  notifyArticlePublishedTelegram,
  notifySourceArticleProcessedTelegram,
  notifySourceArticleFailedTelegram,
  notifySourceBatchSummaryTelegram,
  isConfigured,
  buildArticleTelegramMessage,
  buildSourceProcessedMessage,
  _internal: { escapeHtml, buildArticleUrl, buildDashboardEditUrl, getChatIds }
};
