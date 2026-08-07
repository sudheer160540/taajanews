import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Skeleton,
  Pagination
} from '@mui/material';
import { AccessTime as TimeIcon } from '@mui/icons-material';
import { categoriesApi, articlesApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';
import { useCategoryTrail } from '../contexts/CategoryTrailContext';
import Seo from '../components/Seo';
import PageBreadcrumbs, { getBreadcrumbLabel } from '../components/PageBreadcrumbs';
import { truncate } from '../utils/seo';

const ArticleSkeletons = () => (
  <Grid container spacing={3}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Grid item xs={12} sm={6} md={4} key={i}>
        <Card sx={{ height: '100%' }}>
          <Skeleton variant="rectangular" height={180} />
          <CardContent>
            <Skeleton variant="text" width="90%" height={28} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="40%" sx={{ mt: 1 }} />
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

const CategoryView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { city, area } = useLocation();
  const { trail, pushCategory, truncateToSlug, clearTrail } = useCategoryTrail();
  const lang = i18n.language;

  const [category, setCategory] = useState(null);
  const [articles, setArticles] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const categoryRequestId = useRef(0);
  const articlesRequestId = useRef(0);

  const categorySynced = Boolean(category?.slug && category.slug === slug);

  // Load category for the current route slug
  useEffect(() => {
    let cancelled = false;
    const requestId = ++categoryRequestId.current;
    const requestedSlug = slug;

    setPage(1);
    setCategory(null);
    setArticles([]);
    setTotalPages(1);
    setCategoryLoading(true);
    setArticlesLoading(true);

    (async () => {
      try {
        const response = await categoriesApi.getBySlug(requestedSlug, lang);
        if (cancelled || requestId !== categoryRequestId.current) return;

        const nextCategory = response.data.category;
        if (nextCategory?.slug && nextCategory.slug !== requestedSlug) {
          setCategory(null);
          setArticlesLoading(false);
          return;
        }

        setCategory(nextCategory);
      } catch (err) {
        console.error('Failed to fetch category:', err);
        if (cancelled || requestId !== categoryRequestId.current) return;
        setCategory(null);
        setArticlesLoading(false);
      } finally {
        if (!cancelled && requestId === categoryRequestId.current) {
          setCategoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  // Keep accumulating trail in sync with the selected category (route + loaded name)
  useEffect(() => {
    if (!categorySynced || !category) return;

    const name = getBreadcrumbLabel(category, lang) || slug;
    pushCategory({
      _id: category._id,
      slug: category.slug,
      name
    });
  }, [categorySynced, category, lang, slug, pushCategory]);

  // Load articles for the synced category
  useEffect(() => {
    if (!categorySynced || !category?._id) return undefined;

    let cancelled = false;
    const requestId = ++articlesRequestId.current;

    setArticlesLoading(true);

    (async () => {
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
        if (cancelled || requestId !== articlesRequestId.current) return;

        setArticles(response.data.articles || []);
        setTotalPages(response.data.pagination?.pages || 1);
      } catch (err) {
        console.error('Failed to fetch articles:', err);
        if (cancelled || requestId !== articlesRequestId.current) return;
        setArticles([]);
        setTotalPages(1);
      } finally {
        if (!cancelled && requestId === articlesRequestId.current) {
          setArticlesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categorySynced, category, page, city, area, lang]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleTrailHome = () => {
    clearTrail();
    navigate('/');
  };

  const handleTrailCrumb = (item) => {
    truncateToSlug(item.slug);
    navigate(`/category/${item.slug}`);
  };

  if (categoryLoading || !categorySynced) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width="40%" height={48} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
        <ArticleSkeletons />
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

  const categoryName = getBreadcrumbLabel(category, lang) || slug;
  const categoryDescRaw =
    typeof category.description === 'string'
      ? category.description
      : category.description?.[lang] || category.description?.en || '';
  const categoryDescription = truncate(
    categoryDescRaw || `${categoryName} news — latest articles on Taaja News`,
    160
  );

  // Trail for breadcrumb — ensure current category is represented even if effect lags
  const crumbItems =
    trail.length > 0
      ? trail
      : [{ _id: category._id, slug: category.slug, name: categoryName }];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Seo
        title={`${categoryName} News`}
        description={categoryDescription}
        path={`/category/${slug}`}
        lang={lang}
      />

      <PageBreadcrumbs
        key={crumbItems.map((c) => c.slug).join('>')}
        items={crumbItems}
        lang={lang}
        homeLabel={t('home')}
        sx={{ mb: 3 }}
        onHomeClick={handleTrailHome}
        onCrumbClick={handleTrailCrumb}
      />

      {/* Category Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          {categoryName}
        </Typography>
        {categoryDescRaw && (
          <Typography variant="body1" color="text.secondary">
            {categoryDescRaw}
          </Typography>
        )}
      </Box>

      {articlesLoading ? (
        <ArticleSkeletons />
      ) : articles.length === 0 ? (
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
