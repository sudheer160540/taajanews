import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  DeleteForever as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Storage as DataIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { accountDeletionApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DeleteAccount = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState(user?.email || '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await accountDeletionApi.submit({ email: email.trim(), reason: reason.trim() });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit request';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const dataDeleted = [
    { icon: <PersonIcon />, text: 'User profile information' },
    { icon: <EmailIcon />, text: 'Email address' },
    { icon: <DataIcon />, text: 'User likes and comments' }
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="md">
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/')}
          sx={{ mb: 3 }}
        >
          Back to Home
        </Button>

        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <DeleteIcon sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Delete Account
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Taaja News — Account Deletion Request
          </Typography>
        </Box>

        {/* Info Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              How to request account deletion
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Fill out the form below with your registered email address" />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Or send a deletion request email to support@taajanews.com with your registered email ID" />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" fontWeight={600} gutterBottom>
              What data will be deleted
            </Typography>
            <List dense>
              {dataDeleted.map((item, idx) => (
                <ListItem key={idx}>
                  <ListItemIcon sx={{ color: 'error.main' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ScheduleIcon color="warning" />
              <Typography variant="body1">
                <strong>Inactive accounts:</strong> If the app is not used for <Chip label="90 days" size="small" color="warning" />, your data will be automatically deleted.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon color="info" />
              <Typography variant="body1">
                <strong>Processing time:</strong> Account deletion requests are processed within <Chip label="7 days" size="small" color="info" />.
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Request Form */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            {success ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Request Submitted
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Your account deletion request has been submitted successfully.
                  It will be processed within 7 days. You will receive a confirmation
                  once your data has been removed.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/')}>
                  Back to Home
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Submit Deletion Request
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="Registered Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    margin="normal"
                    placeholder="Enter your registered email"
                    helperText="Enter the email address associated with your account"
                  />

                  <TextField
                    fullWidth
                    label="Reason for deletion (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    margin="normal"
                    multiline
                    rows={3}
                    placeholder="Let us know why you'd like to delete your account..."
                    inputProps={{ maxLength: 1000 }}
                  />

                  <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
                    This action is irreversible. Once your account is deleted, all your data
                    including profile, articles, comments, and uploaded content will be permanently removed.
                  </Alert>

                  <Button
                    fullWidth
                    variant="contained"
                    color="error"
                    type="submit"
                    size="large"
                    disabled={loading || !email.trim()}
                    startIcon={<DeleteIcon />}
                    sx={{ mt: 1 }}
                  >
                    {loading ? 'Submitting...' : 'Request Account Deletion'}
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default DeleteAccount;
