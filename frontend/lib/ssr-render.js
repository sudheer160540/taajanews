import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SUPPORTED_LANGS = ['te', 'en', 'hi'];
const DEFAULT_LANG = 'te';

const API_BASE_URL = (
  process.env.SSR_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:5001/api'
).replace(/\/$/, '');

export const serializeState = (state) =>
  JSON.stringify(state || {}).replace(/</g, '\\u003c');

export const pickLang = (query = {}) => {
  const q = String(query.lang || '');
  return SUPPORTED_LANGS.includes(q) ? q : DEFAULT_LANG;
};

export const parseUrl = (url) => {
  const parsed = new URL(url, 'http://ssr.local');
  return { pathname: parsed.pathname, query: Object.fromEntries(parsed.searchParams) };
};

export async function prefetchData(pathname, lang) {
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

let renderFn;

async function getRender() {
  if (renderFn) return renderFn;
  const entryPath = path.join(ROOT, 'dist/server/entry-server.js');
  const mod = await import(pathToFileURL(entryPath).href);
  renderFn = mod.render;
  return renderFn;
}

/**
 * Render a full HTML document for the given URL (used by Express locally and Vercel).
 */
export async function renderPage(url) {
  const { pathname, query } = parseUrl(url);
  const templatePath = path.join(ROOT, 'dist/client/template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const render = await getRender();
  return renderWithTemplate(template, url, pathname, query, render);
}

export function applyTemplate(template, { appHtml, headTags, renderedLang, ssrState }) {
  const stateScript = `<script>window.__SSR_STATE__ = ${serializeState(ssrState)}</script>`;
  return template
    .replace('<!--ssr-head-->', headTags)
    .replace('<!--ssr-outlet-->', appHtml)
    .replace('<!--ssr-state-->', stateScript)
    .replace('<html lang="en">', `<html lang="${renderedLang}">`);
}

export async function renderWithTemplate(template, url, pathname, query, render) {
  const lang = pickLang(query);
  const ssrState = await prefetchData(pathname, lang);
  const { appHtml, headTags, lang: renderedLang } = await render(url, { lang, ssrState });
  return applyTemplate(template, { appHtml, headTags, renderedLang, ssrState });
}
