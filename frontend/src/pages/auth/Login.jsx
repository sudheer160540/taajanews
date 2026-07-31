import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import GoogleSignInButton from '../../components/GoogleSignInButton';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, googleLogin, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirectByRole = (userData) => {
    const role = userData?.role;
    if (role === 'admin' || role === 'reporter') {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      redirectByRole(result.user);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(null);
    setLoading(true);
    const result = await googleLogin(credentialResponse.credential);
    if (result.success) {
      redirectByRole(result.user);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #4875BC 0%, #FF1424 100%)',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4, color: 'white' }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Taaja News"
            sx={{ width: 90, height: 90, borderRadius: '50%', mb: 2, objectFit: 'cover', boxShadow: 3 }}
          />
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t('appName')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {t('tagline')}
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={600} textAlign="center" gutterBottom>
              {t('login')}
            </Typography>

            {(error || authError) && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error || authError}
              </Alert>
            )}

            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onLoadingChange={setLoading}
              disabled={loading}
            />

            <Divider sx={{ my: 2 }}>or</Divider>

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label={t('email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                label={t('password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Link
                  to="/auth/forgot-password"
                  style={{ color: '#4875BC', fontSize: '0.875rem', textDecoration: 'none' }}
                >
                  Forgot password?
                </Link>
              </Box>

              <Button
                fullWidth
                variant="contained"
                type="submit"
                size="large"
                disabled={loading}
                sx={{ mt: 2, mb: 2 }}
              >
                {loading ? t('loading') : t('login')}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography textAlign="center" variant="body2">
              {t('noAccount')}{' '}
              <Link to="/auth/register" style={{ color: '#4875BC' }}>
                {t('register')}
              </Link>
            </Typography>

            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link to="/" style={{ color: '#666', textDecoration: 'none' }}>
                ← Browse News
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;
