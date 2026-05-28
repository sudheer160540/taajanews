import { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  TextField,
  Autocomplete as MuiAutocomplete
} from '@mui/material';
import {
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  MyLocation as MyLocationIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useLocation } from '../contexts/LocationContext';
import { languagesApi } from '../services/api';
import api from '../services/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const Onboarding = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    city,
    area,
    selectCity,
    selectArea,
    detectLocation,
    clearLocation
  } = useLocation();

  const [activeStep, setActiveStep] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [error, setError] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const sessionTokenRef = useRef(null);

  const steps = [t('selectLanguage'), t('selectCity') || 'Select Location'];

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await languagesApi.getAll();
        setLanguages(response.data.languages || []);
      } catch {
        setLanguages([
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'హిన్दी' }
        ]);
      } finally {
        setLanguagesLoading(false);
      }
    };
    loadLanguages();
  }, []);

  useEffect(() => {
    if (city) {
      setActiveStep(1);
    }
  }, []);

  // Load Google Maps JS + Places library
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!window.google?.maps) {
        if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
          script.async = true;
          document.head.appendChild(script);
        }
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (window.google?.maps) { clearInterval(check); resolve(); }
          }, 100);
        });
      }
      await google.maps.importLibrary('places');
      if (!cancelled) setMapsLoaded(true);
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const fetchSuggestions = useCallback(async (input) => {
    if (!input || input.length < 3 || !mapsLoaded) {
      setSuggestions([]);
      return;
    }
    try {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      const { suggestions: results } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
        includedPrimaryTypes: ['locality', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_3'],
        includedRegionCodes: ['in'],
      });
      setSuggestions(results || []);
    } catch {
      setSuggestions([]);
    }
  }, [mapsLoaded]);

  const handlePlaceSelect = useCallback(async (suggestion) => {
    if (!suggestion?.placePrediction) return;
    setResolvingPlace(true);
    setError(null);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      });
      const lat = place.location.lat();
      const lng = place.location.lng();

      let placeName = place.displayName || '';
      let placeAddress = place.formattedAddress || '';

      setSelectedPlace({ name: placeName, address: placeAddress, lat, lng });
      sessionTokenRef.current = null;

      // Use coordinates to find the nearest city/area in our database
      const [cityRes, areaRes] = await Promise.all([
        api.get('/locations/cities/nearby', { params: { lat, lng, limit: 1 } }),
        api.get('/locations/areas/nearby', { params: { lat, lng, limit: 1 } })
      ]);

      const nearestCity = cityRes.data.cities?.[0];
      const nearestArea = areaRes.data.areas?.[0];

      if (nearestCity) {
        selectCity(nearestCity);
        if (nearestArea) {
          selectArea(nearestArea);
        }
      } else {
        // No matching city in DB — store the Google Place info as a custom city
        selectCity({
          _id: `gplace_${Date.now()}`,
          name: placeName,
          state: placeAddress,
          coordinates: { lat, lng }
        });
      }
    } catch (err) {
      console.error('Place resolve error:', err);
      setError('Failed to resolve location. Please try again.');
    } finally {
      setResolvingPlace(false);
    }
  }, [selectCity, selectArea]);

  const handleLanguageSelect = (langCode) => {
    i18n.changeLanguage(langCode);
    setActiveStep(1);
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setError(null);
    try {
      const result = await detectLocation();
      if (result?.city) {
        setSelectedPlace({
          name: result.city.name || '',
          address: result.area?.name || '',
          lat: result.city.coordinates?.lat,
          lng: result.city.coordinates?.lng
        });
      }
    } catch {
      setError('Could not detect your location. Please search for it instead.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleComplete = () => {
    navigate('/');
  };

  const handleChangeLocation = () => {
    clearLocation();
    setSelectedPlace(null);
    setLocationInput('');
    setSuggestions([]);
  };

  const getDisplayName = (item) => {
    if (!item) return '';
    if (typeof item.name === 'string') return item.name;
    if (typeof item.name === 'object' && item.name) {
      return item.name[i18n.language] || item.name.te || item.name.en || Object.values(item.name)[0] || '';
    }
    return '';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4875BC 0%, #FF1424 100%)',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4, color: 'white' }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t('appName')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {t('welcomeDesc')}
          </Typography>
        </Box>

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

            {/* Step 2: Location via Google Places Autocomplete */}
            {activeStep === 1 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LocationIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">{t('selectCity') || 'Select Location'}</Typography>
                </Box>

                {/* Detect my location button */}
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={detectingLocation ? <CircularProgress size={20} /> : <MyLocationIcon />}
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  sx={{ mb: 2 }}
                >
                  {detectingLocation ? t('loading') : (t('detectLocation') || 'Detect My Location')}
                </Button>

                {/* Google Places Autocomplete */}
                {!mapsLoaded ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      Loading maps...
                    </Typography>
                  </Box>
                ) : (
                  <MuiAutocomplete
                    freeSolo
                    options={suggestions}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      return option?.placePrediction?.text?.text || '';
                    }}
                    filterOptions={(x) => x}
                    inputValue={locationInput}
                    onInputChange={(_, value) => {
                      setLocationInput(value);
                      fetchSuggestions(value);
                    }}
                    onChange={(_, value) => {
                      if (value && typeof value !== 'string') {
                        handlePlaceSelect(value);
                      }
                    }}
                    loading={resolvingPlace}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search for your city or area..."
                        variant="outlined"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: <LocationIcon color="action" sx={{ ml: 1, mr: 0.5 }} />,
                          endAdornment: (
                            <>
                              {resolvingPlace && <CircularProgress size={20} />}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option?.placePrediction?.placeId || Math.random()}>
                        <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2">
                            {option?.placePrediction?.structuredFormat?.mainText?.text || ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option?.placePrediction?.structuredFormat?.secondaryText?.text || ''}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Selected location display */}
                {city && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'success.light',
                      color: 'success.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CheckIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {getDisplayName(city)}
                        </Typography>
                        {area && (
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {getDisplayName(area)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleChangeLocation}
                      sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
                    >
                      Change
                    </Button>
                  </Box>
                )}

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setActiveStep(0)}>
                    {t('back') || 'Back'}
                  </Button>
                  <Box>
                    <Button onClick={() => navigate('/')} sx={{ mr: 1 }}>
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

        {/* Back to home link */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            onClick={() => navigate('/')}
            sx={{ color: 'rgba(255,255,255,0.8)' }}
          >
            ← Browse without location
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default Onboarding;
