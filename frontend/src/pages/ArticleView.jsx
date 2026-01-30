import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Breadcrumbs
} from '@mui/material';
import {
  ThumbUp as LikeIcon,
  ThumbUpOutlined as LikeOutlinedIcon,
  ThumbDown as DislikeIcon,
  ThumbDownOutlined as DislikeOutlinedIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  AutoStories as ReadIcon,
  AccessTime as TimeIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  NavigateNext as NavNextIcon
} from '@mui/icons-material';
import { articlesApi, engagementApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

const ArticleView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const lang = i18n.language;

  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState({ liked: false, disliked: false, bookmarked: false });
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const sessionId = useRef(uuidv4());

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const response = await articlesApi.getBySlug(slug, lang);
      setArticle(response.data.article);
      setRelatedArticles(response.data.relatedArticles || []);
      setBreadcrumb(response.data.breadcrumb || []);

      // Record view
      engagementApi.recordView(response.data.article._id, sessionId.current);

      // Fetch comments
      const commentsRes = await engagementApi.getComments(response.data.article._id);
      setComments(commentsRes.data.comments);

      // Get engagement status
      if (isAuthenticated) {
        const statusRes = await engagementApi.getStatus(response.data.article._id);
        setEngagement(statusRes.data.status);
      }
    } catch (err) {
      console.error('Failed to fetch article:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    try {
      const res = await engagementApi.like(article._id);
      setEngagement(prev => ({ 
        ...prev, 
        liked: res.data.action === 'liked',
        disliked: false
      }));
      setArticle(prev => ({
        ...prev,
        engagement: { 
          ...prev.engagement, 
          likes: res.data.likes,
          dislikes: res.data.dislikes
        }
      }));
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleDislike = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    try {
      const res = await engagementApi.dislike(article._id);
      setEngagement(prev => ({ 
        ...prev, 
        disliked: res.data.action === 'disliked',
        liked: false
      }));
      setArticle(prev => ({
        ...prev,
        engagement: { 
          ...prev.engagement, 
          likes: res.data.likes,
          dislikes: res.data.dislikes
        }
      }));
    } catch (err) {
      console.error('Dislike failed:', err);
    }
  };

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    try {
      const res = await engagementApi.bookmark(article._id);
      setEngagement(prev => ({ ...prev, bookmarked: res.data.action === 'bookmarked' }));
    } catch (err) {
      console.error('Bookmark failed:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: window.location.href
        });
        if (isAuthenticated) {
          engagementApi.share(article._id, 'native');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }

    setSubmittingComment(true);
    try {
      await engagementApi.addComment(article._id, { content: newComment });
      setNewComment('');
      // Refresh comments
      const commentsRes = await engagementApi.getComments(article._id);
      setComments(commentsRes.data.comments);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="text" width="60%" height={48} />
        <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Container>
    );
  }

  if (!article) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5">{t('noResults')}</Typography>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          {t('home')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          {t('home')}
        </Link>
        {breadcrumb.map((item, index) => (
          <Link
            key={item._id}
            to={`/category/${item.slug}`}
            style={{ 
              textDecoration: 'none', 
              color: index === breadcrumb.length - 1 ? 'primary' : 'inherit'
            }}
          >
            {item.name?.[lang] || item.name?.en}
          </Link>
        ))}
      </Breadcrumbs>

      {/* Featured Image */}
      {article.featuredImage?.url && (
        <Box
          component="img"
          src={article.featuredImage.url}
          alt={article.featuredImage.alt || article.title}
          sx={{
            width: '100%',
            height: 400,
            objectFit: 'cover',
            borderRadius: 2,
            mb: 3
          }}
        />
      )}

      {/* Article Header */}
      <Box sx={{ mb: 3 }}>
        {article.isBreaking && (
          <Chip label={t('breakingNews')} color="error" size="small" sx={{ mb: 2 }} />
        )}
        
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          {article.title}
        </Typography>

        <Typography variant="subtitle1" color="text.secondary" paragraph>
          {article.summary}
        </Typography>

        {/* Author and Meta */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar src={article.author?.avatar} sx={{ bgcolor: 'primary.main' }}>
            {article.author?.name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {article.author?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(article.publishedAt)}
            </Typography>
          </Box>
        </Box>

        {/* Stats and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimeIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {article.readingTime} {t('minRead')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ViewIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {article.engagement?.views} {t('views')}
            </Typography>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Button
            variant="contained"
            startIcon={<ReadIcon />}
            onClick={() => navigate(`/read/${slug}`)}
          >
            {lang === 'hi' ? 'फ्लिप रीडर में पढ़ें' : 'Read in Flip Reader'}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Article Content */}
      <Typography
        variant="body1"
        sx={{
          lineHeight: 1.8,
          '& p': { mb: 2 },
          whiteSpace: 'pre-wrap',
          fontSize: '1.1rem'
        }}
      >
        {article.content}
      </Typography>

      {/* Tags */}
      {article.tags?.length > 0 && (
        <Box sx={{ mt: 4, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {article.tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              size="small"
              variant="outlined"
              onClick={() => navigate(`/search?q=${tag}`)}
            />
          ))}
        </Box>
      )}

      {/* Engagement Actions */}
      <Box sx={{ 
        mt: 4, 
        p: 2, 
        bgcolor: 'grey.100', 
        borderRadius: 2,
        display: 'flex',
        justifyContent: 'center',
        gap: 2
      }}>
        <Button
          startIcon={engagement.liked ? <LikeIcon /> : <LikeOutlinedIcon />}
          onClick={handleLike}
          color={engagement.liked ? 'primary' : 'inherit'}
        >
          {article.engagement?.likes || 0}
        </Button>
        <Button
          startIcon={engagement.disliked ? <DislikeIcon /> : <DislikeOutlinedIcon />}
          onClick={handleDislike}
          color={engagement.disliked ? 'error' : 'inherit'}
        >
          {article.engagement?.dislikes || 0}
        </Button>
        <Button
          startIcon={engagement.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          onClick={handleBookmark}
          color={engagement.bookmarked ? 'primary' : 'inherit'}
        >
          {t('bookmark')}
        </Button>
        <Button startIcon={<ShareIcon />} onClick={handleShare}>
          {t('share')}
        </Button>
      </Box>

      {/* Comments Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {t('comments')} ({comments.length})
        </Typography>

        {/* Comment Input */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            fullWidth
            placeholder={t('addComment')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            multiline
            maxRows={4}
            size="small"
          />
          <IconButton
            color="primary"
            onClick={handleSubmitComment}
            disabled={submittingComment || !newComment.trim()}
          >
            <SendIcon />
          </IconButton>
        </Box>

        {/* Comments List */}
        {comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('noComments')}
          </Typography>
        ) : (
          <List>
            {comments.map((comment) => (
              <ListItem key={comment._id} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemAvatar>
                  <Avatar src={comment.user?.avatar} sx={{ width: 36, height: 36 }}>
                    {comment.user?.name?.[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{comment.user?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={comment.content}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('relatedArticles')}
          </Typography>
          <Grid container spacing={2}>
            {relatedArticles.map((related) => (
              <Grid item xs={12} sm={6} key={related._id}>
                <Card
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/article/${related.slug}`)}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {related.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(related.publishedAt)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Container>
  );
};

export default ArticleView;
