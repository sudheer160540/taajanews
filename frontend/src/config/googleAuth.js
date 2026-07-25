/**
 * Google Sign-In (GIS) config for web.
 * Requires OAuth 2.0 Client ID of type "Web application" — NOT "Installed" / Android / iOS.
 */
export const getGoogleClientId = () =>
  (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export const isGoogleAuthConfigured = () => Boolean(getGoogleClientId());

/** Shown when GIS popup fails (no registered origin / invalid_client). */
export const getGoogleAuthOriginHint = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'your-site-url';
  return (
    `Add "${origin}" under Authorized JavaScript origins in Google Cloud Console ` +
    '(Credentials → OAuth 2.0 Client IDs → Web application). ' +
    'Use a Web client ID, not an Installed/Android client.'
  );
};
