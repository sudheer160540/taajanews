import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5173;
const SUPPORTED_LANGS = ['te', 'en', 'hi'];
const DEFAULT_LANG = 'te';

// Minimal .env loader so `VITE_API_BASE_URL` works when running under plain node.
function loadEnv() {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    /* no .env file — rely on real environment variables */
  }
}
loadEnv();

const API_BASE_URL = (
  process.env.SSR_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:5001/api'
).replace(/\/$/, '');

const pickLang = (req) => {
  const q = String(req.query.lang || '');
  return SUPPORTED_LANGS.includes(q) ? q : DEFAULT_LANG;
};

// Escape `<` so serialized JSON can't break out of the <script> tag (XSS-safe).
const serializeState = (state) =>
  JSON.stringify(state || {}).replace(/</g, '\\u003c');

/**
 * Fetch the data a route needs so the server render has real content.
 * Uses plain fetch (NOT the browser axios instance, which reads cookies).
 */
async function prefetchData(pathname, lang) {
  const state = {};
  try {
    const articleMatch = pathname.match(/^\/article\/([^/]+)\/?$/);
    if (articleMatch) {
      const slug = decodeURIComponent(articleMatch[1]);
      const res = await fetch(
        `${API_BASE_URL}/articles/slug/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`
      );
      if (res.ok) {
        const data = await res.json();
        state[`article:${slug}`] = {
          article: data.article || null,
          relatedArticles: data.relatedArticles || [],
          breadcrumb: data.breadcrumb || []
        };
      }
    }
  } catch (err) {
    console.error('[ssr] prefetch failed:', err.message);
  }
  return state;
}

async function createServer() {
  const app = express();
  app.use(compression());

  let vite;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist/client'), { index: false })
    );
  }

  app.use('*', async (req, res) => {
    const url = req.originalUrl;
    const pathname = url.split('?')[0];

    try {
      let template;
      let render;

      if (!isProd) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render;
      } else {
        template = fs.readFileSync(
          path.resolve(__dirname, 'dist/client/index.html'),
          'utf-8'
        );
        render = (await import('./dist/server/entry-server.js')).render;
      }

      const lang = pickLang(req);
      const ssrState = await prefetchData(pathname, lang);
      const { appHtml, headTags, lang: renderedLang } = await render(url, {
        lang,
        ssrState
      });

      const stateScript = `<script>window.__SSR_STATE__ = ${serializeState(ssrState)}</script>`;

      const html = template
        .replace('<!--ssr-head-->', headTags)
        .replace('<!--ssr-outlet-->', appHtml)
        .replace('<!--ssr-state-->', stateScript)
        .replace('<html lang="en">', `<html lang="${renderedLang}">`);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (err) {
      if (vite) vite.ssrFixStacktrace(err);
      console.error('[ssr] render error:', err);
      res.status(500).end('Internal Server Error');
    }
  });

  app.listen(PORT, () => {
    console.log(
      `[ssr] server running at http://localhost:${PORT} (${isProd ? 'production' : 'development'})`
    );
  });
}

createServer();
