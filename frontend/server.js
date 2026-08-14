import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import {
  renderPage,
  parseUrl,
  prefetchData,
  pickLang,
  applyTemplate
} from './lib/ssr-render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 4173);
const resolve = (p) => path.resolve(__dirname, p);

async function createServer() {
  const app = express();
  app.use(compression());

  let vite;
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(resolve('dist/client'), {
        index: false,
        maxAge: '1y',
        immutable: true
      })
    );
  }

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;

      if (isProduction) {
        const html = await renderPage(url);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        return;
      }

      const { pathname, query } = parseUrl(url);
      let template = fs.readFileSync(resolve('index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');
      const lang = pickLang(query);
      const ssrState = await prefetchData(pathname, lang);
      const { appHtml, headTags, lang: renderedLang } = await render(url, { lang, ssrState });
      const html = applyTemplate(template, { appHtml, headTags, renderedLang, ssrState });
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (err) {
      console.error('[ssr] render failed:', err);
      vite?.ssrFixStacktrace(err);
      res.status(500).end('Internal Server Error');
    }
  });

  return app;
}

createServer().then((app) => {
  app.listen(port, () => {
    console.log(`SSR server running at http://localhost:${port}`);
  });
});
