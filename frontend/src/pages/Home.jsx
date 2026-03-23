import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Skeleton,
  IconButton,
  Button,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Visibility as ViewIcon,
  AutoStories as ReadIcon
} from '@mui/icons-material';
import { articlesApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { city, area, coordinates } = useLocation();
  const lang = i18n.language;

  const [articles, setArticles] = useState([]);
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const feedParams = { lang, limit: 20 };
      const loc = getLocationCoords();
      if (loc) {
        feedParams.latitude = loc.lat;
        feedParams.longitude = loc.lng;
        feedParams.radiusKM = 50;
      }

      const [articlesRes, trendingRes] = await Promise.all([
        articlesApi.getFeed(feedParams),
        articlesApi.getTrending({ limit: 5, lang })
      ]);

      setArticles(articlesRes.data.articles);
      setTrendingArticles(trendingRes.data.articles);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const ArticleCard = ({ article, featured = false }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={() => navigate(`/article/${article.slug}`)}>
        {article.featuredImage?.url && (
          <CardMedia
            component="img"
            height={featured ? 200 : 140}
            image={article.featuredImage.url}
            alt={article.title}
            sx={{ objectFit: 'cover' }}
          />
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          {article.isBreaking && (
            <Chip
              label={t('breakingNews')}
              color="error"
              size="small"
              sx={{ mb: 1 }}
            />
          )}
          <Typography
            variant={featured ? 'h6' : 'subtitle1'}
            fontWeight={600}
            gutterBottom
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {article.title}
          </Typography>
          {featured && article.summary && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                mb: 1
              }}
            >
              {article.summary}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimeIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {article.readingTime} {t('minRead')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ViewIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {article.engagement?.views || 0}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  const SkeletonCard = ({ featured = false }) => (
    <Card sx={{ height: '100%' }}>
      <Skeleton variant="rectangular" height={featured ? 200 : 140} />
      <CardContent>
        <Skeleton variant="text" width="30%" height={24} />
        <Skeleton variant="text" width="100%" height={32} />
        <Skeleton variant="text" width="80%" height={32} />
        {featured && <Skeleton variant="text" width="60%" />}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ pb: 4 }}>
      {/* Trending Section */}
      {trendingArticles.length > 0 && (
        <Box sx={{ bgcolor: 'primary.dark', color: 'white', py: 2, mb: 3 }}>
          <Container>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingIcon />
              <Typography variant="h6" fontWeight={600}>
                {t('trending')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
              {trendingArticles.map((article) => (
                <Card
                  key={article._id}
                  sx={{ minWidth: 280, maxWidth: 280, cursor: 'pointer' }}
                  onClick={() => navigate(`/article/${article.slug}`)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={600}
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {article.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(article.publishedAt)}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      <Container>
        {/* Location Indicator */}
        {city && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LocationIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {t('latestNews')} {lang === 'hi' ? 'से' : lang === 'te' ? 'నుండి' : 'from'}{' '}
              <strong>
                {area ? getDisplayName(area) : getDisplayName(city)}
              </strong>
            </Typography>
          </Box>
        )}

        {/* Articles Grid */}
        <Grid container spacing={3}>
          {loading ? (
            <>
              <Grid item xs={12} md={8}>
                <SkeletonCard featured />
              </Grid>
              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  {[1, 2].map((i) => (
                    <Grid item xs={12} key={i}>
                      <SkeletonCard />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <SkeletonCard />
                </Grid>
              ))}
            </>
          ) : articles.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  {t('noResults')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lang === 'hi' 
                    ? 'इस क्षेत्र में अभी कोई समाचार नहीं है' 
                    : 'No news available for this area yet'}
                </Typography>
              </Box>
            </Grid>
          ) : (
            <>
              {/* Featured Article */}
              {articles[0] && (
                <Grid item xs={12} md={8}>
                  <ArticleCard article={articles[0]} featured />
                </Grid>
              )}

              {/* Side articles */}
              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  {articles.slice(1, 3).map((article) => (
                    <Grid item xs={12} key={article._id}>
                      <ArticleCard article={article} />
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {/* Rest of articles */}
              {articles.slice(3).map((article) => (
                <Grid item xs={12} sm={6} md={3} key={article._id}>
                  <ArticleCard article={article} />
                </Grid>
              ))}
            </>
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;
