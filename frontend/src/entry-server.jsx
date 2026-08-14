import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import createEmotionServer from '@emotion/server/create-instance';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { SSRDataProvider } from './contexts/SSRDataContext';
import theme from './theme';
import i18n from './i18n';
import './index.css';

/**
 * Server render for a single request.
 *
 * @param {string} url        request path (e.g. "/article/some-slug")
 * @param {object} options
 * @param {string} options.lang      language to render content in (te|en|hi)
 * @param {object} options.ssrState  data prefetched for the page (seeded into SSRDataProvider)
 * @returns {{ appHtml: string, headTags: string, lang: string }}
 */
export async function render(url, { lang = 'en', ssrState = null } = {}) {
  if (lang && i18n.language !== lang) {
    try {
      await i18n.changeLanguage(lang);
    } catch {
      /* fall back to current language */
    }
  }

  // Per-request Emotion cache so concurrent requests never share styles.
  const cache = createCache({ key: 'mui' });
  const { extractCriticalToChunks, constructStyleTagsFromChunks } =
    createEmotionServer(cache);

  const helmetContext = {};

  const app = (
    <CacheProvider value={cache}>
      <StaticRouter location={url}>
        <HelmetProvider context={helmetContext}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SSRDataProvider value={ssrState}>
              <AuthProvider>
                <LocationProvider>
                  <App />
                </LocationProvider>
              </AuthProvider>
            </SSRDataProvider>
          </ThemeProvider>
        </HelmetProvider>
      </StaticRouter>
    </CacheProvider>
  );

  const appHtml = renderToString(app);

  // Critical CSS for what was rendered, so first paint is styled (no FOUC).
  const chunks = extractCriticalToChunks(appHtml);
  const styleTags = constructStyleTagsFromChunks(chunks);

  const { helmet } = helmetContext;
  const headTags = [
    helmet?.title?.toString() || '',
    helmet?.meta?.toString() || '',
    helmet?.link?.toString() || '',
    helmet?.script?.toString() || '',
    styleTags
  ]
    .filter(Boolean)
    .join('\n');

  return { appHtml, headTags, lang: i18n.language };
}
