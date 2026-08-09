import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Tab,
  Tabs,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Bookmark as BookmarkIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  LocationOn as LocationIcon,
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
  const [languages, setLanguages] = useState([]);
  const [currentLang, setCurrentLang] = useState(null);
  const [categories, setCategories] = useState([]);

  const currentPath = routerLocation.pathname;

  useEffect(() => {
    const CACHE_KEY = 'taaja_languages_v1';
    const CACHE_TTL = 10 * 60 * 1000;

    const loadLanguages = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL && Array.isArray(data)) {
            setLanguages(data);
            setCurrentLang(data.find((l) => l.code === i18n.language));
            return;
          }
        }
        const response = await languagesApi.getAll();
        const langs = response.data.languages || [];
        setLanguages(langs);
        setCurrentLang(langs.find((l) => l.code === i18n.language));
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: langs, ts: Date.now() }));
      } catch {
        setLanguages([
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
        ]);
      }
    };
    loadLanguages();
    // Languages list is language-agnostic; currentLang syncs via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentLang(languages.find(l => l.code === i18n.language));
  }, [i18n.language, languages]);

  useEffect(() => {
    const CACHE_KEY = `taaja_categories_${i18n.language}_v1`;
    const CACHE_TTL = 5 * 60 * 1000;

    const loadCategories = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL && Array.isArray(data)) {
            setCategories(data);
            return;
          }
        }
        const response = await categoriesApi.getAll({ lang: i18n.language });
        const cats = response.data.categories || [];
        setCategories(cats);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: cats, ts: Date.now() }));
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
  };

  const getLangIconSrc = (lang) => lang?.icon || lang?.flag || lang?.flagUrl || null;

  /** Short labels when no icon URL (code → display) */
  const LANG_SHORT_LABELS = {
    te: 'తె',
    en: 'En',
    hi: 'हि'
  };

  const getLangInitial = (lang) => {
    const code = lang?.code?.toLowerCase()?.split('-')[0];
    if (code && LANG_SHORT_LABELS[code]) {
      return LANG_SHORT_LABELS[code];
    }
    const label = lang?.nativeName || lang?.name || lang?.code || '';
    const chars = [...String(label).trim()];
    return chars.slice(0, 2).join('') || lang?.code?.[0]?.toUpperCase() || '?';
  };

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    await logout();
    navigate('/');
  };

  const activeCategorySlug = currentPath === '/'
    ? 'all'
    : currentPath.startsWith('/category/')
      ? currentPath.split('/category/')[1]
      : false;

  const handleCategoryClick = (slug) => {
    if (slug === 'all') {
      navigate('/');
    } else {
      navigate(`/category/${slug}`);
    }
  };

  const locationDisplay = (
    <Chip
      icon={<LocationIcon fontSize="small" />}
      label={city ? (area ? getDisplayName(area) : getDisplayName(city)) : 'Select Location'}
      size="small"
      onClick={() => navigate('/onboarding')}
      onDelete={city ? clearLocation : undefined}
      className={`site-header__location-chip${city ? '' : ' site-header__location-chip--placeholder'}`}
      sx={{
        bgcolor: 'rgba(72, 117, 188, 0.08)',
        color: 'primary.main',
        border: '1px solid',
        borderColor: 'primary.light',
        '& .MuiChip-icon': { color: 'primary.main' },
        '& .MuiChip-deleteIcon': { color: 'primary.main', opacity: 0.7 }
      }}
    />
  );

  const profileControl = isAuthenticated ? (
    <>
      <IconButton
        className="site-header__login"
        onClick={(e) => setUserMenuAnchor(e.currentTarget)}
        sx={{ ml: 0.5, color: 'primary.main' }}
      >
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
    <IconButton
      className="site-header__login"
      onClick={() => navigate('/auth/login')}
      aria-label={t('login')}
      sx={{ ml: 0.5, color: 'primary.main' }}
    >
      <PersonIcon />
    </IconButton>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top AppBar */}
      <AppBar
        position="sticky"
        elevation={0}
        className="site-header"
        sx={{
          bgcolor: '#fff',
          color: 'primary.main',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar disableGutters className="site-header__toolbar" sx={{ color: 'primary.main' }}>
          <Box className="site-header__inner">
            <Box
              className="site-header__brand"
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2, color: 'primary.main' }}
              onClick={() => navigate('/')}
              role="link"
              aria-label="Taaja News home"
            >
              <Box
                component="img"
                className="site-header__logo"
                src="/logo.png"
                alt="Taaja News"
                sx={{ width: 100, height: 80, borderRadius: '50%', objectFit: 'cover' }}
              />
              <Typography
                component="h1"
                className="site-header__brand-title"
                sx={{
                  m: 0,
                  display: 'none',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap'
                }}
              >
                <Box component="span" sx={{ color: 'primary.main' }}>TAAJA</Box>
                <Box component="span" sx={{ color: 'secondary.main', ml: '0.3em' }}>NEWS</Box>
              </Typography>
            </Box>

            <Box className="site-header__spacer" sx={{ flexGrow: 1 }} />

            <Box className="site-header__location">
              {locationDisplay}
            </Box>

            {languages.length > 0 && (
              <Box
                className="site-header__languages"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  ml: 1
                }}
                role="group"
                aria-label="Language"
              >
                {languages.map((lang) => {
                  const selected = i18n.language === lang.code;
                  const iconSrc = getLangIconSrc(lang);
                  const shortLabel = iconSrc ? '' : getLangInitial(lang);
                  const label = lang.nativeName || lang.name || lang.code;
                  const isWideLabel = shortLabel.length > 1;

                  return (
                    <Tooltip key={lang.code} title={label} arrow>
                      <IconButton
                        className="site-header__lang-btn"
                        size="small"
                        onClick={() => handleLanguageSelect(lang.code)}
                        aria-label={label}
                        aria-pressed={selected}
                        sx={{
                          minWidth: isWideLabel ? 36 : 32,
                          width: isWideLabel ? 'auto' : 32,
                          height: 32,
                          px: isWideLabel ? 0.5 : 0,
                          border: '2px solid',
                          borderColor: selected ? 'primary.main' : 'primary.light',
                          bgcolor: selected ? 'rgba(72, 117, 188, 0.15)' : 'transparent',
                          color: 'primary.main',
                          fontSize: isWideLabel ? '0.7rem' : '0.8rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          '&:hover': {
                            bgcolor: 'rgba(72, 117, 188, 0.1)'
                          }
                        }}
                      >
                        {iconSrc ? (
                          <Box
                            component="img"
                            src={iconSrc}
                            alt=""
                            sx={{ width: 20, height: 20, objectFit: 'contain', borderRadius: '50%' }}
                          />
                        ) : (
                          shortLabel
                        )}
                      </IconButton>
                    </Tooltip>
                  );
                })}
              </Box>
            )}

            <Box className="site-header__profile">
              {profileControl}
            </Box>
          </Box>
        </Toolbar>

        {/* Category Tabs Bar */}
        {categories.length > 0 && (
          <Box
            className="site-header__categories"
            sx={{ bgcolor: '#fff', borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Tabs
              value={activeCategorySlug || false}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 36,
                '& .MuiTab-root': {
                  color: 'text.secondary',
                  minHeight: 36,
                  py: 0,
                  px: 2,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  fontWeight: 500
                },
                '& .Mui-selected': { color: 'primary.main', fontWeight: 700 },
                '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
                '& .MuiTabs-scrollButtons': { color: 'primary.main' }
              }}
            >
              <Tab className="site-header__home-tab" value="all" label={currentLang?.code === 'hi' ? 'सभी' : currentLang?.code === 'te' ? 'అన్నీ' : 'All'} onClick={() => handleCategoryClick('all')}/>

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
