import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Category as CategoryIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Bookmark as BookmarkIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  LocationOn as LocationIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { languagesApi } from '../services/api';

const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { user, isAuthenticated, isReporter, logout } = useAuth();
  const { city, area, clearLocation } = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [langMenuAnchor, setLangMenuAnchor] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [currentLang, setCurrentLang] = useState(null);

  const currentPath = routerLocation.pathname;

  // Fetch available languages
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await languagesApi.getAll();
        const langs = response.data.languages || [];
        setLanguages(langs);
        // Find current language
        const current = langs.find(l => l.code === i18n.language);
        setCurrentLang(current);
      } catch (err) {
        console.error('Failed to fetch languages:', err);
        // Fallback
        setLanguages([
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
        ]);
      }
    };
    loadLanguages();
  }, [i18n.language]);

  // Update current language when i18n language changes
  useEffect(() => {
    const current = languages.find(l => l.code === i18n.language);
    setCurrentLang(current);
  }, [i18n.language, languages]);

  // Helper to get display name from city/area
  const getDisplayName = (item) => {
    if (!item) return '';
    // If name is a string, return it directly (already localized by API)
    if (typeof item.name === 'string') return item.name;
    // If name is an object with language keys
    if (typeof item.name === 'object' && item.name) {
      return item.name[i18n.language] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  const navItems = [
    { path: '/', label: t('home'), icon: <HomeIcon /> },
    { path: '/search', label: t('search'), icon: <SearchIcon /> },
    { path: '/bookmarks', label: t('bookmark'), icon: <BookmarkIcon />, requireAuth: true }
  ];

  const getNavValue = () => {
    if (currentPath === '/') return 0;
    if (currentPath === '/search') return 1;
    if (currentPath === '/bookmarks') return 2;
    return 0;
  };

  const handleNavChange = (_, newValue) => {
    const item = navItems[newValue];
    if (item.requireAuth && !isAuthenticated) {
      navigate('/auth/login');
    } else {
      navigate(item.path);
    }
  };

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    setLangMenuAnchor(null);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    await logout();
    navigate('/');
  };

  const locationDisplay = city ? (
    <Chip
      icon={<LocationIcon fontSize="small" />}
      label={area ? getDisplayName(area) : getDisplayName(city)}
      size="small"
      onClick={() => navigate('/onboarding')}
      sx={{ 
        bgcolor: 'rgba(255,255,255,0.2)', 
        color: 'white',
        '& .MuiChip-icon': { color: 'white' }
      }}
    />
  ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="sticky">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 700, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            {t('appName')}
          </Typography>

          {!isMobile && locationDisplay}

          {/* Language Selector */}
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
                <ListItemText 
                  primary={lang.nativeName} 
                  secondary={lang.name}
                />
              </MenuItem>
            ))}
          </Menu>

          {isAuthenticated ? (
            <>
              <IconButton
                color="inherit"
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              >
                <Avatar
                  src={user?.avatar}
                  sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
                >
                  {user?.name?.[0]}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                {isReporter && (
                  <MenuItem onClick={() => { setUserMenuAnchor(null); navigate('/dashboard'); }}>
                    <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
                    {t('dashboard')}
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setUserMenuAnchor(null); navigate('/bookmarks'); }}>
                  <ListItemIcon><BookmarkIcon fontSize="small" /></ListItemIcon>
                  {t('bookmark')}
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  {t('logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <IconButton color="inherit" onClick={() => navigate('/auth/login')}>
              <PersonIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Side Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 280 }} role="presentation">
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h6" fontWeight={700}>
              {t('appName')}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {t('tagline')}
            </Typography>
          </Box>

          {city && (
            <Box sx={{ p: 2 }}>
              <Chip
                icon={<LocationIcon />}
                label={`${getDisplayName(city)}${area ? ` • ${getDisplayName(area)}` : ''}`}
                onClick={() => { setDrawerOpen(false); navigate('/onboarding'); }}
                onDelete={clearLocation}
              />
            </Box>
          )}

          <Divider />

          <List>
            {navItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={currentPath === item.path}
                  onClick={() => {
                    setDrawerOpen(false);
                    if (item.requireAuth && !isAuthenticated) {
                      navigate('/auth/login');
                    } else {
                      navigate(item.path);
                    }
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Divider />

          <List>
            <ListItem>
              <ListItemIcon><LanguageIcon /></ListItemIcon>
              <ListItemText 
                primary={t('selectLanguage') || 'Select Language'}
                secondary={currentLang?.nativeName || i18n.language}
              />
            </ListItem>
            {languages.map((lang) => (
              <ListItem key={lang.code} disablePadding sx={{ pl: 2 }}>
                <ListItemButton 
                  selected={i18n.language === lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                >
                  <ListItemText 
                    primary={lang.nativeName} 
                    secondary={lang.name}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {isAuthenticated && (
            <>
              <Divider />
              <List>
                {isReporter && (
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => { setDrawerOpen(false); navigate('/dashboard'); }}>
                      <ListItemIcon><DashboardIcon /></ListItemIcon>
                      <ListItemText primary={t('dashboard')} />
                    </ListItemButton>
                  </ListItem>
                )}
                <ListItem disablePadding>
                  <ListItemButton onClick={handleLogout}>
                    <ListItemIcon><LogoutIcon /></ListItemIcon>
                    <ListItemText primary={t('logout')} />
                  </ListItemButton>
                </ListItem>
              </List>
            </>
          )}
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, pb: isMobile ? 8 : 0 }}>
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}
          elevation={3}
        >
          <BottomNavigation value={getNavValue()} onChange={handleNavChange} showLabels>
            {navItems.map((item, index) => (
              <BottomNavigationAction
                key={item.path}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};

export default MainLayout;
