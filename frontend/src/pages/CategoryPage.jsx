import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Container, Typography, Grid, Card, CardContent,
  CardMedia, CardActionArea, Chip, Skeleton, Button
} from '@mui/material';
import { AccessTime as TimeIcon, Visibility as ViewIcon, AutoStories as ReadIcon } from '@mui/icons-material';
import { articlesApi, categoriesApi } from '../services/api';

const CategoryPage = () => {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;

  const [articles, setArticles] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });

  const getDisplayName = (item) => {
    if (!item) return '';
    if (typeof item.name === 'string') return item.name;
    if (typeof item.name === 'object' && item.name) {
      return item.name[lang] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  useEffect(() => {
    if (slug) fetchCategoryArticles();
  }, [slug, lang]);

  const fetchCategoryArticles = async () => {
    setLoading(true);
    try {
      // First get the category details to find the _id
      const catRes = await categoriesApi.getAll({ lang });
      const cats = catRes.data.categories || [];
      const matchedCat = cats.find((c) => c.slug === slug);
      setCategory(matchedCat || null);

      // Fetch articles filtered by category _id
      const params = { lang, limit: 20, page: 1 };
      if (matchedCat?._id) params.category = matchedCat._id;

      const artRes = await articlesApi.getFeed(params);
      setArticles(artRes.data.articles || []);
      setPagination(artRes.data.pagination);
    } catch (err) {
      console.error('Failed to fetch category articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMore = async () => {
    if (loadingMore || !pagination.hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pagination.page + 1;
      const params = { lang, limit: 20, page: nextPage };
      if (category?._id) params.category = category._id;

      const artRes = await articlesApi.getFeed(params);
      setArticles((prev) => [...prev, ...(artRes.data.articles || [])]);
      setPagination(artRes.data.pagination);
    } catch (err) {
      console.error('Failed to fetch more articles:', err);
    } finally {
      setLoadingMore(false);
    }
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
            <Chip label={t('breakingNews')} color="error" size="small" sx={{ mb: 1 }} />
          )}
          <Typography
            variant={featured ? 'h6' : 'subtitle1'}
            fontWeight={600}
            gutterBottom
            sx={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
            }}
          >
            {article.title}
          </Typography>
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
        <Skeleton variant="text" width="100%" height={32} />
        <Skeleton variant="text" width="80%" height={32} />
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ pb: 4 }}>
      <Container sx={{ pt: 3 }}>
        {category && (
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {getDisplayName(category)}
          </Typography>
        )}

        <Grid container spacing={3}>
          {loading ? (
            <>
              <Grid item xs={12} md={8}><SkeletonCard featured /></Grid>
              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  {[1, 2].map((i) => <Grid item xs={12} key={i}><SkeletonCard /></Grid>)}
                </Grid>
              </Grid>
            </>
          ) : articles.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  {t('noResults')}
                </Typography>
              </Box>
            </Grid>
          ) : (
            <>
              {articles[0] && (
                <Grid item xs={12} md={8}>
                  <ArticleCard article={articles[0]} featured />
                </Grid>
              )}
              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  {articles.slice(1, 3).map((article) => (
                    <Grid item xs={12} key={article._id}>
                      <ArticleCard article={article} />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              {articles.slice(3).map((article) => (
                <Grid item xs={12} sm={6} md={3} key={article._id}>
                  <ArticleCard article={article} />
                </Grid>
              ))}

              {/* View More Button */}
              {pagination.hasMore && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={fetchMore}
                      disabled={loadingMore}
                      startIcon={loadingMore ? null : <ReadIcon />}
                    >
                      {loadingMore ? t('loading') || 'Loading...' : t('viewMore') || 'View More'}
                    </Button>
                  </Box>
                </Grid>
              )}
            </>
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default CategoryPage;
