import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Skeleton,
  Pagination,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  AccessTime as TimeIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { articlesApi, categoriesApi, engagementApi } from '../services/api';
import { useLocation } from '../contexts/LocationContext';

const Search = ({ bookmarks = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { city, area } = useLocation();
  const lang = i18n.language;

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (bookmarks) {
      fetchBookmarks();
    } else {
      fetchArticles();
    }
  }, [query, page, selectedCategory, city, area, bookmarks]);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll({ parent: 'null', active: 'true' });
      setCategories(response.data.categories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = { lang, page, limit: 12 };
      if (query) params.search = query;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (city) params.city = city._id;
      if (area) params.area = area._id;

      const response = await articlesApi.getAll(params);
      setArticles(response.data.articles);
      setTotalPages(response.data.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const response = await engagementApi.getBookmarks({ lang, page, limit: 12 });
      setArticles(response.data.articles);
      setTotalPages(response.data.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchParams(query ? { q: query } : {});
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {bookmarks ? t('bookmark') : t('search')}
      </Typography>

      {/* Search Input */}
      {!bookmarks && (
        <Box component="form" onSubmit={handleSearch} sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder={lang === 'hi' ? 'समाचार खोजें...' : 'Search news...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
        </Box>
      )}

      {/* Category Filter */}
      {!bookmarks && (
        <Tabs
          value={selectedCategory}
          onChange={(_, value) => { setSelectedCategory(value); setPage(1); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="all" label={lang === 'hi' ? 'सभी' : 'All'} />
          {categories.map((category) => (
            <Tab
              key={category._id}
              value={category._id}
              label={category.name[lang] || category.name.en}
            />
          ))}
        </Tabs>
      )}

      {/* Results */}
      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card>
                <Skeleton variant="rectangular" height={180} />
                <CardContent>
                  <Skeleton variant="text" height={32} />
                  <Skeleton variant="text" width="60%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : articles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {t('noResults')}
          </Typography>
          {query && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {lang === 'hi' 
                ? `"${query}" के लिए कोई परिणाम नहीं मिला` 
                : `No results found for "${query}"`}
            </Typography>
          )}
        </Box>
      ) : (
        <>
          {query && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {lang === 'hi' 
                ? `"${query}" के लिए ${articles.length} परिणाम` 
                : `${articles.length} results for "${query}"`}
            </Typography>
          )}

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
                      {article.category && (
                        <Chip
                          label={article.category?.name?.[lang] || article.category?.name?.en}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                      )}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(article.publishedAt)}
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

export default Search;
