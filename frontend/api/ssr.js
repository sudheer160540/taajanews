import { renderPage } from '../lib/ssr-render.js';

/**
 * Vercel serverless handler — renders HTML with SSR for any non-static route.
 * Rewrites pass the original path as ?path= because req.url is the destination (/api/ssr).
 */
export default async function handler(req, res) {
  try {
    const pathParam = req.query?.path;
    const pathSegment = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
    const pathname = pathSegment ? `/${pathSegment}` : '/';

    const query = { ...req.query };
    delete query.path;
    const qs = new URLSearchParams(
      Object.entries(query).flatMap(([key, value]) =>
        Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]
      )
    ).toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    const html = await renderPage(url);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
  } catch (err) {
    console.error('[ssr] Vercel handler error:', err);
    res.status(500).send('Internal Server Error');
  }
}
