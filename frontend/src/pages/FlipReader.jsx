import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HTMLFlipBook from 'react-pageflip';
import {
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Chip,
  CircularProgress,
  Fab,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ThumbUp as LikeIcon,
  ThumbUpOutlined as LikeOutlinedIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { articlesApi, engagementApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Page component for flip book
const Page = forwardRef(({ children, pageNumber }, ref) => (
  <div className="page" ref={ref}>
    <div className="page-content">
      {children}
    </div>
    <div style={{ 
      position: 'absolute', 
      bottom: 10, 
      right: 15, 
      fontSize: '12px', 
      color: '#999' 
    }}>
      {pageNumber}
    </div>
  </div>
));

Page.displayName = 'Page';

const FlipReader = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated } = useAuth();

  const flipBookRef = useRef(null);
  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [engagement, setEngagement] = useState({ liked: false, bookmarked: false });

  const lang = i18n.language;
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

      // Record view
      engagementApi.recordView(response.data.article._id, sessionId.current);

      // Get engagement status
      if (isAuthenticated) {
        const statusRes = await engagementApi.getStatus(response.data.article._id);
        setEngagement(statusRes.data.status);
      }
    } catch (err) {
      setError('Failed to load article');
      console.error(err);
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
      setEngagement(prev => ({ ...prev, liked: res.data.action === 'liked' }));
      setArticle(prev => ({
        ...prev,
        engagement: { ...prev.engagement, likes: res.data.likes }
      }));
    } catch (err) {
      console.error('Like failed:', err);
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
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const onPageFlip = useCallback((e) => {
    setCurrentPage(e.data);
  }, []);

  // Split content into pages
  const splitContentIntoPages = (content) => {
    if (!content) return [];
    
    const charsPerPage = isMobile ? 800 : 1500;
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const pages = [];
    let currentPageContent = '';

    paragraphs.forEach((paragraph) => {
      if ((currentPageContent + paragraph).length > charsPerPage && currentPageContent) {
        pages.push(currentPageContent.trim());
        currentPageContent = paragraph + '\n\n';
      } else {
        currentPageContent += paragraph + '\n\n';
      }
    });

    if (currentPageContent.trim()) {
      pages.push(currentPageContent.trim());
    }

    return pages;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  if (error || !article) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6">{error || 'Article not found'}</Typography>
        <IconButton onClick={() => navigate(-1)}>
          <BackIcon />
        </IconButton>
      </Box>
    );
  }

  const contentPages = splitContentIntoPages(article.content);
  const allPages = [
    // Cover page
    {
      type: 'cover',
      title: article.title,
      summary: article.summary,
      image: article.featuredImage?.url,
      author: article.author?.name,
      publishedAt: article.publishedAt,
      category: article.category
    },
    // Content pages
    ...contentPages.map((content, index) => ({
      type: 'content',
      content,
      pageNum: index + 1
    })),
    // End page with related articles
    {
      type: 'end',
      relatedArticles
    }
  ];

  const bookWidth = isMobile ? window.innerWidth - 32 : 500;
  const bookHeight = isMobile ? window.innerHeight - 150 : 650;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ color: 'white' }}>
          <IconButton color="inherit" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }} noWrap>
            {t('appName')}
          </Typography>
          <IconButton color="inherit" onClick={handleLike}>
            {engagement.liked ? <LikeIcon /> : <LikeOutlinedIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={handleBookmark}>
            {engagement.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={handleShare}>
            <ShareIcon />
          </IconButton>
          <IconButton color="inherit" onClick={toggleFullscreen}>
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Flip Book */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2
        }}
      >
        <HTMLFlipBook
          ref={flipBookRef}
          width={bookWidth}
          height={bookHeight}
          size="stretch"
          minWidth={300}
          maxWidth={600}
          minHeight={400}
          maxHeight={800}
          showCover={true}
          flippingTime={600}
          usePortrait={isMobile}
          startPage={0}
          drawShadow={true}
          maxShadowOpacity={0.5}
          mobileScrollSupport={true}
          onFlip={onPageFlip}
          onInit={() => setTotalPages(allPages.length)}
          style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
          className="flip-book"
        >
          {allPages.map((page, index) => (
            <Page key={index} pageNumber={index + 1}>
              {page.type === 'cover' && (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
                  {page.image && (
                    <Box
                      component="img"
                      src={page.image}
                      sx={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                        borderRadius: 2,
                        mb: 2
                      }}
                    />
                  )}
                  <Chip
                    label={page.category?.name?.[lang] || page.category?.name?.en}
                    size="small"
                    color="primary"
                    sx={{ alignSelf: 'flex-start', mb: 2 }}
                  />
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    {page.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {page.summary}
                  </Typography>
                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('by')} {page.author} • {new Date(page.publishedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              )}

              {page.type === 'content' && (
                <Box sx={{ height: '100%', p: 2, overflow: 'hidden' }}>
                  <Typography
                    variant="body1"
                    sx={{
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap',
                      fontSize: isMobile ? '0.95rem' : '1rem'
                    }}
                  >
                    {page.content}
                  </Typography>
                </Box>
              )}

              {page.type === 'end' && (
                <Box sx={{ height: '100%', p: 2 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('relatedArticles')}
                  </Typography>
                  {page.relatedArticles.map((related) => (
                    <Box
                      key={related._id}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        bgcolor: 'grey.100',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.200' }
                      }}
                      onClick={() => navigate(`/read/${related.slug}`)}
                    >
                      <Typography variant="subtitle2" fontWeight={500}>
                        {related.title?.[lang] || related.title?.en || related.title}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {t('appName')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('flipInstruction')}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Page>
          ))}
        </HTMLFlipBook>
      </Box>

      {/* Navigation Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          pb: 2,
          color: 'white'
        }}
      >
        <Fab
          size="small"
          onClick={() => flipBookRef.current?.pageFlip().flipPrev()}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
        >
          <PrevIcon />
        </Fab>
        <Typography variant="body2">
          {t('pageOf', { current: currentPage + 1, total: allPages.length })}
        </Typography>
        <Fab
          size="small"
          onClick={() => flipBookRef.current?.pageFlip().flipNext()}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
        >
          <NextIcon />
        </Fab>
      </Box>
    </Box>
  );
};

export default FlipReader;
