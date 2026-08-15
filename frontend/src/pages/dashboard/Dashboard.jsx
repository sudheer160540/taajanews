import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Skeleton
} from '@mui/material';
import {
  Article as ArticleIcon,
  Visibility as ViewIcon,
  ThumbUp as LikeIcon,
  Add as AddIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import { articlesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Dashboard = () => {
  const { t, language, localizeField } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lang = language;

  const [stats, setStats] = useState({
    totalArticles: 0,
    totalViews: 0,
    totalLikes: 0,
    publishedArticles: 0
  });
  const [recentArticles, setRecentArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [lang]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, articlesRes] = await Promise.all([
        articlesApi.getStats(),
        articlesApi.getManaged({ limit: 5, lang })
      ]);

      const s = statsRes.data.stats;
      setStats({
        totalArticles: s.totalArticles || 0,
        publishedArticles: s.publishedArticles || 0,
        totalViews: s.totalViews || 0,
        totalLikes: s.totalLikes || 0
      });

      setRecentArticles(articlesRes.data.articles || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'success';
      case 'draft': return 'default';
      case 'pending': return 'warning';
      case 'archived': return 'error';
      default: return 'default';
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={700} color={color}>
              {loading ? <Skeleton width={60} /> : value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
          <Box sx={{
            bgcolor: `${color}.light`,
            p: 1.5,
            borderRadius: 2,
            color: `${color}.main`
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t('welcomeUser', { name: user?.name })}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboardOverview')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/dashboard/articles/new')}
        >
          {t('createArticle')}
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('myArticles')}
            value={stats.totalArticles}
            icon={<ArticleIcon fontSize="large" />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('published')}
            value={stats.publishedArticles}
            icon={<TrendingIcon fontSize="large" />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('views')}
            value={stats.totalViews.toLocaleString()}
            icon={<ViewIcon fontSize="large" />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('likes')}
            value={stats.totalLikes.toLocaleString()}
            icon={<LikeIcon fontSize="large" />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Recent Articles */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              {t('recentArticles')}
            </Typography>
            <Button size="small" onClick={() => navigate('/dashboard/articles')}>
              {t('viewAll')}
            </Button>
          </Box>

          {loading ? (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
              ))}
            </Box>
          ) : recentArticles.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {t('noArticlesYet')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => navigate('/dashboard/articles/new')}
                sx={{ mt: 2 }}
              >
                {t('createArticle')}
              </Button>
            </Box>
          ) : (
            <List>
              {recentArticles.map((article) => (
                <ListItem
                  key={article._id}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'grey.50',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'grey.100' }
                  }}
                  onClick={() => navigate(`/dashboard/articles/edit/${article._id}`)}
                >
                  <ListItemText
                    primary={
                      localizeField(article.title) ||
                      (typeof article.title === 'string' ? article.title : '') ||
                      t('versionUnavailable')
                    }
                    secondary={
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          <ViewIcon fontSize="inherit" /> {article.engagement?.views || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          <LikeIcon fontSize="inherit" /> {article.engagement?.likes || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(article.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={t(article.status) !== article.status ? t(article.status) : article.status}
                      size="small"
                      color={getStatusColor(article.status)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
