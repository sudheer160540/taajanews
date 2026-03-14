import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Tab,
  Tabs
} from '@mui/material';
import {
  Person as PersonIcon,
  Bookmark as BookmarkIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  LocationOn as LocationIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { categoriesApi, languagesApi } from '../services/api';
import Footer from '../components/Footer';

const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  const { user, isAuthenticated, isReporter, logout } = useAuth();
  const { city, area, clearLocation } = useLocation();

  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [langMenuAnchor, setLangMenuAnchor] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [currentLang, setCurrentLang] = useState(null);
  const [categories, setCategories] = useState([]);

  const currentPath = routerLocation.pathname;

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await languagesApi.getAll();
        const langs = response.data.languages || [];
        setLanguages(langs);
        setCurrentLang(langs.find(l => l.code === i18n.language));
      } catch {
        setLanguages([
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
        ]);
      }
    };
    loadLanguages();
  }, [i18n.language]);

  useEffect(() => {
    setCurrentLang(languages.find(l => l.code === i18n.language));
  }, [i18n.language, languages]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await categoriesApi.getAll({ lang: i18n.language });
        setCategories(response.data.categories || []);
      } catch {
        console.error('Failed to fetch categories');
      }
    };
    loadCategories();
  }, [i18n.language]);

  const getDisplayName = (item) => {
    if (!item) return '';
    if (typeof item.name === 'string') return item.name;
    if (typeof item.name === 'object' && item.name) {
      return item.name[i18n.language] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    setLangMenuAnchor(null);
  };

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    await logout();
    navigate('/');
  };

  const activeCategorySlug = currentPath.startsWith('/category/')
    ? currentPath.split('/category/')[1]
    : false;

  const handleCategoryClick = (slug) => {
    navigate(`/category/${slug}`);
  };

  const locationDisplay = (
    <Chip
      icon={<LocationIcon fontSize="small" />}
      label={city ? (area ? getDisplayName(area) : getDisplayName(city)) : 'Select Location'}
      size="small"
      onClick={() => navigate('/onboarding')}
      onDelete={city ? clearLocation : undefined}
      sx={{
        bgcolor: 'rgba(255,255,255,0.2)',
        color: 'white',
        '& .MuiChip-icon': { color: 'white' },
        '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top AppBar */}
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2 }}
            onClick={() => navigate('/')}
          >
            <Box
              component="img"
              src="/logo.png"
              alt="Taaja News"
              sx={{ width: 32, height: 32, borderRadius: '50%', mr: 1, objectFit: 'cover' }}
            />
            <Typography variant="h6" fontWeight={700} noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
              {t('appName')}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {locationDisplay}

          <Chip
            icon={<LanguageIcon fontSize="small" />}
            label={currentLang?.nativeName || i18n.language.toUpperCase()}
            size="small"
            onClick={(e) => setLangMenuAnchor(e.currentTarget)}
            sx={{
              ml: 1,
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              '& .MuiChip-icon': { color: 'white' },
              cursor: 'pointer'
            }}
          />
          <Menu
            anchorEl={langMenuAnchor}
            open={Boolean(langMenuAnchor)}
            onClose={() => setLangMenuAnchor(null)}
          >
            {languages.map((lang) => (
              <MenuItem
                key={lang.code}
                selected={i18n.language === lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                <ListItemText primary={lang.nativeName} secondary={lang.name} />
              </MenuItem>
            ))}
          </Menu>

          {isAuthenticated ? (
            <>
              <IconButton color="inherit" onClick={(e) => setUserMenuAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
                <Avatar src={user?.avatar} sx={{ width: 30, height: 30, bgcolor: 'secondary.main', fontSize: 14 }}>
                  {user?.name?.[0]}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                </MenuItem>
                <Divider />
                {isReporter && (
                  <MenuItem onClick={() => { setUserMenuAnchor(null); navigate('/dashboard'); }}>
                    <DashboardIcon fontSize="small" sx={{ mr: 1 }} />
                    {t('dashboard')}
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setUserMenuAnchor(null); navigate('/bookmarks'); }}>
                  <BookmarkIcon fontSize="small" sx={{ mr: 1 }} />
                  {t('bookmark')}
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  {t('logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <IconButton color="inherit" onClick={() => navigate('/auth/login')} sx={{ ml: 0.5 }}>
              <PersonIcon />
            </IconButton>
          )}
        </Toolbar>

        {/* Category Tabs Bar */}
        {categories.length > 0 && (
          <Box sx={{ bgcolor: 'primary.dark' }}>
            <Tabs
              value={activeCategorySlug || false}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 36,
                '& .MuiTab-root': {
                  color: 'rgba(255,255,255,0.7)',
                  minHeight: 36,
                  py: 0,
                  px: 2,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  fontWeight: 500
                },
                '& .Mui-selected': { color: '#fff' },
                '& .MuiTabs-indicator': { backgroundColor: '#fff' },
                '& .MuiTabs-scrollButtons': { color: 'rgba(255,255,255,0.7)' }
              }}
            >
              {categories.map((cat) => (
                <Tab
                  key={cat._id}
                  value={cat.slug}
                  label={getDisplayName(cat)}
                  onClick={() => handleCategoryClick(cat.slug)}
                />
              ))}
            </Tabs>
          </Box>
        )}
      </AppBar>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default MainLayout;
