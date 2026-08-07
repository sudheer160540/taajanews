import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Grid,
  Chip,
  Skeleton,
  IconButton,
  Button,
  Paper,
  CardActionArea
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Visibility as ViewIcon,
  BookmarkBorder as BookmarkIcon,
  AutoStories as ReadIcon,
  PlayCircleFilled as PlayCircleFilledIcon
} from '@mui/icons-material';
import { articlesApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';
import { getYoutubeEmbedId } from '../utils/youtube';
import Seo from '../components/Seo';
import LazyImage from '../components/LazyImage';
import { buildWebSiteJsonLd } from '../utils/seo';

const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="240"%3E%3Crect fill="%23e8eef7" width="400" height="240"/%3E%3C/svg%3E';

const PlayBadgeOverlay = () => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}
  >
    <Box
      sx={{
        bgcolor: 'rgba(0,0,0,0.55)',
        borderRadius: '50%',
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <PlayCircleFilledIcon sx={{ fontSize: 40, color: 'white' }} />
    </Box>
  </Box>
);

/** One overlay tag only: featured story, breaking, or category — never two. */
const getSingleArticleTag = (article, t, { preferFeatured = false } = {}) => {
  if (preferFeatured || article.isFeatured) {
    return { label: t('featuredStory'), bg: '#F5B800', color: '#1a1a1a' };
  }
  if (article.isBreaking) {
    return { label: t('breakingNews'), bg: 'secondary.main', color: '#fff' };
  }
  if (article.category?.name) {
    const catColor = article.category.color || '#4875BC';
    return { label: article.category.name, bg: catColor, color: '#fff' };
  }
  return null;
};

const formatTimeAgo = (dateString, t) => {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return `1 ${t('minsAgo')}`;
  if (mins < 60) return `${mins} ${t('minsAgo')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t('hoursAgo')}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${t('daysAgo')}`;
};

const ArticleMetaRow = ({ article, t }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <TimeIcon sx={{ fontSize: 14, color: 'inherit', opacity: 0.85 }} />
      <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.9 }}>
        {formatTimeAgo(article.publishedAt, t)}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <ViewIcon sx={{ fontSize: 14, color: 'inherit', opacity: 0.85 }} />
      <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.9 }}>
        {article.engagement?.views ?? 0}
      </Typography>
    </Box>
  </Box>
);

const CategoryTag = ({ tag }) => {
  if (!tag) return null;
  return (
    <Chip
      label={tag.label}
      size="small"
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 2,
        height: 24,
        fontSize: '0.7rem',
        fontWeight: 700,
        bgcolor: tag.bg,
        color: tag.color,
        '& .MuiChip-label': { px: 1 }
      }}
    />
  );
};

const HeroFeaturedCard = ({ article, onNavigate, t }) => {
  const hasVideo = !!getYoutubeEmbedId(article.youtubeUrl);
  const imageUrl = article.featuredImage?.url || IMAGE_PLACEHOLDER;
  const tag = getSingleArticleTag(article, t, { preferFeatured: true });

  return (
    <CardActionArea
      onClick={() => onNavigate(article.slug)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'block',
        height: { xs: 280, sm: 340, md: 400 },
        boxShadow: '0 4px 16px rgba(72, 117, 188, 0.15)'
      }}
    >
      <LazyImage
        src={imageUrl}
        alt={article.title}
        eager
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {hasVideo && <PlayBadgeOverlay />}
      <CategoryTag tag={tag} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 45%, transparent 70%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          p: 2
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            color: '#fff',
            mb: 0.75,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {article.title}
        </Typography>
        {article.summary && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {article.summary}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <ArticleMetaRow article={article} t={t} />
          <BookmarkIcon sx={{ fontSize: 20, opacity: 0.9 }} />
        </Box>
      </Box>
    </CardActionArea>
  );
};

const HeroSideCard = ({ article, onNavigate, t }) => {
  const hasVideo = !!getYoutubeEmbedId(article.youtubeUrl);
  const imageUrl = article.featuredImage?.url || IMAGE_PLACEHOLDER;
  const tag = getSingleArticleTag(article, t);

  return (
    <CardActionArea
      onClick={() => onNavigate(article.slug)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'block',
        height: { xs: 180, md: 192 },
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        flex: 1
      }}
    >
      <LazyImage
        src={imageUrl}
        alt={article.title}
        eager
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {hasVideo && <PlayBadgeOverlay />}
      <CategoryTag tag={tag} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          p: 1.5
        }}
      >
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{
            color: '#fff',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {article.title}
        </Typography>
      </Box>
    </CardActionArea>
  );
};

