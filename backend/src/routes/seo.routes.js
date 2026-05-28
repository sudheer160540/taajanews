const express = require('express');
const Article = require('../models/Article');
const Category = require('../models/Category');

const router = express.Router();

const SITE_URL = (process.env.FRONTEND_URL || 'https://taajanews.net').replace(/\/$/, '');

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toIso = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const buildUrlEntry = ({ loc, lastmod, changefreq, priority }) => {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(loc)}</loc>\n`;
  if (lastmod) xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
  if (changefreq) xml += `    <changefreq>${changefreq}</changefreq>\n`;
  if (priority) xml += `    <priority>${priority}</priority>\n`;
  xml += '  </url>\n';
  return xml;
};

/**
 * Dynamic XML sitemap for search engines (submit in Google Search Console).
 * Served at GET /sitemap.xml on the API host; point frontend robots.txt to this URL
 * or proxy /sitemap.xml from your news domain to this endpoint.
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const [articles, categories] = await Promise.all([
      Article.find({ status: 'published' })
        .select('slug updatedAt publishedAt')
        .sort({ publishedAt: -1 })
        .limit(5000)
        .lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean()
    ]);

    const staticPages = [
      { loc: `${SITE_URL}/`, changefreq: 'hourly', priority: '1.0' },
      { loc: `${SITE_URL}/search`, changefreq: 'daily', priority: '0.6' },
      { loc: `${SITE_URL}/videos`, changefreq: 'daily', priority: '0.6' },
      { loc: `${SITE_URL}/about`, changefreq: 'monthly', priority: '0.4' },
      { loc: `${SITE_URL}/contact`, changefreq: 'monthly', priority: '0.4' },
      { loc: `${SITE_URL}/editorial-policy`, changefreq: 'monthly', priority: '0.3' },
      { loc: `${SITE_URL}/privacy-policy`, changefreq: 'monthly', priority: '0.3' },
      { loc: `${SITE_URL}/terms`, changefreq: 'monthly', priority: '0.3' }
    ];

    const categoryPages = categories.map((cat) => ({
      loc: `${SITE_URL}/category/${cat.slug}`,
      lastmod: toIso(cat.updatedAt),
      changefreq: 'daily',
      priority: '0.7'
    }));

    const articlePages = articles.map((article) => ({
      loc: `${SITE_URL}/article/${article.slug}`,
      lastmod: toIso(article.updatedAt || article.publishedAt),
      changefreq: 'daily',
      priority: '0.8'
    }));

    const allUrls = [...staticPages, ...categoryPages, ...articlePages];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    allUrls.forEach((entry) => {
      xml += buildUrlEntry(entry);
    });
    xml += '</urlset>';

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('<?xml version="1.0"?><error>Sitemap unavailable</error>');
  }
});

module.exports = router;
