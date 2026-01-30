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
  Tabs,
  Tab,
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
import { articlesApi, categoriesApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { city, area } = useLocation();
  const lang = i18n.language;

  const [articles, setArticles] = useState([]);
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Helper to get localized name from API response
  const getDisplayName = (item) => {
    if (!item) return '';
    // If name is a string, return it directly (already localized by API)
    if (typeof item.name === 'string') return item.name;
    // If name is an object with language keys
    if (typeof item.name === 'object' && item.name) {
      return item.name[lang] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  useEffect(() => {
    fetchData();
  }, [city, area, selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { lang, limit: 20 };
      if (city) params.city = city._id;
      if (area) params.area = area._id;
      if (selectedCategory !== 'all') params.category = selectedCategory;

      const [articlesRes, trendingRes, categoriesRes] = await Promise.all([
        articlesApi.getAll(params),
        articlesApi.getTrending({ limit: 5, lang }),
        categoriesApi.getAll({ parent: 'null', active: 'true' })
      ]);

      setArticles(articlesRes.data.articles);
      setTrendingArticles(trendingRes.data.articles);
      setCategories(categoriesRes.data.categories);
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
      <Box sx={{ p: 1, pt: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={article.category?.name?.[lang] || article.category?.name?.en}
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/category/${article.category?.slug}`);
          }}
        />
        <Button
          size="small"
          startIcon={<ReadIcon />}
          onClick={() => navigate(`/read/${article.slug}`)}
        >
          {lang === 'hi' ? 'पढ़ें' : 'Read'}
        </Button>
      </Box>
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

        {/* Category Tabs */}
        <Tabs
          value={selectedCategory}
          onChange={(_, value) => setSelectedCategory(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="all" label={lang === 'hi' ? 'सभी' : lang === 'te' ? 'అన్నీ' : 'All'} />
          {categories.map((category) => (
            <Tab
              key={category._id}
              value={category._id}
              label={getDisplayName(category)}
            />
          ))}
        </Tabs>

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
