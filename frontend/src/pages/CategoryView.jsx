import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Breadcrumbs,
  Skeleton,
  Pagination
} from '@mui/material';
import { NavigateNext as NavNextIcon, AccessTime as TimeIcon } from '@mui/icons-material';
import { categoriesApi, articlesApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';

const CategoryView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { city, area } = useLocation();
  const lang = i18n.language;

  const [category, setCategory] = useState(null);
  const [children, setChildren] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCategory();
  }, [slug]);

  useEffect(() => {
    if (category) {
      fetchArticles();
    }
  }, [category, page, city, area]);

  const fetchCategory = async () => {
    setLoading(true);
    try {
      const response = await categoriesApi.getBySlug(slug);
      setCategory(response.data.category);
      setChildren(response.data.children);
      setBreadcrumb(response.data.breadcrumb);
    } catch (err) {
      console.error('Failed to fetch category:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticles = async () => {
    try {
      const params = { 
        category: category._id, 
        lang, 
        page, 
        limit: 12 
      };
      if (city) params.city = city._id;
      if (area) params.area = area._id;

      const response = await articlesApi.getAll(params);
      setArticles(response.data.articles);
      setTotalPages(response.data.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width="40%" height={48} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (!category) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5">{t('noResults')}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          {t('home')}
        </Link>
        {breadcrumb.map((item, index) => (
          <Link
            key={item._id}
            to={`/category/${item.slug}`}
            style={{ 
              textDecoration: 'none', 
              color: index === breadcrumb.length - 1 ? 'inherit' : 'inherit'
            }}
          >
            {item.name?.[lang] || item.name?.en}
          </Link>
        ))}
      </Breadcrumbs>

      {/* Category Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          {category.name?.[lang] || category.name?.en}
        </Typography>
        {category.description?.[lang] && (
          <Typography variant="body1" color="text.secondary">
            {category.description[lang]}
          </Typography>
        )}
      </Box>

      {/* Subcategories */}
      {children.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {lang === 'hi' ? 'उप-श्रेणियां' : 'Subcategories'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {children.map((child) => (
              <Chip
                key={child._id}
                label={child.name?.[lang] || child.name?.en}
                onClick={() => navigate(`/category/${child.slug}`)}
                sx={{ 
                  bgcolor: child.color || 'primary.main',
                  color: 'white'
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {t('noResults')}
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {articles.map((article) => (
              <Grid item xs={12} sm={6} md={4} key={article._id}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea onClick={() => navigate(`/article/${article.slug}`)}>
                    {article.featuredImage?.url && (
                      <CardMedia
                        component="img"
                        height={180}
                        image={article.featuredImage.url}
                        alt={article.title}
                      />
                    )}
                    <CardContent>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          mb: 1
                        }}
                      >
                        {article.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          mb: 2
                        }}
                      >
                        {article.summary}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(article.publishedAt)} • {article.readingTime} {t('minRead')}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default CategoryView;
