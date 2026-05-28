import { Helmet } from 'react-helmet-async';
import {
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  toAbsoluteUrl
} from '../utils/seo';

/**
 * Per-route SEO: title, description, canonical, Open Graph, Twitter Card, optional JSON-LD.
 */
const Seo = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image,
  type = 'website',
  keywords = DEFAULT_KEYWORDS,
  jsonLd,
  noindex = false,
  lang = 'en'
}) => {
  const canonical = toAbsoluteUrl(path);
  const ogImage = image ? toAbsoluteUrl(image) : toAbsoluteUrl('/logo.png');
  const pageTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Latest News in Telugu, Hindi & English`;

  const jsonLdBlocks = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <html lang={lang} />
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={lang === 'te' ? 'te_IN' : lang === 'hi' ? 'hi_IN' : 'en_IN'} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLdBlocks.map((block, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
