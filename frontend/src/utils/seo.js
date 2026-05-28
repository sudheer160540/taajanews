/** Public site origin (no trailing slash). Set VITE_SITE_URL in production. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://taajanews.net'
).replace(/\/$/, '');

export const SITE_NAME = 'Taaja News';

export const DEFAULT_DESCRIPTION =
  'Read the latest news in Telugu, Hindi and English. Breaking headlines, local updates from Andhra Pradesh, Telangana and across India on Taaja News.';

export const DEFAULT_KEYWORDS =
  'latest news, breaking news, telugu news, hindi news, english news, andhra pradesh news, telangana news, india news, local news, taaja news';

export const toAbsoluteUrl = (path = '/') => {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const stripHtml = (text = '') =>
  String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const truncate = (text = '', max = 160) => {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
};

/** NewsArticle / Article JSON-LD for Google rich results */
export const buildNewsArticleJsonLd = ({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName,
  categoryName
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description: truncate(description, 300),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteUrl('/logo.png')
      }
    },
    inLanguage: ['te', 'en', 'hi']
  };

  if (image) schema.image = [image];
  if (datePublished) schema.datePublished = datePublished;
  if (dateModified) schema.dateModified = dateModified;
  if (authorName) {
    schema.author = { '@type': 'Person', name: authorName };
  }
  if (categoryName) {
    schema.articleSection = categoryName;
  }

  return schema;
};

export const buildWebSiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  inLanguage: ['te', 'en', 'hi'],
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
});
