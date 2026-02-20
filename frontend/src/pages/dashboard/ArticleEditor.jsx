import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Tabs,
  Tab,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Save as SaveIcon,
  Publish as PublishIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Star as StarIcon,
  Translate as TranslateIcon,
  LocationOn as LocationIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { articlesApi, categoriesApi, uploadApi, translateApi } from '../../services/api';
import languageService, { getLocalizedValue } from '../../services/languageService';

const LIBRARIES = ['places'];

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEditing = !!id;

  // Languages state
  const [languages, setLanguages] = useState([]);
  const [defaultLang, setDefaultLang] = useState('en');

  // Google Maps
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES
  });
  const autocompleteRef = useRef(null);
  const [locationInput, setLocationInput] = useState('');

  const [article, setArticle] = useState({
    title: {},
    summary: {},
    content: {},
    category: '',
    location: null,
    tags: [],
    status: 'draft',
    isFeatured: false,
    isBreaking: false,
    featuredImage: null,
    audio: {}
  });
  const [generateAudio, setGenerateAudio] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [langTab, setLangTab] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    initializeEditor();
  }, [id]);

  const initializeEditor = async () => {
    setLoading(true);
    try {
      // Fetch languages first
      const langs = await languageService.getLanguages();
      setLanguages(langs);
      
      const defLang = await languageService.getDefaultLanguageCode();
      setDefaultLang(defLang);

      // Initialize empty article with all languages
      const emptyMultilingual = {};
      langs.forEach(lang => {
        emptyMultilingual[lang.code] = '';
      });

      if (!isEditing) {
        setArticle(prev => ({
          ...prev,
          title: { ...emptyMultilingual },
          summary: { ...emptyMultilingual },
          content: { ...emptyMultilingual }
        }));
      }

      // Fetch categories
      const categoriesRes = await categoriesApi.getAll({ active: 'true', raw: 'true' });
      setCategories(categoriesRes.data.categories);

      // Fetch article if editing
      if (isEditing) {
        const response = await articlesApi.getById(id);
        const articleData = response.data.article;
        
        // Convert Map-like objects to plain objects with all languages
        const convertField = (field) => {
          const result = { ...emptyMultilingual };
          if (field) {
            Object.keys(field).forEach(key => {
              result[key] = field[key] || '';
            });
          }
          return result;
        };

        const loc = articleData.location || null;

        const audioData = articleData.audio || {};
        const audioObj = {};
        if (audioData instanceof Map || (typeof audioData === 'object' && audioData !== null)) {
          Object.entries(audioData).forEach(([k, v]) => { if (v) audioObj[k] = v; });
        }

        setArticle({
          title: convertField(articleData.title),
          summary: convertField(articleData.summary),
          content: convertField(articleData.content),
          category: articleData.category?._id || articleData.category || '',
          location: loc && loc.formattedAddress ? loc : null,
          tags: articleData.tags || [],
          status: articleData.status || 'draft',
          isFeatured: articleData.isFeatured || false,
          isBreaking: articleData.isBreaking || false,
          featuredImage: articleData.featuredImage || null,
          audio: audioObj
        });

        // Set the location input display text
        if (loc?.formattedAddress) {
          setLocationInput(loc.formattedAddress);
        }
      }
    } catch (err) {
      setError('Failed to initialize editor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Google Maps Autocomplete handlers
  const onAutocompleteLoad = useCallback((autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place.geometry) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();

    // Extract address components
    const getComponent = (types) => {
      const component = place.address_components?.find(c =>
        types.some(t => c.types.includes(t))
      );
      return component?.long_name || '';
    };

    const locationData = {
      type: 'Point',
      coordinates: [lng, lat],
      formattedAddress: place.formatted_address || '',
      city: getComponent(['locality', 'administrative_area_level_2']),
      area: getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']),
      state: getComponent(['administrative_area_level_1']),
      country: getComponent(['country']),
      pincode: getComponent(['postal_code']),
      placeId: place.place_id || ''
    };

    setArticle(prev => ({ ...prev, location: locationData }));
    setLocationInput(place.formatted_address || '');
  }, []);

  const handleClearLocation = () => {
    setArticle(prev => ({ ...prev, location: null }));
    setLocationInput('');
  };

  const handleChange = (field, value, lang = null) => {
    setArticle(prev => {
      if (lang) {
        return {
          ...prev,
          [field]: { ...prev[field], [lang]: value }
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !article.tags.includes(tagInput.trim().toLowerCase())) {
      setArticle(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setArticle(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Upload through backend (bypasses CORS)
      const response = await uploadApi.uploadFile(file);
      const { blobUrl } = response.data;

      // Set featured image
      setArticle(prev => ({
        ...prev,
        featuredImage: { url: blobUrl, alt: file.name }
      }));

      setSuccess('Image uploaded successfully');
    } catch (err) {
      setError('Failed to upload image');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleTranslate = async () => {
    setError(null);
    setSuccess(null);

    // Collect non-empty fields
    const getNonEmpty = (obj) => {
      const result = {};
      Object.entries(obj || {}).forEach(([lang, text]) => {
        if (text && text.trim()) result[lang] = text;
      });
      return result;
    };

    const titleInput = getNonEmpty(article.title);
    const summaryInput = getNonEmpty(article.summary);
    const contentInput = getNonEmpty(article.content);

    if (Object.keys(titleInput).length === 0 && Object.keys(summaryInput).length === 0 && Object.keys(contentInput).length === 0) {
      setError('Please enter content in at least one language before translating');
      return;
    }

    setTranslating(true);

    try {
      const payload = {};
      if (Object.keys(titleInput).length > 0) payload.title = titleInput;
      if (Object.keys(summaryInput).length > 0) payload.summary = summaryInput;
      if (Object.keys(contentInput).length > 0) payload.content = contentInput;

      if (generateAudio) payload.generateAudio = true;

      const response = await translateApi.translate(payload);
      const translated = response.data;

      setArticle(prev => {
        const updated = { ...prev };

        if (translated.title) {
          updated.title = { ...prev.title };
          Object.entries(translated.title).forEach(([lang, text]) => {
            if (!prev.title[lang] || !prev.title[lang].trim()) {
              updated.title[lang] = text;
            }
          });
        }

        if (translated.summary) {
          updated.summary = { ...prev.summary };
          Object.entries(translated.summary).forEach(([lang, text]) => {
            if (!prev.summary[lang] || !prev.summary[lang].trim()) {
              updated.summary[lang] = text;
            }
          });
        }

        if (translated.content) {
          updated.content = { ...prev.content };
          Object.entries(translated.content).forEach(([lang, text]) => {
            if (!prev.content[lang] || !prev.content[lang].trim()) {
              updated.content[lang] = text;
            }
          });
        }

        if (translated.audio) {
          updated.audio = { ...prev.audio, ...translated.audio };
        }

        return updated;
      });

      setSuccess(generateAudio ? 'Translation and audio generation completed' : 'Translation completed successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Translation failed. Please try again.');
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async (publish = false) => {
    setError(null);
    setSuccess(null);

    // Validation - only title and content are required
    if (!article.title[defaultLang]) {
      setError(`Title is required in the default language (${defaultLang})`);
      return;
    }
    if (!article.content[defaultLang]) {
      setError(`Content is required in the default language (${defaultLang})`);
      return;
    }
    // Summary, category, and featuredImage are optional

    setSaving(true);

    try {
      // Filter out empty language values
      const cleanMultilingual = (obj) => {
        const cleaned = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value && value.trim()) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      };

      const articleData = {
        title: cleanMultilingual(article.title),
        summary: cleanMultilingual(article.summary),
        content: cleanMultilingual(article.content),
        tags: article.tags,
        status: publish ? 'pending' : article.status,
        isFeatured: article.isFeatured,
        isBreaking: article.isBreaking
      };

      if (article.category) articleData.category = article.category;
      if (article.location) articleData.location = article.location;
      if (article.featuredImage?.url) articleData.featuredImage = article.featuredImage;
      if (article.audio && Object.keys(article.audio).length > 0) articleData.audio = article.audio;

      if (isEditing) {
        await articlesApi.update(id, articleData);
        setSuccess('Article updated successfully');
      } else {
        const response = await articlesApi.create(articleData);
        setSuccess('Article created successfully');
        navigate(`/dashboard/articles/edit/${response.data.article._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  // Check if language has content
  const hasContent = (lang) => {
    return article.title[lang] || article.summary[lang] || article.content[lang];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const currentLang = languages[langTab]?.code || defaultLang;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/dashboard/articles')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          {isEditing ? t('editArticle') : t('createArticle')}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {t('save')} {t('draft')}
        </Button>
        <Button
          variant="contained"
          startIcon={<PublishIcon />}
          onClick={() => handleSave(true)}
          disabled={saving}
        >
          {saving ? t('loading') : 'Submit for Review'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              {/* Dynamic Language Tabs */}
              <Tabs 
                value={langTab} 
                onChange={(_, v) => setLangTab(v)} 
                sx={{ mb: 3 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                {languages.map((lang, index) => (
                  <Tab
                    key={lang.code}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {lang.isDefault && <StarIcon fontSize="small" color="primary" />}
                        <span>{lang.nativeName}</span>
                        {!lang.isDefault && hasContent(lang.code) && (
                          <Chip label="filled" size="small" color="success" sx={{ height: 18 }} />
                        )}
                        {!lang.isDefault && !hasContent(lang.code) && (
                          <Chip label="optional" size="small" variant="outlined" sx={{ height: 18 }} />
                        )}
                      </Box>
                    }
                  />
                ))}
              </Tabs>

              {/* Content Fields for Current Language */}
              <Box>
                <TextField
                  fullWidth
                  label={`Title (${languages[langTab]?.name || 'English'})${languages[langTab]?.isDefault ? ' *' : ''}`}
                  value={article.title[currentLang] || ''}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) handleChange('title', e.target.value, currentLang);
                  }}
                  margin="normal"
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                  helperText={`${(article.title[currentLang] || '').length} / 200`}
                  error={(article.title[currentLang] || '').length >= 200}
                  inputProps={{ maxLength: 200 }}
                />
                <TextField
                  fullWidth
                  label={`Summary (${languages[langTab]?.name || 'English'})${languages[langTab]?.isDefault ? ' *' : ''}`}
                  value={article.summary[currentLang] || ''}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) handleChange('summary', e.target.value, currentLang);
                  }}
                  margin="normal"
                  multiline
                  rows={2}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                  helperText={`${(article.summary[currentLang] || '').length} / 500`}
                  error={(article.summary[currentLang] || '').length >= 500}
                  inputProps={{ maxLength: 500 }}
                />
                <TextField
                  fullWidth
                  label={`Content (${languages[langTab]?.name || 'English'})${languages[langTab]?.isDefault ? ' *' : ''}`}
                  value={article.content[currentLang] || ''}
                  onChange={(e) => {
                    if (e.target.value.length <= 10000) handleChange('content', e.target.value, currentLang);
                  }}
                  margin="normal"
                  multiline
                  rows={12}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                  helperText={`${(article.content[currentLang] || '').length} / 10,000`}
                  error={(article.content[currentLang] || '').length >= 10000}
                  inputProps={{ maxLength: 10000 }}
                />
              </Box>

              {/* Audio Preview */}
              {article.audio[currentLang] && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Audio ({languages[langTab]?.name || currentLang})
                  </Typography>
                  <audio controls style={{ width: '100%' }} src={article.audio[currentLang]}>
                    Your browser does not support audio playback.
                  </audio>
                </Box>
              )}

              {/* Translate Button + Audio Checkbox */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2, gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={generateAudio}
                      onChange={(e) => setGenerateAudio(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Convert to Audio"
                />
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={translating ? <CircularProgress size={20} /> : <TranslateIcon />}
                  onClick={handleTranslate}
                  disabled={translating || saving}
                >
                  {translating ? 'Translating...' : 'Translate to All Languages'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Featured Image */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Featured Image
              </Typography>
              {article.featuredImage?.url ? (
                <Box sx={{ position: 'relative' }}>
                  <img
                    src={article.featuredImage.url}
                    alt="Featured"
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                  <IconButton
                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'white' }}
                    onClick={() => handleChange('featuredImage', null)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Category & Location */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Category & Location
              </Typography>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Category</InputLabel>
                <Select
                  value={article.category}
                  label="Category"
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {getLocalizedValue(cat.name, defaultLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Google Maps Location Autocomplete */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Location
                </Typography>
                {mapsLoaded ? (
                  <Autocomplete
                    onLoad={onAutocompleteLoad}
                    onPlaceChanged={onPlaceChanged}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search for a location..."
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      InputProps={{
                        startAdornment: <LocationIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                        endAdornment: article.location ? (
                          <IconButton size="small" onClick={handleClearLocation}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        ) : null
                      }}
                    />
                  </Autocomplete>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Loading maps..."
                    disabled
                  />
                )}

                {/* Show selected location details */}
                {article.location && (
                  <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {article.location.area && (
                      <Chip size="small" label={article.location.area} variant="outlined" />
                    )}
                    {article.location.city && (
                      <Chip size="small" label={article.location.city} variant="outlined" />
                    )}
                    {article.location.state && (
                      <Chip size="small" label={article.location.state} variant="outlined" />
                    )}
                    {article.location.pincode && (
                      <Chip size="small" label={article.location.pincode} variant="outlined" />
                    )}
                    {article.location.country && (
                      <Chip size="small" label={article.location.country} variant="outlined" />
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Add tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag}>Add</Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {article.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ArticleEditor;
