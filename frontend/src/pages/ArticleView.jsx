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
  AccessTime as TimeIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  NavigateNext as NavNextIcon,
  Edit as EditIcon,
  PlayCircleFilled as PlayCircleFilledIcon
} from '@mui/icons-material';
import { articlesApi, engagementApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSSRData } from '../contexts/SSRDataContext';
import { v4 as uuidv4 } from 'uuid';
import { getYoutubeEmbedId, buildYoutubeEmbedUrl } from '../utils/youtube';
import Seo from '../components/Seo';
import { buildNewsArticleJsonLd, truncate, toAbsoluteUrl } from '../utils/seo';

const ArticleView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isEditor } = useAuth();
  const lang = i18n.language;

  // Data prefetched by the SSR server for this slug (null on client navigation).
  const seed = useSSRData(`article:${slug}`);
  const seededArticle = seed?.article && seed.article.slug === slug ? seed.article : null;

  const [article, setArticle] = useState(seededArticle);
  const [relatedArticles, setRelatedArticles] = useState(seededArticle ? seed.relatedArticles || [] : []);
  const [breadcrumb, setBreadcrumb] = useState(seededArticle ? seed.breadcrumb || [] : []);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(!seededArticle);
  const [engagement, setEngagement] = useState({ liked: false, disliked: false, bookmarked: false });
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  // Whether the user has tapped Play on the hero image. Reset on every
  // new article so navigating between stories doesn't keep an old iframe.
  const [playingVideo, setPlayingVideo] = useState(false);

  const sessionId = useRef(uuidv4());

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  const fetchArticle = async () => {
    // Keep the SSR-seeded content visible instead of flashing a skeleton.
    const hasSeed = article && article.slug === slug;
    if (!hasSeed) setLoading(true);
    setPlayingVideo(false);
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

  // Resolve the YouTube embed id ONCE, and only from a trusted, validated
  // helper. The raw `article.youtubeUrl` is never passed to iframe `src`.
  const youtubeEmbedId = getYoutubeEmbedId(article.youtubeUrl);
  const hasVideo = !!youtubeEmbedId;
  const hasImage = !!article.featuredImage?.url;
  const heroVisible = hasImage || (hasVideo && playingVideo);

  const seoDescription = truncate(article.summary || article.content, 160);
  const seoImage = article.featuredImage?.url || null;
  const authorName = article.reporterName || article.author?.name || 'Taaja News';
  const categoryName =
    typeof article.category?.name === 'string'
      ? article.category.name
      : article.category?.name?.[lang] || article.category?.name?.en;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Seo
        title={article.title}
        description={seoDescription}
        path={`/article/${article.slug}`}
        image={seoImage}
        type="article"
        lang={lang}
        jsonLd={buildNewsArticleJsonLd({
          title: article.title,
          description: seoDescription,
          url: toAbsoluteUrl(`/article/${article.slug}`),
          image: seoImage ? toAbsoluteUrl(seoImage) : undefined,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt || article.publishedAt,
          authorName,
          categoryName
        })}
      />
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

      {/* Hero: image with optional Play overlay, swapped for an embedded
          YouTube player when the user taps Play. */}
      {heroVisible && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            mb: 3,
            borderRadius: 2,
            overflow: 'hidden',
            // 16:9 aspect ratio when the iframe is active; falls back to the
            // image's natural-ish 400px height when only the photo is shown.
            ...(playingVideo && hasVideo
              ? { aspectRatio: '16 / 9', bgcolor: 'black' }
              : { height: 400 })
          }}
        >
          {playingVideo && hasVideo ? (
            <Box
              component="iframe"
              src={buildYoutubeEmbedUrl(youtubeEmbedId, { autoplay: true })}
              title={article.title || 'YouTube video'}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0
              }}
            />
          ) : (
            <>
              {hasImage && (
                <Box
                  component="img"
                  src={article.featuredImage.url}
                  alt={article.featuredImage.alt || article.title}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              )}
              {hasVideo && (
                <IconButton
                  aria-label={t('playVideo') || 'Play video'}
                  onClick={() => setPlayingVideo(true)}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    width: 72,
                    height: 72,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                  }}
                >
                  <PlayCircleFilledIcon sx={{ fontSize: 60 }} />
                </IconButton>
              )}
            </>
          )}
        </Box>
      )}

      {/* Article Header */}
      <Box sx={{ mb: 3 }}>
        {article.isBreaking && (
          <Chip label={t('breakingNews')} color="error" size="small" sx={{ mb: 2 }} />
        )}
        
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          {article.title}
        </Typography>

        <Typography
          variant="subtitle1"
          paragraph
          sx={{
            color: 'error.main',
            fontStyle: 'italic',
            fontFamily: 'Mallanna, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
            fontSize: { xs: '1.15rem', sm: '1.3rem' }
          }}
        >
          {`"${article.summary}"`}
        </Typography>

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
          {isEditor && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/dashboard/articles/edit/${article._id}`)}
            >
              Edit Article
            </Button>
          )}
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

      {/* Source Attribution */}
      {article.source && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Source:</strong>{' '}
            {article.sourceUrl ? (
              <Box
                component="a"
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {article.source}
              </Box>
            ) : (
              article.source
            )}
          </Typography>
        </Box>
      )}

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

      {/* Reporter (end of story) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4 }}>
        <Avatar src={article.author?.avatar} sx={{ bgcolor: 'primary.main' }}>
          {article.author?.name?.[0]}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>
            {article.reporterName?.trim() ? article.reporterName : article.author?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(article.publishedAt)}
          </Typography>
        </Box>
      </Box>

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
