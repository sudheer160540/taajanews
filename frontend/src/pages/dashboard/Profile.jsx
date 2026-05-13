import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  DeleteOutline as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api, { uploadApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ─── Profile photo constraints ───────────────────────────────────────────
// These are enforced both on the client (here) and on the server
// (User model + Joi schema). Keep both sides in sync if you change them.
const PROFILE_PHOTO = {
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_FILE_BYTES: 5 * 1024 * 1024,    // raw upload limit (5 MB)
  MIN_DIMENSION: 100,                  // smallest allowed source side (px)
  MAX_SOURCE_DIMENSION: 4096,          // largest allowed source side (px)
  TARGET_DIMENSION: 512,               // square output served everywhere
  OUTPUT_TYPE: 'image/jpeg',
  OUTPUT_QUALITY: 0.9
};

const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const readFileAsImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ img, dataUrl: reader.result });
      img.onerror = () => reject(new Error('The selected file is not a valid image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// Square center-crop → resize to TARGET_DIMENSION → JPEG blob.
// This produces a single canonical size that is suitable for use anywhere
// in the app (avatar, header, comments, etc.) regardless of source ratio.
const cropAndResizeToSquare = (img, targetSize) =>
  new Promise((resolve, reject) => {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = Math.floor((img.naturalWidth - side) / 2);
    const sy = Math.floor((img.naturalHeight - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Image processing is not supported in this browser'));
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode the resized profile photo'));
          return;
        }
        resolve(blob);
      },
      PROFILE_PHOTO.OUTPUT_TYPE,
      PROFILE_PHOTO.OUTPUT_QUALITY
    );
  });

const Profile = () => {
  const { user, checkAuth } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [photo, setPhoto] = useState(null); // { url, width, height, size, contentType }
  const [previewUrl, setPreviewUrl] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const initials = useMemo(() => {
    const source = (form.name || user?.name || '').trim();
    if (!source) return '?';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }, [form.name, user?.name]);

  // Hydrate the form from the freshest profile so we never operate on a
  // stale auth context (e.g. older avatar without profilePhoto metadata).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/auth/me');
        if (cancelled) return;
        const me = res.data?.user || user || {};
        setForm({
          name: me.name || '',
          email: me.email || '',
          phone: me.phone || ''
        });
        setPhoto(
          me.profilePhoto?.url
            ? {
                url: me.profilePhoto.url,
                width: me.profilePhoto.width,
                height: me.profilePhoto.height,
                size: me.profilePhoto.size,
                contentType: me.profilePhoto.contentType
              }
            : me.avatar
              ? { url: me.avatar }
              : null
        );
      } catch {
        // Fall back to whatever we have in the auth context.
        if (cancelled) return;
        setForm({
          name: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || ''
        });
        setPhoto(
          user?.profilePhoto?.url
            ? user.profilePhoto
            : user?.avatar
              ? { url: user.avatar }
              : null
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke object URLs we generated for in-memory previews.
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayedPhotoUrl = previewUrl || photo?.url || null;

  const validateForm = () => {
    const errors = {};
    const name = (form.name || '').trim();
    const email = (form.email || '').trim().toLowerCase();
    const phone = (form.phone || '').trim();

    if (name.length < 2 || name.length > 100) {
      errors.name = 'Name must be between 2 and 100 characters';
    }
    if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address';
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.phone = 'Enter a valid phone (e.g. +919876543210)';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSelectPhoto = () => {
    setError(null);
    setSuccess(null);
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setError(null);
    setSuccess(null);

    if (!PROFILE_PHOTO.ALLOWED_TYPES.includes(file.type)) {
      setError('Profile photo must be a JPEG, PNG or WebP image');
      return;
    }
    if (file.size > PROFILE_PHOTO.MAX_FILE_BYTES) {
      setError(
        `Profile photo cannot exceed ${PROFILE_PHOTO.MAX_FILE_BYTES / (1024 * 1024)}MB`
      );
      return;
    }

    setUploading(true);
    try {
      const { img } = await readFileAsImage(file);

      if (
        img.naturalWidth < PROFILE_PHOTO.MIN_DIMENSION ||
        img.naturalHeight < PROFILE_PHOTO.MIN_DIMENSION
      ) {
        throw new Error(
          `Image is too small. Minimum ${PROFILE_PHOTO.MIN_DIMENSION}×${PROFILE_PHOTO.MIN_DIMENSION}px.`
        );
      }
      if (
        img.naturalWidth > PROFILE_PHOTO.MAX_SOURCE_DIMENSION ||
        img.naturalHeight > PROFILE_PHOTO.MAX_SOURCE_DIMENSION
      ) {
        throw new Error(
          `Image is too large. Maximum ${PROFILE_PHOTO.MAX_SOURCE_DIMENSION}×${PROFILE_PHOTO.MAX_SOURCE_DIMENSION}px.`
        );
      }

      const blob = await cropAndResizeToSquare(img, PROFILE_PHOTO.TARGET_DIMENSION);
      const normalizedFile = new File([blob], `profile-${Date.now()}.jpg`, {
        type: PROFILE_PHOTO.OUTPUT_TYPE
      });

      const localPreview = URL.createObjectURL(blob);
      setPreviewUrl(localPreview);

      const res = await uploadApi.uploadFile(normalizedFile);
      const blobUrl = res.data?.blobUrl;
      if (!blobUrl) throw new Error('Upload did not return a URL');

      setPhoto({
        url: blobUrl,
        width: PROFILE_PHOTO.TARGET_DIMENSION,
        height: PROFILE_PHOTO.TARGET_DIMENSION,
        size: blob.size,
        contentType: PROFILE_PHOTO.OUTPUT_TYPE
      });

      setSuccess('Photo uploaded. Click "Save changes" to apply.');
    } catch (err) {
      console.error('Profile photo upload error:', err);
      setError(err?.message || 'Failed to upload profile photo');
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setError(null);
    setSuccess(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPhoto(null);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null
      };

      if (photo && photo.url) {
        // Only send full metadata if we actually have it (newly uploaded
        // image). For pre-existing photos without metadata, just send the
        // URL via `avatar` so the server doesn't reject the partial object.
        if (photo.width && photo.height && photo.size && photo.contentType) {
          payload.profilePhoto = {
            url: photo.url,
            width: photo.width,
            height: photo.height,
            size: photo.size,
            contentType: photo.contentType
          };
        } else {
          payload.avatar = photo.url;
        }
      } else {
        payload.profilePhoto = null;
        payload.avatar = null;
      }

      await api.put('/users/profile', payload);
      await checkAuth();
      setSuccess('Profile updated successfully');
    } catch (err) {
      console.error('Update profile error:', err);
      const apiError = err.response?.data;
      if (apiError?.details && Array.isArray(apiError.details)) {
        setError(apiError.details.join(' • '));
      } else {
        setError(apiError?.error || 'Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          My Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Update your personal details and profile photo.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Grid container spacing={4}>
            {/* Profile photo */}
            <Grid item xs={12} md={4}>
              <Stack alignItems="center" spacing={2}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={displayedPhotoUrl || undefined}
                    alt={form.name || 'Profile photo'}
                    sx={{
                      width: 160,
                      height: 160,
                      bgcolor: 'primary.main',
                      fontSize: 48,
                      boxShadow: 2
                    }}
                  >
                    {!displayedPhotoUrl && initials}
                  </Avatar>
                  {uploading && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <CircularProgress size={36} sx={{ color: '#fff' }} />
                    </Box>
                  )}
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={handleSelectPhoto}
                    disabled={uploading || saving}
                  >
                    {photo?.url ? 'Change' : 'Upload'}
                  </Button>
                  {photo?.url && (
                    <Tooltip title="Remove profile photo">
                      <span>
                        <IconButton
                          color="error"
                          onClick={handleRemovePhoto}
                          disabled={uploading || saving}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PROFILE_PHOTO.ALLOWED_TYPES.join(',')}
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />

                <Typography variant="caption" color="text.secondary" align="center">
                  JPEG / PNG / WebP, up to{' '}
                  {PROFILE_PHOTO.MAX_FILE_BYTES / (1024 * 1024)}MB.
                  <br />
                  Image is auto-cropped to {PROFILE_PHOTO.TARGET_DIMENSION}×
                  {PROFILE_PHOTO.TARGET_DIMENSION}px square.
                </Typography>
              </Stack>
            </Grid>

            {/* Form */}
            <Grid item xs={12} md={8}>
              <Stack spacing={2.5}>
                <TextField
                  label="Full name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  fullWidth
                  required
                  inputProps={{ maxLength: 100 }}
                  error={!!fieldErrors.name}
                  helperText={fieldErrors.name || ' '}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  fullWidth
                  required
                  inputProps={{ maxLength: 254 }}
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email || ' '}
                />
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  fullWidth
                  placeholder="+919876543210"
                  inputProps={{ maxLength: 16 }}
                  error={!!fieldErrors.phone}
                  helperText={fieldErrors.phone || 'Use international format. Leave blank to remove.'}
                />

                <Divider />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving || uploading}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile;
