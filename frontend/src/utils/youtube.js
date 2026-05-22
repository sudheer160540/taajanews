/**
 * YouTube URL helpers.
 *
 * SECURITY: Callers MUST NOT assign a raw user-supplied URL to an iframe
 * `src`. Always resolve the video id via `getYoutubeEmbedId(url)`, validate
 * it against `isValidEmbedId(id)`, and rebuild the embed URL with a fixed
 * host (`https://www.youtube-nocookie.com/embed/{id}`). This blocks
 * `javascript:`, `data:`, and arbitrary-host redirects.
 */

// YouTube video ids are 11 chars in practice; allow 6+ to tolerate future
// changes while still rejecting empty/garbage payloads.
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

/**
 * Extract the video id from a watch / share / embed / shorts URL.
 * Returns `null` for anything that isn't a recognizable YouTube URL on a
 * trusted host. Never throws.
 *
 * Supported forms:
 *   https://www.youtube.com/watch?v=ID
 *   https://m.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/v/ID
 */
export const getYoutubeEmbedId = (url) => {
  if (!url || typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

  let candidate = null;
  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] || null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v');
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') {
        candidate = parts[1] || null;
      }
    }
  }

  return isValidEmbedId(candidate) ? candidate : null;
};

export const isValidEmbedId = (id) =>
  typeof id === 'string' && YOUTUBE_ID_PATTERN.test(id);

/**
 * Build a privacy-enhanced (nocookie) embed URL for a *validated* video id.
 * Caller must have already passed `id` through `getYoutubeEmbedId` /
 * `isValidEmbedId`; this function re-validates as a defense-in-depth check
 * and throws if the id is unsafe so the bug surfaces in development.
 */
export const buildYoutubeEmbedUrl = (id, { autoplay = true } = {}) => {
  if (!isValidEmbedId(id)) {
    throw new Error('buildYoutubeEmbedUrl: invalid YouTube video id');
  }
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1'
  });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
};
