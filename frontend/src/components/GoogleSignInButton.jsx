import { useState } from 'react';
import { Alert, Box } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import {
  getGoogleAuthOriginHint,
  isGoogleAuthConfigured
} from '../config/googleAuth';

/**
 * Google Sign-In button with setup hints for common OAuth errors
 * (no registered origin, invalid_client).
 */
const GoogleSignInButton = ({ onSuccess, onLoadingChange, text = 'signin_with', disabled = false }) => {
  const [googleError, setGoogleError] = useState(null);

  if (!isGoogleAuthConfigured()) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Google Sign-In is not configured. Set <strong>VITE_GOOGLE_CLIENT_ID</strong> in{' '}
        <code>frontend/.env</code> to a <strong>Web application</strong> OAuth client ID, then
        restart the dev server.
      </Alert>
    );
  }

  const handleSuccess = async (credentialResponse) => {
    setGoogleError(null);
    onLoadingChange?.(true);
    try {
      await onSuccess(credentialResponse);
    } finally {
      onLoadingChange?.(false);
    }
  };

  const handleError = () => {
    setGoogleError(getGoogleAuthOriginHint());
    onLoadingChange?.(false);
  };

  return (
    <Box sx={{ mb: 2 }}>
      {googleError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Google authorization failed.</strong> {googleError}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          width="100%"
          text={text}
          shape="rectangular"
          size="large"
          useOneTap={false}
        />
      </Box>
    </Box>
  );
};

export default GoogleSignInButton;
