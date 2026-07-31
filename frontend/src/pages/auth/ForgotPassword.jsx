import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Password as PasswordIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { authApi } from '../../services/api';

const STEPS = ['Email', 'Verify code', 'New password'];

const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const genericSentMessage =
    'If an account with that email exists, a 6-digit code has been sent.';

  // Step 1: request the OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(email.trim());
      setInfo(data?.message || genericSentMessage);
      setActiveStep(1);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to send code. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setInfo('A new code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify the OTP (does not consume it)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyResetOtp(email.trim(), otp);
      setActiveStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: set the new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.resetPassword(email.trim(), otp, password);
      setInfo(data?.message || 'Password updated successfully. You can now log in.');
      setTimeout(() => navigate('/auth/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
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
              Forgot Password
            </Typography>

            <Stepper activeStep={activeStep} alternativeLabel sx={{ my: 3 }}>
              {STEPS.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            {info && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {info}
              </Alert>
            )}

            {activeStep === 0 && (
              <Box component="form" onSubmit={handleSendOtp}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter your email and we'll send you a 6-digit verification code.
                </Typography>
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
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  size="large"
                  disabled={loading}
                  sx={{ mt: 3, mb: 2 }}
                >
                  {loading ? t('loading') : 'Send Code'}
                </Button>
              </Box>
            )}

            {activeStep === 1 && (
              <Box component="form" onSubmit={handleVerifyOtp}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the 6-digit code sent to <strong>{email}</strong>.
                </Typography>
                <TextField
                  fullWidth
                  label="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  margin="normal"
                  inputProps={{
                    inputMode: 'numeric',
                    maxLength: 6,
                    style: { letterSpacing: '0.5em', fontSize: '1.25rem', textAlign: 'center' }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PasswordIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  size="large"
                  disabled={loading}
                  sx={{ mt: 3, mb: 1 }}
                >
                  {loading ? t('loading') : 'Verify Code'}
                </Button>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Button size="small" onClick={() => { setActiveStep(0); setError(null); setInfo(null); }}>
                    Change email
                  </Button>
                  <Button size="small" onClick={handleResendOtp} disabled={loading}>
                    Resend code
                  </Button>
                </Box>
              </Box>
            )}

            {activeStep === 2 && (
              <Box component="form" onSubmit={handleResetPassword}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose a new password for <strong>{email}</strong>.
                </Typography>
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
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <TextField
                  fullWidth
                  label={t('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  margin="normal"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  size="large"
                  disabled={loading || (info && info.includes('successfully'))}
                  sx={{ mt: 3, mb: 2 }}
                >
                  {loading ? t('loading') : 'Update Password'}
                </Button>
              </Box>
            )}

            <Typography textAlign="center" variant="body2" sx={{ mt: 2 }}>
              Remember your password?{' '}
              <Link to="/auth/login" style={{ color: '#4875BC' }}>
                {t('login')}
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

export default ForgotPassword;
