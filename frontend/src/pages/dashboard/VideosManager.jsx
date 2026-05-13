import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Chip,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  PlayCircleOutline as PlayIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { videosApi, uploadApi } from '../../services/api';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'published', label: 'Published', color: 'success' },
  { value: 'archived', label: 'Archived', color: 'warning' }
];

const INITIAL_FORM = {
  title: '',
  description: '',
  videoUrl: '',
  thumbnail: '',
  status: 'draft'
};

const normalizeYouTubeUrl = (raw) => (raw || '').trim();

const getYouTubeVideoId = (rawUrl) => {
  const urlStr = normalizeYouTubeUrl(rawUrl);
  if (!urlStr) return null;

  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return v;

      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }
  } catch {
    // ignore
  }

  return null;
};

const getYouTubeEmbedUrl = (rawUrl) => {
  const id = getYouTubeVideoId(rawUrl);
  return id ? `https://www.youtube.com/embed/${id}` : null;
};

const isYouTubeUrl = (rawUrl) => Boolean(getYouTubeVideoId(rawUrl));

const VideosManager = () => {
  const { t } = useTranslation();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await videosApi.getAll({});
      setVideos(response.data.videos);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (video = null) => {
    if (video) {
      setEditingVideo(video);
      setFormData({
        title: video.title || '',
        description: video.description || '',
        videoUrl: video.videoUrl || '',
        thumbnail: video.thumbnail || '',
        status: video.status || 'draft'
      });
    } else {
      setEditingVideo(null);
      setFormData(INITIAL_FORM);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVideo(null);
    setError(null);
  };

  const extractBlobName = (blobUrl) => {
    if (!blobUrl) return null;
    try {
      const url = new URL(blobUrl);
      const parts = url.pathname.split('/');
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  };

  const deleteBlobFromAzure = async (blobUrl) => {
    const blobName = extractBlobName(blobUrl);
    if (blobName) {
      try {
        await uploadApi.delete(blobName);
      } catch (err) {
        console.error('Failed to delete blob from Azure:', err);
      }
    }
  };

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingThumb(true);
    setError(null);
    try {
      if (formData.thumbnail) await deleteBlobFromAzure(formData.thumbnail);
      const response = await uploadApi.uploadFile(file);
      setFormData(prev => ({ ...prev, thumbnail: response.data.blobUrl }));
    } catch (err) {
      setError('Failed to upload thumbnail');
      console.error('Thumbnail upload error:', err);
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleRemoveVideo = async () => {
    setFormData(prev => ({ ...prev, videoUrl: '' }));
  };

  const handleRemoveThumb = async () => {
    await deleteBlobFromAzure(formData.thumbnail);
    setFormData(prev => ({ ...prev, thumbnail: '' }));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!normalizeYouTubeUrl(formData.videoUrl)) {
      setError('YouTube link is required');
      return;
    }
    if (!isYouTubeUrl(formData.videoUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    try {
      if (editingVideo) {
        await videosApi.update(editingVideo._id, formData);
        setSuccess('Video updated successfully');
      } else {
        await videosApi.create(formData);
        setSuccess('Video created successfully');
      }
      fetchVideos();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save video');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await videosApi.delete(id);
      setSuccess('Video deleted successfully');
      fetchVideos();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete video');
    }
  };

  const handlePreview = (url) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const getStatusChip = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    return <Chip label={opt.label} color={opt.color} size="small" />;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Manage Videos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Video
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Thumbnail</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">{t('loading')}</TableCell>
                </TableRow>
              ) : videos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No videos found</TableCell>
                </TableRow>
              ) : (
                videos.map((video) => (
                  <TableRow key={video._id}>
                    <TableCell>
                      {video.thumbnail ? (
                        <Box component="img" src={video.thumbnail} alt=""
                          sx={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 1 }} />
                      ) : (
                        <Box sx={{
                          width: 64, height: 40, bgcolor: 'grey.200', borderRadius: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <PlayIcon color="disabled" />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 300 }}>
                        {video.title}
                      </Typography>
                      {video.description && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>
                          {video.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{getStatusChip(video.status)}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDate(video.createdAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handlePreview(video.videoUrl)} title="Preview">
                        <PlayIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenDialog(video)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(video._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingVideo ? 'Edit Video' : 'Add Video'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            fullWidth
            label="Title *"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
          />

          <TextField
            fullWidth
            select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            margin="normal"
          >
            {STATUS_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          {/* YouTube Link */}
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="YouTube Link *"
              value={formData.videoUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
              margin="normal"
              required
              placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
              error={Boolean(formData.videoUrl) && !isYouTubeUrl(formData.videoUrl)}
              helperText="Paste a YouTube video link (youtube.com or youtu.be)."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {isYouTubeUrl(formData.videoUrl) && (
                      <>
                        <IconButton size="small" onClick={() => handlePreview(formData.videoUrl)} title="Preview">
                          <PlayIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          component="a"
                          href={normalizeYouTubeUrl(formData.videoUrl)}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in new tab"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {Boolean(formData.videoUrl) && (
                      <IconButton size="small" color="error" onClick={handleRemoveVideo} title="Clear">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </InputAdornment>
                )
              }}
            />
          </Box>

          {/* Thumbnail Upload */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Thumbnail (optional)</Typography>
            {formData.thumbnail ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src={formData.thumbnail} alt="Thumbnail"
                  sx={{ width: 80, height: 50, objectFit: 'cover', border: '1px solid #e0e0e0', borderRadius: 1 }} />
                <IconButton size="small" color="error" onClick={handleRemoveThumb}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                component="label"
                startIcon={uploadingThumb ? <CircularProgress size={18} /> : <UploadIcon />}
                disabled={uploadingThumb}
                size="small"
              >
                {uploadingThumb ? 'Uploading...' : 'Upload Thumbnail'}
                <input type="file" hidden accept="image/*" onChange={handleThumbnailUpload} />
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={uploadingThumb}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Video Preview
          <IconButton onClick={() => setPreviewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewUrl && (
            (() => {
              const embed = getYouTubeEmbedUrl(previewUrl);
              return embed ? (
                <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', bgcolor: '#000' }}>
                  <Box
                    component="iframe"
                    src={embed}
                    title="YouTube preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </Box>
              ) : (
                <Box
                  component="video"
                  controls
                  autoPlay
                  sx={{ width: '100%', maxHeight: '70vh', bgcolor: '#000' }}
                  src={previewUrl}
                />
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default VideosManager;
