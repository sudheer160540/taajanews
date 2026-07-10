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
  Checkbox,
  Autocomplete as MuiAutocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
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
  Close as CloseIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { articlesApi, categoriesApi, uploadApi, translateApi, paraphraseApi } from '../../services/api';
import languageService, { getLocalizedValue } from '../../services/languageService';
import { useAuth } from '../../contexts/AuthContext';

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canPublish, user } = useAuth();
  const isEditing = !!id;

  // Languages state
  const [languages, setLanguages] = useState([]);
  const [defaultLang, setDefaultLang] = useState('en');

  // Google Maps (New Places API)
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationInput, setLocationInput] = useState('');
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);

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
    audio: {},
    reporterName: '',
    source: 'Taaja News Network',
    sourceUrl: '',
    youtubeUrl: ''
  });
  const [generateAudio, setGenerateAudio] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState(null);
  const [langTab, setLangTab] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);

  // AI paraphrase wizard (Claude): 0 = paste, 1 = edit + photo, 2 = preview
  const [paraphraseOpen, setParaphraseOpen] = useState(false);
  const [paraphraseStep, setParaphraseStep] = useState(0);
  const [paraphraseInput, setParaphraseInput] = useState('');
  const [paraphrasing, setParaphrasing] = useState(false);
  const [paraphraseError, setParaphraseError] = useState(null);
  const [paraphraseDraft, setParaphraseDraft] = useState(null);
  const [paraphraseLangTab, setParaphraseLangTab] = useState(0);
  const [paraphraseImage, setParaphraseImage] = useState(null);
  const [paraphraseUploadingImage, setParaphraseUploadingImage] = useState(false);

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
          audio: audioObj,
          reporterName: articleData.reporterName || '',
          source: articleData.source || 'Taaja News Network',
          sourceUrl: articleData.sourceUrl || '',
          youtubeUrl: articleData.youtubeUrl || ''
        });

        // Set the location input display text
        if (loc?.formattedAddress) {
          setLocationInput(loc.formattedAddress);
        }
      }
    } catch (err) {
      setError('Failed to initialize editor');
      setErrorDetails([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setApiError = (err, fallbackMessage) => {
    const data = err?.response?.data;
    const message = data?.error || fallbackMessage || 'Something went wrong';
    const details = Array.isArray(data?.details) ? data.details : [];
    setError(message);
    setErrorDetails(details);
  };

  // Load Google Maps + new Places library
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!window.google?.maps) {
        if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
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

  const fetchLocationSuggestions = useCallback(async (input) => {
    if (!input || input.length < 3 || !mapsLoaded) {
      setLocationSuggestions([]);
      return;
    }
    try {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
      });
      setLocationSuggestions(suggestions || []);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setLocationSuggestions([]);
    }
  }, [mapsLoaded]);

  const handlePlaceSelect = useCallback(async (suggestion) => {
    if (!suggestion?.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      });
      const lat = place.location.lat();
      const lng = place.location.lng();

      let city = '', area = '', state = '', country = '', pincode = '';
      for (const comp of (place.addressComponents || [])) {
        const types = comp.types;
        if (types.includes('locality') || types.includes('administrative_area_level_2')) city = city || comp.longText;
        if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) area = area || comp.longText;
        if (types.includes('administrative_area_level_1')) state = comp.longText;
        if (types.includes('country')) country = comp.longText;
        if (types.includes('postal_code')) pincode = comp.longText;
      }

      const locationData = {
        type: 'Point',
        coordinates: [lng, lat],
        formattedAddress: place.formattedAddress || '',
        city, area, state, country, pincode,
        placeId: place.id || ''
      };

      setArticle(prev => ({ ...prev, location: locationData }));
      setLocationInput(place.formattedAddress || '');
      setLocationSuggestions([]);
      sessionTokenRef.current = null;
    } catch (err) {
      console.error('Place details error:', err);
    }
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
      setApiError(err, 'Failed to upload image');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleTranslate = async () => {
    setError(null);
    setErrorDetails([]);
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
      setErrorDetails([]);
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
      setApiError(err, 'Translation failed. Please try again.');
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  const PARAPHRASE_LANGS = ['te', 'hi', 'en'];
  const PARAPHRASE_LANG_LABELS = { te: 'Telugu', hi: 'Hindi', en: 'English' };

  const openParaphraseDialog = () => {
    setParaphraseStep(0);
    setParaphraseInput('');
    setParaphraseError(null);
    setParaphraseDraft(null);
    setParaphraseLangTab(0);
    setParaphraseImage(null);
    setParaphraseOpen(true);
  };

  // Step 1 -> 2: generate, then move to the edit + photo step
  const handleGenerateParaphrase = async () => {
    if (!paraphraseInput.trim()) {
      setParaphraseError('Paste an article to paraphrase first');
      return;
    }
    setParaphrasing(true);
    setParaphraseError(null);
    try {
      const response = await paraphraseApi.paraphrase(paraphraseInput.trim());
      setParaphraseDraft(response.data.paraphrased);
      setParaphraseLangTab(0);
      setParaphraseStep(1);
    } catch (err) {
      setParaphraseError(err?.response?.data?.error || 'Failed to paraphrase text');
    } finally {
      setParaphrasing(false);
    }
  };

  const handleParaphraseFieldChange = (lang, field, value) => {
    setParaphraseDraft(prev => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value }
    }));
  };

  // Reuses the same Azure-blob upload endpoint as the Featured Image field
  const handleParaphraseImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setParaphraseUploadingImage(true);
    setParaphraseError(null);
    try {
      const response = await uploadApi.uploadFile(file);
      setParaphraseImage({ url: response.data.blobUrl, alt: file.name });
    } catch (err) {
      setParaphraseError(err?.response?.data?.error || 'Failed to upload photo');
    } finally {
      setParaphraseUploadingImage(false);
    }
  };

  // Step 2 -> 3: preview step just switches panels, content is already in paraphraseDraft
  const handlePreviewParaphrase = () => setParaphraseStep(2);

  // Final step: writes Title/Summary/Content for every language + the photo into the real article form
  const handleApplyParaphrase = () => {
    if (!paraphraseDraft) return;
    setArticle(prev => {
      const updated = { title: { ...prev.title }, summary: { ...prev.summary }, content: { ...prev.content } };
      PARAPHRASE_LANGS.forEach(lang => {
        const segment = paraphraseDraft[lang];
        if (!segment) return;
        updated.title[lang] = segment.heading;
        updated.summary[lang] = segment.superlead;
        updated.content[lang] = segment.fullNews;
      });
      return {
        ...prev,
        ...updated,
        featuredImage: paraphraseImage || prev.featuredImage
      };
    });

    setSuccess('AI paraphrase applied to Title, Summary, Content and Featured Image');
    setParaphraseOpen(false);
  };

  // Validate that the URL is a well-formed YouTube link (allow empty since field is optional)
  const isValidYoutubeUrl = (url) => {
    if (!url) return true;
    return /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s]+$/i.test(url.trim());
  };

  // Extract the YouTube video ID from common URL formats for embed preview
  const getYoutubeEmbedId = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url.trim());
      const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        return id || null;
      }
      if (host === 'youtube.com') {
        if (u.pathname === '/watch') return u.searchParams.get('v');
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') {
          return parts[1] || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // saveMode: 'draft' | 'pending' | 'published'
  const handleSave = async (saveMode = 'draft') => {
    setError(null);
    setErrorDetails([]);
    setSuccess(null);

    if (!article.title[defaultLang]) {
      setError(`Title is required in the default language (${defaultLang})`);
      setErrorDetails([]);
      return;
    }
    if (!article.content[defaultLang]) {
      setError(`Content is required in the default language (${defaultLang})`);
      setErrorDetails([]);
      return;
    }

    if (article.youtubeUrl && !isValidYoutubeUrl(article.youtubeUrl)) {
      setError('Please enter a valid YouTube URL or leave it empty');
      return;
    }

    setSaving(true);

    try {
      const cleanMultilingual = (obj) => {
        const cleaned = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value && value.trim()) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      };

      const targetStatus = saveMode === 'draft' ? (article.status === 'published' ? article.status : 'draft') : saveMode;

      const articleData = {
        title: cleanMultilingual(article.title),
        summary: cleanMultilingual(article.summary),
        content: cleanMultilingual(article.content),
        tags: article.tags,
        status: targetStatus,
        isFeatured: article.isFeatured,
        isBreaking: article.isBreaking,
        reporterName: article.reporterName || '',
        source: article.source || 'Taaja News Network',
        sourceUrl: article.sourceUrl || '',
        youtubeUrl: (article.youtubeUrl || '').trim()
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
      setApiError(err, 'Failed to save article');
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

  // Reporters lose edit access on their own article once it has been published.
  // Sub-Editor / Chief-Editor / Admin can still edit after publish.
  const isReporterLockedOut =
    isEditing && user?.role === 'reporter' && article.status === 'published';

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
        {!isReporterLockedOut && (
          <>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<AutoAwesomeIcon />}
              onClick={openParaphraseDialog}
              disabled={saving}
            >
              Paraphrase with AI
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSave('draft')}
              disabled={saving}
            >
              {t('save')} {t('draft')}
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<PublishIcon />}
              onClick={() => handleSave('pending')}
              disabled={saving}
            >
              {saving ? t('loading') : 'Submit for Review'}
            </Button>
            {canPublish && (
              <Button
                variant="contained"
                color="success"
                startIcon={<PublishIcon />}
                onClick={() => handleSave('published')}
                disabled={saving}
              >
                {saving ? t('loading') : 'Publish'}
              </Button>
            )}
          </>
        )}
      </Box>

      {isReporterLockedOut && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This article has already been published. Reporters cannot edit a published article. Please contact a Sub-Editor or Chief Editor to make changes.
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => {
            setError(null);
            setErrorDetails([]);
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {error}
          </Typography>
          {errorDetails.length > 0 && (
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              {errorDetails.map((msg, idx) => (
                <Box component="li" key={`${idx}-${msg}`}>
                  <Typography variant="body2">{msg}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Alert>
      )}
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
                  multiline
                  rows={3}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                  helperText={`${(article.title[currentLang] || '').length} / 200`}
                  error={(article.title[currentLang] || '').length >= 200}
                  inputProps={{ maxLength: 200 }}
                  disabled={isReporterLockedOut}
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
                  rows={5}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                  helperText={`${(article.summary[currentLang] || '').length} / 500`}
                  error={(article.summary[currentLang] || '').length >= 500}
                  inputProps={{ maxLength: 500 }}
                  disabled={isReporterLockedOut}
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
                  disabled={isReporterLockedOut}
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
              {!isReporterLockedOut && (
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
              )}
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
                  {!isReporterLockedOut && (
                    <IconButton
                      sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'white' }}
                      onClick={() => handleChange('featuredImage', null)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                  disabled={uploading || isReporterLockedOut}
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
              
              <FormControl fullWidth margin="normal" disabled={isReporterLockedOut}>
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
                <MuiAutocomplete
                  freeSolo
                  disabled={isReporterLockedOut}
                  options={locationSuggestions}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return option?.placePrediction?.text?.text || '';
                  }}
                  filterOptions={(x) => x}
                  inputValue={locationInput}
                  onInputChange={(event, value, reason) => {
                    setLocationInput(value);
                    if (reason === 'input') {
                      if (debounceRef.current) clearTimeout(debounceRef.current);
                      debounceRef.current = setTimeout(() => fetchLocationSuggestions(value), 300);
                    }
                  }}
                  onChange={(event, value) => {
                    if (value && typeof value !== 'string') handlePlaceSelect(value);
                  }}
                  loading={!mapsLoaded}
                  noOptionsText="Type to search locations..."
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      size="small"
                      placeholder="Search for a location..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <LocationIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                        endAdornment: (
                          <>
                            {article.location && !isReporterLockedOut && (
                              <IconButton size="small" onClick={handleClearLocation}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />

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

          {/* Source */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Source
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Reporter Name"
                value={article.reporterName}
                onChange={(e) => handleChange('reporterName', e.target.value)}
                margin="dense"
                placeholder="Enter reporter name (manual)"
              />
              <TextField
                fullWidth
                size="small"
                label="Source Name"
                value={article.source}
                onChange={(e) => handleChange('source', e.target.value)}
                margin="dense"
                placeholder="Taaja News Network"
                disabled={isReporterLockedOut}
              />
              <TextField
                fullWidth
                size="small"
                label="Source URL"
                value={article.sourceUrl}
                onChange={(e) => handleChange('sourceUrl', e.target.value)}
                margin="dense"
                placeholder="https://example.com/original-article"
                type="url"
                disabled={isReporterLockedOut}
              />
            </CardContent>
          </Card>

          {/* YouTube Video (optional) */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                YouTube Video <Typography component="span" variant="caption" color="text.secondary">(optional)</Typography>
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="YouTube URL"
                value={article.youtubeUrl}
                onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                margin="dense"
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                type="url"
                error={!!article.youtubeUrl && !isValidYoutubeUrl(article.youtubeUrl)}
                helperText={
                  article.youtubeUrl && !isValidYoutubeUrl(article.youtubeUrl)
                    ? 'Enter a valid YouTube URL (youtube.com or youtu.be)'
                    : 'Paste a YouTube video link to embed it with the article'
                }
                inputProps={{ maxLength: 500 }}
                disabled={isReporterLockedOut}
              />

              {article.youtubeUrl && isValidYoutubeUrl(article.youtubeUrl) && getYoutubeEmbedId(article.youtubeUrl) && (
                <Box
                  sx={{
                    mt: 2,
                    position: 'relative',
                    width: '100%',
                    pt: '56.25%',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'grey.100'
                  }}
                >
                  <iframe
                    title="YouTube preview"
                    src={`https://www.youtube.com/embed/${getYoutubeEmbedId(article.youtubeUrl)}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0
                    }}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                  />
                </Box>
              )}
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
                  disabled={isReporterLockedOut}
                />
                <Button onClick={handleAddTag} disabled={isReporterLockedOut}>Add</Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {article.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={isReporterLockedOut ? undefined : () => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Paraphrase Wizard (Claude): paste -> edit + photo -> preview -> apply */}
      <Dialog open={paraphraseOpen} onClose={() => setParaphraseOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Paraphrase with AI
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Step {paraphraseStep + 1} of 3 — {['Paste article', 'Edit & add photo', 'Preview'][paraphraseStep]}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {paraphraseError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParaphraseError(null)}>
              {paraphraseError}
            </Alert>
          )}

          {/* Step 1: paste */}
          {paraphraseStep === 0 && (
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Paste the source article text"
              value={paraphraseInput}
              onChange={(e) => setParaphraseInput(e.target.value)}
              disabled={paraphrasing}
            />
          )}

          {/* Step 2: edit fields per language + photo */}
          {paraphraseStep === 1 && paraphraseDraft && (
            <Box>
              <Tabs value={paraphraseLangTab} onChange={(_, v) => setParaphraseLangTab(v)} sx={{ mb: 2 }}>
                {PARAPHRASE_LANGS.map(lang => (
                  <Tab key={lang} label={PARAPHRASE_LANG_LABELS[lang]} />
                ))}
              </Tabs>

              {(() => {
                const lang = PARAPHRASE_LANGS[paraphraseLangTab];
                const segment = paraphraseDraft[lang] || { heading: '', superlead: '', fullNews: '' };
                return (
                  <Box>
                    <TextField
                      fullWidth
                      label="Heading"
                      value={segment.heading}
                      onChange={(e) => handleParaphraseFieldChange(lang, 'heading', e.target.value)}
                      margin="dense"
                      inputProps={{ maxLength: 200 }}
                    />
                    <TextField
                      fullWidth
                      label="Superlead"
                      value={segment.superlead}
                      onChange={(e) => handleParaphraseFieldChange(lang, 'superlead', e.target.value)}
                      margin="dense"
                      multiline
                      rows={2}
                      inputProps={{ maxLength: 500 }}
                      helperText={`${segment.superlead.length} / 500`}
                    />
                    <TextField
                      fullWidth
                      label="Full Story"
                      value={segment.fullNews}
                      onChange={(e) => handleParaphraseFieldChange(lang, 'fullNews', e.target.value)}
                      margin="dense"
                      multiline
                      rows={8}
                      inputProps={{ maxLength: 10000 }}
                    />
                  </Box>
                );
              })()}

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Photo (used as Featured Image)</Typography>
              {paraphraseImage ? (
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <img src={paraphraseImage.url} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                  <IconButton
                    size="small"
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'white' }}
                    onClick={() => setParaphraseImage(null)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={paraphraseUploadingImage ? <CircularProgress size={20} /> : <UploadIcon />}
                  disabled={paraphraseUploadingImage}
                >
                  {paraphraseUploadingImage ? 'Uploading...' : 'Add Photo'}
                  <input type="file" hidden accept="image/*" onChange={handleParaphraseImageUpload} />
                </Button>
              )}
            </Box>
          )}

          {/* Step 3: preview */}
          {paraphraseStep === 2 && paraphraseDraft && (
            <Box>
              <Tabs value={paraphraseLangTab} onChange={(_, v) => setParaphraseLangTab(v)} sx={{ mb: 2 }}>
                {PARAPHRASE_LANGS.map(lang => (
                  <Tab key={lang} label={PARAPHRASE_LANG_LABELS[lang]} />
                ))}
              </Tabs>
              {(() => {
                const lang = PARAPHRASE_LANGS[paraphraseLangTab];
                const segment = paraphraseDraft[lang] || { heading: '', superlead: '', fullNews: '' };
                return (
                  <Box>
                    <Typography variant="h5" fontWeight={700} gutterBottom>{segment.heading}</Typography>
                    {paraphraseImage && (
                      <img
                        src={paraphraseImage.url}
                        alt=""
                        style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
                      />
                    )}
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>{segment.superlead}</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{segment.fullNews}</Typography>
                  </Box>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParaphraseOpen(false)} disabled={paraphrasing}>Cancel</Button>

          {paraphraseStep === 0 && (
            <Button
              variant="contained"
              startIcon={paraphrasing ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
              onClick={handleGenerateParaphrase}
              disabled={paraphrasing}
            >
              {paraphrasing ? 'Paraphrasing...' : 'Paraphrase'}
            </Button>
          )}

          {paraphraseStep === 1 && (
            <>
              <Button onClick={() => setParaphraseStep(0)}>Back</Button>
              <Button variant="contained" onClick={handlePreviewParaphrase}>Final Preview</Button>
            </>
          )}

          {paraphraseStep === 2 && (
            <>
              <Button onClick={() => setParaphraseStep(1)}>Back to Edit</Button>
              <Button variant="contained" onClick={handleApplyParaphrase}>Apply to Article</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArticleEditor;