const ArticleListRow = ({ article, onNavigate, t }) => {
  const hasVideo = !!getYoutubeEmbedId(article.youtubeUrl);
  const imageUrl = article.featuredImage?.url || IMAGE_PLACEHOLDER;

  return (
    <Paper
      elevation={0}
      className="article-list-row"
      sx={{
        display: 'flex',
        gap: 2,
        p: 1.5,
        mb: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#fff',
        transition: 'box-shadow 0.2s',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 110px',
        '&:hover': { boxShadow: '0 4px 12px rgba(72, 117, 188, 0.12)' }
      }}
    >
      <CardActionArea
        onClick={() => onNavigate(article.slug)}
        sx={{
          width: { xs: 100, sm: 140 },
          minWidth: { xs: 100, sm: 140 },
          height: { xs: 72, sm: 96 },
          borderRadius: 1.5,
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <LazyImage
            src={imageUrl}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {hasVideo && <PlayBadgeOverlay />}
        </Box>
      </CardActionArea>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography
          component="button"
          onClick={() => onNavigate(article.slug)}
          variant="subtitle1"
          fontWeight={700}
          sx={{
            textAlign: 'left',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'text.primary',
            p: 0,
            mb: 0.5,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            '&:hover': { color: 'primary.main' }
          }}
        >
          {article.title}
        </Typography>
        {article.summary && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1,
              display: { xs: 'none', sm: '-webkit-box' },
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {article.summary}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ color: 'text.secondary' }}>
            <ArticleMetaRow article={article} t={t} />
          </Box>
          <IconButton size="small" sx={{ color: 'primary.main' }} aria-label={t('bookmark')}>
            <BookmarkIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

const TrendingListItem = ({ article, rank, onNavigate, t }) => {
  const imageUrl = article.featuredImage?.url;

  return (
    <Box
      onClick={() => onNavigate(article.slug)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1.5,
        cursor: 'pointer',
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' }
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'secondary.main',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.85rem',
          flexShrink: 0
        }}
      >
        {rank}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            lineHeight: 1.4,
            mb: 0.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            '&:hover': { color: 'primary.main' }
          }}
        >
          {article.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTimeAgo(article.publishedAt, t)}
        </Typography>
      </Box>
      {imageUrl && (
        <LazyImage
          src={imageUrl}
          alt=""
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            objectFit: 'cover',
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' }
          }}
        />
      )}
    </Box>
  );
};

