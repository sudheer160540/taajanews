import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  TextField,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  Language as LanguageIcon,
  LocationCity as CityIcon,
  Place as PlaceIcon,
  MyLocation as MyLocationIcon,
  Search as SearchIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useLocation } from '../contexts/LocationContext';
import { languagesApi } from '../services/api';

const Onboarding = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    city,
    area,
    cities,
    areas,
    fetchCities,
    fetchAreas,
    selectCity,
    selectArea,
    detectLocation,
    isOnboardingComplete
  } = useLocation();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);

  const steps = [t('selectLanguage'), t('selectCity'), t('selectArea')];

  // Fetch languages from API
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await languagesApi.getAll();
        setLanguages(response.data.languages || []);
      } catch (err) {
        console.error('Failed to fetch languages:', err);
        // Fallback to default languages
        setLanguages([
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
        ]);
      } finally {
        setLanguagesLoading(false);
      }
    };
    loadLanguages();
  }, []);

  useEffect(() => {
    if (activeStep === 1 && cities.length === 0) {
      fetchCities();
    }
  }, [activeStep, cities.length, fetchCities]);

  useEffect(() => {
    if (activeStep === 2 && city && areas.length === 0) {
      fetchAreas(city._id);
    }
  }, [activeStep, city, areas.length, fetchAreas]);

  // Determine initial step based on existing selections
  useEffect(() => {
    if (city && area) {
      setActiveStep(2);
    } else if (city) {
      setActiveStep(2);
    }
  }, []);

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    setActiveStep(1);
  };

  const handleCitySelect = (selectedCity) => {
    selectCity(selectedCity);
    setActiveStep(2);
  };

  const handleAreaSelect = (selectedArea) => {
    selectArea(selectedArea);
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setError(null);
    try {
      await detectLocation();
      setActiveStep(2);
    } catch (err) {
      setError('Could not detect your location. Please select manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleComplete = () => {
    navigate('/');
  };

  const handleSkipArea = () => {
    navigate('/');
  };

  // Helper to get name for display (API returns localized name directly)
  const getDisplayName = (item) => {
    if (!item) return '';
    // If name is a string, return it directly (already localized by API)
    if (typeof item.name === 'string') return item.name;
    // If name is an object, try to get by current language or fallback
    if (typeof item.name === 'object') {
      return item.name[i18n.language] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  // Helper to get state for display
  const getDisplayState = (item) => {
    if (!item || !item.state) return '';
    if (typeof item.state === 'string') return item.state;
    if (typeof item.state === 'object') {
      return item.state[i18n.language] || item.state.te || item.state.en || Object.values(item.state)[0] || '';
    }
    return '';
  };

  // Search in multilingual field or direct name
  const searchInField = (item, fieldName, query) => {
    const lowerQuery = query.toLowerCase();
    // Check direct field (already localized)
    if (typeof item[fieldName] === 'string' && item[fieldName].toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // Check _multilingual object if available
    if (item._multilingual && item._multilingual[fieldName]) {
      const multiValues = Object.values(item._multilingual[fieldName]);
      return multiValues.some(v => v && v.toLowerCase().includes(lowerQuery));
    }
    // Check if field is an object with language keys
    if (typeof item[fieldName] === 'object' && item[fieldName]) {
      const values = Object.values(item[fieldName]);
      return values.some(v => v && v.toLowerCase().includes(lowerQuery));
    }
    return false;
  };

  const filteredCities = searchQuery
    ? cities.filter(c => searchInField(c, 'name', searchQuery) || searchInField(c, 'state', searchQuery))
    : cities;

  const filteredAreas = searchQuery
    ? areas.filter(a => searchInField(a, 'name', searchQuery) || (a.pincode && a.pincode.includes(searchQuery)))
    : areas;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        {/* Logo/Header */}
        <Box sx={{ textAlign: 'center', mb: 4, color: 'white' }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t('appName')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {t('welcomeDesc')}
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiStepLabel-label.Mui-active': { color: 'white' },
                  '& .MuiStepLabel-label.Mui-completed': { color: 'white' }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Step 1: Language Selection */}
            {activeStep === 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <LanguageIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">{t('selectLanguage')}</Typography>
                </Box>
                {languagesLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {languages.map((lang) => (
                      <Grid item xs={6} key={lang.code}>
                        <Button
                          variant={i18n.language === lang.code ? 'contained' : 'outlined'}
                          fullWidth
                          size="large"
                          onClick={() => handleLanguageSelect(lang.code)}
                          sx={{ py: 2, flexDirection: 'column' }}
                        >
                          <Typography variant="h6">{lang.nativeName}</Typography>
                          <Typography variant="caption" color="inherit">
                            {lang.name}
                          </Typography>
                        </Button>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}

            {/* Step 2: City Selection */}
            {activeStep === 1 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CityIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">{t('selectCity')}</Typography>
                </Box>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={detectingLocation ? <CircularProgress size={20} /> : <MyLocationIcon />}
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  sx={{ mb: 2 }}
                >
                  {detectingLocation ? t('loading') : t('detectLocation')}
                </Button>

                <TextField
                  fullWidth
                  placeholder={t('search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  sx={{ mb: 2 }}
                />

                {/* Featured Cities */}
                {!searchQuery && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      {t('popularCities') || 'Popular Cities'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {cities.filter(c => c.isFeatured).slice(0, 6).map((c) => (
                        <Chip
                          key={c._id}
                          label={getDisplayName(c)}
                          onClick={() => handleCitySelect(c)}
                          variant={city?._id === c._id ? 'filled' : 'outlined'}
                          color={city?._id === c._id ? 'primary' : 'default'}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {cities.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {filteredCities.map((c) => (
                      <ListItem key={c._id} disablePadding>
                        <ListItemButton
                          selected={city?._id === c._id}
                          onClick={() => handleCitySelect(c)}
                        >
                          <ListItemIcon>
                            <CityIcon color={city?._id === c._id ? 'primary' : 'inherit'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={getDisplayName(c)}
                            secondary={getDisplayState(c)}
                          />
                          {city?._id === c._id && <CheckIcon color="primary" />}
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {filteredCities.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary={t('noResults') || 'No results found'}
                          sx={{ textAlign: 'center', color: 'text.secondary' }}
                        />
                      </ListItem>
                    )}
                  </List>
                )}

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                </Box>
              </Box>
            )}

            {/* Step 3: Area Selection */}
            {activeStep === 2 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PlaceIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">{t('selectArea')}</Typography>
                </Box>

                {city && (
                  <Chip
                    label={getDisplayName(city)}
                    onDelete={() => { selectCity(null); setActiveStep(1); }}
                    sx={{ mb: 2 }}
                  />
                )}

                <TextField
                  fullWidth
                  placeholder={t('search') || 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  sx={{ mb: 2 }}
                />

                {areas.length === 0 && city ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List sx={{ maxHeight: 250, overflow: 'auto' }}>
                    {filteredAreas.map((a) => (
                      <ListItem key={a._id} disablePadding>
                        <ListItemButton
                          selected={area?._id === a._id}
                          onClick={() => handleAreaSelect(a)}
                        >
                          <ListItemIcon>
                            <PlaceIcon color={area?._id === a._id ? 'primary' : 'inherit'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={getDisplayName(a)}
                            secondary={a.pincode}
                          />
                          {area?._id === a._id && <CheckIcon color="primary" />}
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {filteredAreas.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary={t('noResults') || 'No areas found'}
                          sx={{ textAlign: 'center', color: 'text.secondary' }}
                        />
                      </ListItem>
                    )}
                  </List>
                )}

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => { setActiveStep(1); setSearchQuery(''); }}>
                    {t('back') || 'Back'}
                  </Button>
                  <Box>
                    <Button onClick={handleSkipArea} sx={{ mr: 1 }}>
                      {t('skip') || 'Skip'}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleComplete}
                      disabled={!city}
                    >
                      {t('getStarted') || 'Get Started'}
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Onboarding;
