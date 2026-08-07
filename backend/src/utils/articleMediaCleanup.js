const { deleteBlobFromUrl } = require('../config/azure');

/** Collect all Azure media URLs attached to an article. */
const collectArticleMediaUrls = (article) => {
  const urls = new Set();
  if (!article) return [];

  if (article.featuredImage?.url) urls.add(article.featuredImage.url);
  if (article.featuredImage?.appUrl) urls.add(article.featuredImage.appUrl);

  (article.images || []).forEach((img) => {
    if (img?.url) urls.add(img.url);
  });

  (article.videos || []).forEach((video) => {
    if (video?.url) urls.add(video.url);
    if (video?.thumbnail) urls.add(video.thumbnail);
  });

  if (article.audio instanceof Map) {
    article.audio.forEach((value) => { if (value) urls.add(value); });
  } else if (article.audio && typeof article.audio === 'object') {
    Object.values(article.audio).forEach((value) => { if (value) urls.add(value); });
  }

  return [...urls];
};

/** Delete featured image, gallery images, videos, and audio from Azure Blob Storage. */
const deleteArticleMediaFromAzure = async (article) => {
  const urls = collectArticleMediaUrls(article);
  const outcomes = await Promise.allSettled(urls.map((url) => deleteBlobFromUrl(url)));

  const deleted = outcomes.filter((o) => o.status === 'fulfilled' && o.value === true).length;
  const failed = urls.length - deleted;

  if (failed > 0) {
    console.warn(`[article-delete] Azure cleanup: ${deleted} deleted, ${failed} failed/skipped`);
  }

  return { total: urls.length, deleted, failed };
};

module.exports = {
  collectArticleMediaUrls,
  deleteArticleMediaFromAzure
};