const SectionTitle = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
    <Box sx={{ width: 4, height: 28, bgcolor: 'primary.main', borderRadius: 1 }} />
    <Typography variant="h5" fontWeight={700} color="primary.main">
      {children}
    </Typography>
  </Box>
);

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { city, area, coordinates } = useLocation();
  const lang = i18n.language;

  const [articles, setArticles] = useState([]);
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });

  const goToArticle = (slug) => navigate(`/article/${slug}`);

  const getDisplayName = (item) => {
    if (!item) return '';
    if (typeof item.name === 'string') return item.name;
    if (typeof item.name === 'object' && item.name) {
      return item.name[lang] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  const getLocationCoords = () => {
    if (coordinates) return coordinates;
    if (area?.center?.coordinates) {
      return { lng: area.center.coordinates[0], lat: area.center.coordinates[1] };
    }
    if (area?.location?.coordinates) {
      return { lng: area.location.coordinates[0], lat: area.location.coordinates[1] };
    }
    if (city?.center?.coordinates) {
      return { lng: city.center.coordinates[0], lat: city.center.coordinates[1] };
    }
    if (city?.location?.coordinates) {
      return { lng: city.location.coordinates[0], lat: city.location.coordinates[1] };
    }
    if (city?.coordinates) {
      return { lat: city.coordinates.lat, lng: city.coordinates.lng };
    }
    return null;
  };

  useEffect(() => {
    fetchData();
  }, [city, area, coordinates, lang]);

  const fetchData = async () => {
    setLoading(true);
    setTrendingLoading(true);
    try {
      // Smaller first page on mobile for faster TTFB / paint on slow 4G
      const isNarrow = typeof window !== 'undefined' && window.innerWidth < 600;
      const feedParams = { lang, limit: isNarrow ? 10 : 16, page: 1 };
      const loc = getLocationCoords();
      if (loc) {
        feedParams.latitude = loc.lat;
        feedParams.longitude = loc.lng;
        feedParams.radiusKM = 50;
      }

      // Critical path: news feed only — unblock UI ASAP
      const articlesRes = await articlesApi.getFeed(feedParams);
      setArticles(articlesRes.data.articles || []);
      setPagination(articlesRes.data.pagination || { page: 1, hasMore: false });
      setLoading(false);

      // Secondary: trending after feed paints (non-blocking)
      articlesApi
        .getTrending({ limit: 5, lang })
        .then((trendingRes) => {
          setTrendingArticles(trendingRes.data.articles || []);
        })
        .catch((err) => {
          console.error('Failed to fetch trending:', err);
        })
        .finally(() => setTrendingLoading(false));
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setLoading(false);
      setTrendingLoading(false);
    }
  };

  const fetchMore = async () => {
    if (loadingMore || !pagination.hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pagination.page + 1;
      const isNarrow = typeof window !== 'undefined' && window.innerWidth < 600;
      const feedParams = { lang, limit: isNarrow ? 10 : 16, page: nextPage };
      const loc = getLocationCoords();
      if (loc) {
        feedParams.latitude = loc.lat;
        feedParams.longitude = loc.lng;
        feedParams.radiusKM = 50;
      }
      const articlesRes = await articlesApi.getFeed(feedParams);
      setArticles((prev) => [...prev, ...(articlesRes.data.articles || [])]);
      setPagination(articlesRes.data.pagination);
    } catch (err) {
      console.error('Failed to fetch more articles:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const heroArticle = articles[0];
  const sideArticles = articles.slice(1, 3);
  const listArticles = articles.slice(3);

  const homeSeoTitle =
    lang === 'te'
      ? 'తాజా వార్తలు — బ్రేకింగ్ & లోకల్ న్యూస్'
      : lang === 'hi'
        ? 'ताज़ा खबरें — ब्रेकिंग और स्थानीय समाचार'
        : 'Latest News — Breaking & Local Headlines';

  const homeSeoDescription =
    lang === 'te'
      ? 'తెలుగు, హిందీ, ఇంగ్లీష్‌లో తాజా వార్తలు. ఆంధ్రప్రదేశ్, తెలంగాణ మరియు భారతదేశం బ్రేకింగ్ న్యూస్ — Taaja News.'
      : lang === 'hi'
        ? 'ताज़ा खबरें तेलुगु, हिंदी और अंग्रेज़ी में। आंध्र प्रदेश, तेलंगाना और भारत की ब्रेकिंग न्यूज़ — Taaja News.'
        : 'Latest breaking news in Telugu, Hindi and English. Local headlines from Andhra Pradesh, Telangana and across India.';

  return (
    <Box sx={{ bgcolor: '#f8f9fc', pb: 4, minHeight: '100%' }}>
      <Seo
        title={homeSeoTitle}
        description={homeSeoDescription}
        path="/"
        lang={lang}
        jsonLd={buildWebSiteJsonLd()}
      />

      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        {city && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LocationIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {t('latestNews')}{' '}
              {lang === 'hi' ? '—' : lang === 'te' ? '—' : '—'}{' '}
              <strong>{area ? getDisplayName(area) : getDisplayName(city)}</strong>
            </Typography>
          </Box>
        )}

        {/* Featured hero grid */}
        {loading ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Skeleton variant="rounded" sx={{ height: { xs: 280, md: 400 } }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                <Skeleton variant="rounded" height={192} />
                <Skeleton variant="rounded" height={192} />
              </Box>
            </Grid>
          </Grid>
        ) : articles.length > 0 ? (
          <Grid container spacing={2} sx={{ mb: { xs: 3, md: 4 } }}>
            {heroArticle && (
              <Grid item xs={12} md={8}>
                <HeroFeaturedCard article={heroArticle} onNavigate={goToArticle} t={t} />
              </Grid>
            )}
            {sideArticles.length > 0 && (
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'row', md: 'column' },
                    gap: 2,
                    height: { md: heroArticle ? 400 : 'auto' }
                  }}
                >
                  {sideArticles.map((article) => (
                    <HeroSideCard key={article._id} article={article} onNavigate={goToArticle} t={t} />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        ) : null}

        {/* Feed + trending sidebar */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <SectionTitle>{t('latestNews')}</SectionTitle>

            {loading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" height={110} sx={{ mb: 1.5 }} />
                ))}
              </>
            ) : articles.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  {t('noResults')}
                </Typography>
              </Box>
            ) : (
              <>
                {listArticles.map((article) => (
                  <ArticleListRow key={article._id} article={article} onNavigate={goToArticle} t={t} />
                ))}
                {pagination.hasMore && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="large"
                      onClick={fetchMore}
                      disabled={loadingMore}
                      startIcon={loadingMore ? null : <ReadIcon />}
                    >
                      {loadingMore ? t('loading') || 'Loading...' : t('readMore')}
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#fff',
                position: { lg: 'sticky' },
                top: { lg: 88 }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingIcon sx={{ color: 'secondary.main' }} />
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  {t('trendingNews')}
                </Typography>
              </Box>

              {trendingLoading ? (
                [1, 2, 3].map((i) => <Skeleton key={i} height={72} sx={{ my: 1 }} />)
              ) : trendingArticles.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('noResults')}
                </Typography>
              ) : (
                trendingArticles.map((article, index) => (
                  <TrendingListItem
                    key={article._id}
                    article={article}
                    rank={index + 1}
                    onNavigate={goToArticle}
                    t={t}
                  />
                ))
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;
