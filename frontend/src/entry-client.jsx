import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { SSRDataProvider } from './contexts/SSRDataContext';
import theme from './theme';
import { getGoogleClientId, isGoogleAuthConfigured } from './config/googleAuth';
import './i18n';
import './index.css';

if (!isGoogleAuthConfigured()) {
  console.warn(
    '[Taaja News] VITE_GOOGLE_CLIENT_ID is missing. Google Sign-In will be disabled.'
  );
}

const emotionCache = createCache({ key: 'mui' });
const googleClientId = getGoogleClientId();
// State the server serialized into the page (null on plain CSR / dev without SSR).
const ssrState = typeof window !== 'undefined' ? window.__SSR_STATE__ || null : null;

const app = (
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <CacheProvider value={emotionCache}>
        <BrowserRouter>
          <HelmetProvider>
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
        </BrowserRouter>
      </CacheProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

const rootEl = document.getElementById('root');

// If the server rendered markup into #root, hydrate it; otherwise mount fresh.
if (ssrState && rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
