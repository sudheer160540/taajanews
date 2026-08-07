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
  Tooltip,
  Button
} from '@mui/material';
import {
  Person as PersonIcon,
  Bookmark as BookmarkIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useCategoryTrail } from '../contexts/CategoryTrailContext';
import { categoriesApi, languagesApi } from '../services/api';
import Footer from '../components/Footer';

const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  const { user, isAuthenticated, isReporter, logout } = useAuth();
  const { city, area, clearLocation } = useLocation();
  const { pushCategory, clearTrail } = useCategoryTrail();

  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [currentLang, setCurrentLang] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

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
  }, []);

  useEffect(() => {
    setCurrentLang(languages.find((l) => l.code === i18n.language));
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
    te: 'తెలుగు',
    en: 'English',
    hi: 'हिन्दी'
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
    setCategoriesOpen(false);
    if (slug === 'all') {
      clearTrail();
      navigate('/');
      return;
    }

    const cat = categories.find((c) => c.slug === slug);
    pushCategory({
      _id: cat?._id,
      slug,
      name: cat ? getDisplayName(cat) : slug
    });
    navigate(`/category/${slug}`);
  };

  const goHome = () => {
    setCategoriesOpen(false);
    clearTrail();
    navigate('/');
  };

  const allCategoryLabel = currentLang?.code === 'hi' ? 'सभी' : currentLang?.code === 'te' ? 'అన్నీ' : 'All';

  const locationDisplay = (
    <Chip
      icon={<LocationIcon fontSize="small" />}
      label={city ? (area ? getDisplayName(area) : getDisplayName(city)) : 'Select Location'}
      size="small"
      onClick={() => navigate('/onboarding')}
      onDelete={city ? clearLocation : undefined}
      className={`site-header__location-chip${city ? '' : ' site-header__location-chip--placeholder'}`}
      sx={{
        width: '100%',
        maxWidth: '100%',
        justifyContent: 'center',
        bgcolor: 'rgba(72, 117, 188, 0.08)',
        color: 'primary.main',
        border: '1px solid',
        borderColor: 'primary.light',
        '& .MuiChip-label': {
          flex: 1,
          textAlign: 'center',
          fontWeight: 600
        },
        '& .MuiChip-icon': { color: 'primary.main' },
        '& .MuiChip-deleteIcon': { color: 'primary.main', opacity: 0.7 }
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden', maxWidth: '100vw' }}>
      {/* Top AppBar */}
      <AppBar
        position="sticky"
        elevation={0}
        className="site-header"
        sx={{
          bgcolor: '#fff',
          color: 'primary.main',
          borderBottom: '1px solid',
          borderColor: 'divider',
          overflowX: 'hidden',
          maxWidth: '100vw'
        }}
      >
        {/* Main header: top row (logo + brand) / sub row (location, langs, profile) */}
        <Toolbar
          disableGutters
          className="site-header__toolbar"
          sx={{
            color: 'primary.main',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            minHeight: 'auto',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}
        >
          <Box className="site-header__inner">
            {/* Row 1: logo + TAAJA NEWS */}
            <Box className="site-header__brand-row">
              <Box className="site-header__brand-group">
                <Box
                  className="site-header__logo-wrap"
                  onClick={goHome}
                  role="link"
                  aria-label="Taaja News home"
                  sx={{ cursor: 'pointer' }}
                >
                  <Box
                    component="img"
                    src="/logo-icon.png"
                    alt="Taaja News"
                    className="site-header__logo"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </Box>

                <Typography
                  component="h1"
                  className="site-header__brand-title"
                  onClick={goHome}
                  sx={{
                    m: 0,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 1,
                    minWidth: 0
                  }}
                >
                  <Box component="span" sx={{ color: 'primary.main' }}>TAAJA</Box>
                  <Box component="span" sx={{ color: 'secondary.main', ml: '0.35em' }}>NEWS</Box>
                </Typography>
              </Box>
            </Box>

            {/* Row 2: location + languages + login */}
            <Box className="site-header__actions">
              <Box className="site-header__actions-left">
                <Box className="site-header__location">
                  {locationDisplay}
                </Box>

                <Box className="site-header__langs-profile">
                  {languages.length > 0 && (
                    <Box
                      className="site-header__languages"
                      role="group"
                      aria-label="Language"
                    >
                      {languages.map((lang) => {
                        const selected = i18n.language === lang.code;
                        const iconSrc = getLangIconSrc(lang);
                        const shortLabel = iconSrc ? '' : getLangInitial(lang);
                        const label = lang.nativeName || lang.name || lang.code;
                        const isWideLabel = shortLabel.length > 1;
                        const isLongLabel = shortLabel.length > 3;
                        const langBtnClass = [
                          'site-header__lang-btn',
                          isLongLabel ? 'site-header__lang-btn--long' : '',
                          !isLongLabel && isWideLabel ? 'site-header__lang-btn--wide' : ''
                        ].filter(Boolean).join(' ');

                        return (
                          <Tooltip key={lang.code} title={label} arrow>
                            <IconButton
                              className={langBtnClass}
                              size="small"
                              onClick={() => handleLanguageSelect(lang.code)}
                              aria-label={label}
                              aria-pressed={selected}
                              sx={{
                                border: '2px solid',
                                borderColor: selected ? 'primary.main' : 'primary.light',
                                bgcolor: selected ? 'rgba(72, 117, 188, 0.15)' : 'transparent',
                                color: 'primary.main',
                                borderRadius: '50%',
                                ...(isWideLabel || isLongLabel
                                  ? { borderRadius: '999px' }
                                  : {}),
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
                </Box>

                <Box className="site-header__profile">
                  {isAuthenticated ? (
                    <>
                      <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} sx={{ color: 'primary.main' }}>
                        <Avatar src={user?.avatar} sx={{ bgcolor: 'secondary.main' }}>
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
                      sx={{ color: 'primary.main' }}
                    >
                      <PersonIcon />
                    </IconButton>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </Toolbar>

        {/* Categories / navigation row */}
        {categories.length > 0 && (
          <Box
            className="site-header__categories"
            sx={{
              bgcolor: '#fff',
              borderTop: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box className="site-header__categories-bar">
              <Button
                className="site-header__home-btn"
                variant={currentPath === '/' ? 'contained' : 'outlined'}
                color="primary"
                startIcon={<HomeIcon />}
                onClick={goHome}
                aria-current={currentPath === '/' ? 'page' : undefined}
                sx={{
                  fontWeight: currentPath === '/' ? 700 : 600
                }}
              >
                {t('home')}
              </Button>

              <Button
                className="site-header__categories-toggle"
                variant="outlined"
                color="primary"
                onClick={() => setCategoriesOpen((open) => !open)}
                endIcon={
                  <ExpandMoreIcon
                    sx={{
                      transition: 'transform 0.2s ease',
                      transform: categoriesOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  />
                }
                sx={{ fontWeight: 600 }}
              >
                {t('categories')}
              </Button>
            </Box>

            {categoriesOpen && (
              <Box className="site-header__categories-panel">
                <Chip
                  label={allCategoryLabel}
                  onClick={() => handleCategoryClick('all')}
                  color={activeCategorySlug === 'all' ? 'primary' : 'default'}
                  variant={activeCategorySlug === 'all' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: activeCategorySlug === 'all' ? 700 : 500 }}
                />

                {categories.map((cat) => (
                  <Chip
                    key={cat._id}
                    label={getDisplayName(cat)}
                    onClick={() => handleCategoryClick(cat.slug)}
                    color={activeCategorySlug === cat.slug ? 'primary' : 'default'}
                    variant={activeCategorySlug === cat.slug ? 'filled' : 'outlined'}
                    sx={{ fontWeight: activeCategorySlug === cat.slug ? 700 : 500 }}
                  />
                ))}
              </Box>
            )}
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
