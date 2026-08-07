import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { CategoryTrailProvider } from './contexts/CategoryTrailContext';
import theme from './theme';
import { getGoogleClientId, isGoogleAuthConfigured } from './config/googleAuth';
import './i18n';
import './index.css';

const googleClientId = getGoogleClientId();

if (!isGoogleAuthConfigured()) {
  console.warn(
    '[Taaja News] VITE_GOOGLE_CLIENT_ID is missing. Google Sign-In will be disabled. ' +
      'Create a Web application OAuth client in Google Cloud Console.'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <HelmetProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
              <LocationProvider>
                <CategoryTrailProvider>
                  <App />
                </CategoryTrailProvider>
              </LocationProvider>
            </AuthProvider>
          </ThemeProvider>
        </HelmetProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
