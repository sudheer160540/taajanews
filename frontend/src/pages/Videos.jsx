import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Avatar
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Close as CloseIcon,
  VideoLibrary as VideoIcon
} from '@mui/icons-material';
import { videosApi } from '../services/api';

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

const Videos = () => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const fetchVideos = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await videosApi.getPublic({ page: currentPage, limit: 12 });
      setVideos(response.data.videos || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(page);
  }, [fetchVideos, page]);

  const handlePageChange = (_, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          <VideoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Videos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Watch the latest video updates
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : videos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <VideoIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No videos available yet
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {videos.map((video) => (
              <Grid item xs={12} sm={6} md={4} key={video._id}>
                <Card sx={{ height: '100%', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                  <CardActionArea onClick={() => setSelectedVideo(video)}>
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        height={200}
                        image={video.thumbnail || '/video-placeholder.jpg'}
                        alt={video.title}
                        sx={{ objectFit: 'cover', bgcolor: 'grey.200' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(0,0,0,0.3)'
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 56, color: 'white', opacity: 0.9 }} />
                      </Box>
                    </Box>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
                        {video.title}
                      </Typography>
                      {video.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 1
                          }}
                        >
                          {video.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {video.createdBy && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar
                              src={video.createdBy.avatar}
                              sx={{ width: 24, height: 24, mr: 0.5, fontSize: 12 }}
                            >
                              {(video.createdBy.name || 'A')[0]}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              {video.createdBy.name}
                            </Typography>
                          </Box>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(video.createdAt)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}

      {/* Video Player Dialog */}
      <Dialog
        open={Boolean(selectedVideo)}
        onClose={() => setSelectedVideo(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedVideo && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" fontWeight={600} noWrap sx={{ mr: 2 }}>
                {selectedVideo.title}
              </Typography>
              <IconButton onClick={() => setSelectedVideo(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', bgcolor: 'black' }}>
                {(() => {
                  const embed = getYouTubeEmbedUrl(selectedVideo.videoUrl);
                  return embed ? (
                    <Box
                      component="iframe"
                      src={embed}
                      title={selectedVideo.title || 'YouTube video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 0
                      }}
                    />
                  ) : (
                    <video
                      src={selectedVideo.videoUrl}
                      controls
                      autoPlay
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  );
                })()}
              </Box>
              <Box sx={{ p: 2 }}>
                {selectedVideo.description && (
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {selectedVideo.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {selectedVideo.createdBy && (
                    <Chip
                      avatar={<Avatar src={selectedVideo.createdBy.avatar}>{(selectedVideo.createdBy.name || 'A')[0]}</Avatar>}
                      label={selectedVideo.createdBy.name}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(selectedVideo.createdAt)}
                  </Typography>
                </Box>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default Videos;
