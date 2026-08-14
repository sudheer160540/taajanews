import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
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
  DialogActions,
  Divider
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
import { articlesApi, categoriesApi, uploadApi, translateApi, usersApi } from '../../services/api';
import languageService, { getLocalizedValue } from '../../services/languageService';
import { useAuth } from '../../contexts/AuthContext';

const FEATURED_IMAGE_VARIANTS = {
  web: { label: 'Website', width: 800, height: 700, aspect: 800 / 700 },
  app: { label: 'App / Mobile', width: 750, height: 750, aspect: 1 }
};
const SUPPORTED_CROP_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canPublish, user, isEditor } = useAuth();
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
    author: user?._id || '',
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
  const [articleAuthors, setArticleAuthors] = useState([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState(null);
  const [langTab, setLangTab] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageFile, setCropImageFile] = useState(null);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropVariant, setCropVariant] = useState('web');
  const [variantCrops, setVariantCrops] = useState({ web: null, app: null });
  const [translating, setTranslating] = useState(false);
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [translatePreview, setTranslatePreview] = useState(null);
  const [translatePreviewTab, setTranslatePreviewTab] = useState(0);
  const [translateError, setTranslateError] = useState(null);
  const [teluguInputText, setTeluguInputText] = useState('');

  useEffect(() => {
    initializeEditor();
  }, [id]);

  useEffect(() => () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
  }, [cropImageUrl]);

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
          content: { ...emptyMultilingual },
          author: prev.author || user?._id || ''
        }));
      }

      // Fetch categories
      const categoriesRes = await categoriesApi.getAll({ active: 'true', raw: 'true' });
      setCategories(categoriesRes.data.categories);

      setAuthorsLoading(true);
      const authorsRes = await usersApi.getArticleAuthors();
      setArticleAuthors(authorsRes.data.users || []);
      setAuthorsLoading(false);

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
          author: articleData.author?._id || articleData.author || user?._id || '',
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
      setAuthorsLoading(false);
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setErrorDetails([]);
    setSuccess(null);

    if (!SUPPORTED_CROP_IMAGE_TYPES.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image');
      return;
    }

    setCropImageFile(file);
    setCropImageUrl(URL.createObjectURL(file));
    setCropVariant('web');
    setVariantCrops({ web: null, app: null });
    setCropDialogOpen(true);
  };

  const handleCropImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrops = Object.fromEntries(
      Object.entries(FEATURED_IMAGE_VARIANTS).map(([name, variant]) => [
        name,
        centerCrop(
          makeAspectCrop({ unit: '%', width: 90 }, variant.aspect, width, height),
          width,
          height
        )
      ])
    );
    setVariantCrops(initialCrops);
  };

  const handleVariantCropChange = (percentCrop) => {
    setVariantCrops(prev => ({ ...prev, [cropVariant]: percentCrop }));
  };

  const handleCloseCropDialog = () => {
    if (uploading) return;
    setCropDialogOpen(false);
    setCropImageFile(null);
    setCropImageUrl('');
    setCropVariant('web');
    setVariantCrops({ web: null, app: null });
  };

  const handleCroppedImageUpload = async () => {
    const cropsAreComplete = Object.keys(FEATURED_IMAGE_VARIANTS).every(
      (name) => variantCrops[name]?.width && variantCrops[name]?.height
    );
    if (!cropImageFile || !cropsAreComplete) {
      setError('Please select both website and app crop areas');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await uploadApi.uploadFile(cropImageFile, { crops: variantCrops });
      const { blobUrl, appBlobUrl } = response.data;

      setArticle(prev => ({
        ...prev,
        featuredImage: { url: blobUrl, appUrl: appBlobUrl, alt: cropImageFile.name }
      }));

      setSuccess('Website and app images cropped, converted to WebP, and uploaded successfully');
      setCropDialogOpen(false);
      setCropImageFile(null);
      setCropImageUrl('');
      setCropVariant('web');
      setVariantCrops({ web: null, app: null });
    } catch (err) {
      setApiError(err, 'Failed to upload image');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const getTeluguDraftText = () => {
    const parts = [];
    if (article.title.te?.trim()) parts.push(article.title.te.trim());
    if (article.summary.te?.trim()) parts.push(article.summary.te.trim());
    if (article.content.te?.trim()) parts.push(article.content.te.trim());
    return parts.join('\n\n');
  };

  const handleOpenTranslateDialog = () => {
    setError(null);
    setErrorDetails([]);
    setSuccess(null);
    setTranslateError(null);
    setTranslatePreview(null);
    setTranslatePreviewTab(0);
    setTeluguInputText(getTeluguDraftText());
    setTranslateDialogOpen(true);
  };

  const handleRunTranslate = async () => {
    if (!teluguInputText.trim()) {
      setTranslateError('Please enter Telugu article text to translate');
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    setTranslatePreview(null);

    try {
      const response = await articlesApi.translateAll({
        sourceLang: 'te',
        content: { te: teluguInputText.trim() }
      });
      setTranslatePreview(response.data);
    } catch (err) {
      const message = err?.response?.data?.error || 'Translation failed. Please try again.';
      setTranslateError(message);
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  const handleApplyTranslation = () => {
    if (!translatePreview) return;

    setArticle((prev) => {
      const updated = { ...prev };
      const mergeField = (fieldName) => {
        if (!translatePreview[fieldName]) return;
        updated[fieldName] = { ...prev[fieldName] };
        Object.entries(translatePreview[fieldName]).forEach(([lang, text]) => {
          if (text && text.trim()) {
            updated[fieldName][lang] = text;
          }
        });
      };

      mergeField('title');
      mergeField('summary');
      mergeField('content');
      return updated;
    });

    setTranslateDialogOpen(false);
    setTranslatePreview(null);
    setTranslateError(null);
    setSuccess('Translation applied to all languages');
  };

  const handleCloseTranslateDialog = () => {
    if (translating) return;
    setTranslateDialogOpen(false);
    setTranslatePreview(null);
    setTranslateError(null);
    setTeluguInputText('');
  };

  const handleBackToTranslateInput = () => {
    setTranslatePreview(null);
    setTranslateError(null);
    setTranslatePreviewTab(0);
  };

  const handleTranslate = async () => {
    setError(null);
    setErrorDetails([]);
    setSuccess(null);

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

    if (
      Object.keys(titleInput).length === 0 &&
      Object.keys(summaryInput).length === 0 &&
      Object.keys(contentInput).length === 0
    ) {
      setError('Please enter content in at least one language before translating');
      setErrorDetails([]);
      return;
    }

    setTranslating(true);

    try {
      const payload = { sourceLang: 'te' };
      if (Object.keys(titleInput).length > 0) payload.title = titleInput;
      if (Object.keys(summaryInput).length > 0) payload.summary = summaryInput;
      if (Object.keys(contentInput).length > 0) payload.content = contentInput;

      const response = await articlesApi.translateAll(payload);
      const translated = response.data;

      const mergeInto = (prev, fieldName, source) => {
        const merged = { ...prev[fieldName] };
        if (source) {
          Object.entries(source).forEach(([lang, text]) => {
            if (text?.trim() && (!merged[lang] || !merged[lang].trim())) {
              merged[lang] = text;
            }
          });
        }
        return merged;
      };

      const mergedTitle = mergeInto(article, 'title', translated.title);
      const mergedSummary = mergeInto(article, 'summary', translated.summary);
      const mergedContent = mergeInto(article, 'content', translated.content);

      setArticle((prev) => ({
        ...prev,
        title: mergedTitle,
        summary: mergedSummary,
        content: mergedContent
      }));

      if (generateAudio) {
        const audioRes = await translateApi.translate({
          content: mergedContent,
          generateAudio: true
        });
        if (audioRes.data?.audio) {
          setArticle((prev) => ({
            ...prev,
            audio: { ...prev.audio, ...audioRes.data.audio }
          }));
        }
      }

      setSuccess(generateAudio ? 'Translation and audio generation completed' : 'Translation completed successfully');
    } catch (err) {
      setApiError(err, 'Translation failed. Please try again.');
      console.error(err);
    } finally {
      setTranslating(false);
    }
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
  const handleSave = async (saveMode = 'draft', options = {}) => {
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
        author: article.author || user?._id,
        tags: article.tags,
        status: targetStatus,
        isFeatured: article.isFeatured,
        isBreaking: article.isBreaking,
        reporterName: article.reporterName || '',
        source: article.source || 'Taaja News Network',
        sourceUrl: article.sourceUrl || '',
        youtubeUrl: (article.youtubeUrl || '').trim()
      };

      // Only relevant when publishing: controls the push notification fan-out.
      if (targetStatus === 'published') {
        articleData.sendNotification = options.sendNotification !== false;
      }

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

  const openPublishDialog = () => {
    setSendNotification(true);
    setPublishDialogOpen(true);
  };

  const closePublishDialog = () => {
    if (saving) return;
    setPublishDialogOpen(false);
  };

  const handleConfirmPublish = async () => {
    setPublishDialogOpen(false);
    await handleSave('published', { sendNotification });
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
              startIcon={<TranslateIcon />}
              onClick={handleOpenTranslateDialog}
              disabled={saving || translating}
            >
              Translate
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
                onClick={openPublishDialog}
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
                  <Grid container spacing={1}>
                    <Grid item xs={article.featuredImage.appUrl ? 7 : 12}>
                      <Typography variant="caption" color="text.secondary">
                        Website · 800×700
                      </Typography>
                      <Box
                        component="img"
                        src={article.featuredImage.url}
                        alt="Website featured"
                        sx={{ width: '100%', aspectRatio: '8 / 7', objectFit: 'cover', borderRadius: 1 }}
                      />
                    </Grid>
                    {article.featuredImage.appUrl && (
                      <Grid item xs={5}>
                        <Typography variant="caption" color="text.secondary">
                          App · 750×750
                        </Typography>
                        <Box
                          component="img"
                          src={article.featuredImage.appUrl}
                          alt="App featured"
                          sx={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 1 }}
                        />
                      </Grid>
                    )}
                  </Grid>
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
                    accept={SUPPORTED_CROP_IMAGE_TYPES.join(',')}
                    onChange={handleImageSelect}
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
              <MuiAutocomplete
                options={articleAuthors}
                loading={authorsLoading}
                disabled={isReporterLockedOut}
                value={articleAuthors.find(author => author._id === article.author) || null}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                getOptionLabel={(option) => `${option.name} — ${option.email} (${option.role})`}
                onChange={(_, selectedAuthor) => {
                  handleChange('author', selectedAuthor?._id || user?._id || '');
                  handleChange('reporterName', '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    size="small"
                    label="Source Reporter"
                    margin="dense"
                    placeholder="Search by name, email, or role"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {authorsLoading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
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

      <Dialog
        open={cropDialogOpen}
        onClose={handleCloseCropDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Crop Featured Image</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set both crop areas. Two optimized WebP images will be generated from this upload.
          </Typography>
          <Tabs
            value={cropVariant}
            onChange={(_, value) => setCropVariant(value)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            {Object.entries(FEATURED_IMAGE_VARIANTS).map(([name, variant]) => (
              <Tab
                key={name}
                value={name}
                label={`${variant.label} · ${variant.width}×${variant.height}`}
              />
            ))}
          </Tabs>
          {cropImageUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'grey.100', p: 1, minHeight: 280 }}>
              <ReactCrop
                crop={variantCrops[cropVariant] || undefined}
                onChange={(_, percentCrop) => handleVariantCropChange(percentCrop)}
                onComplete={(_, percentCrop) => handleVariantCropChange(percentCrop)}
                aspect={FEATURED_IMAGE_VARIANTS[cropVariant].aspect}
                keepSelection
              >
                <img
                  src={cropImageUrl}
                  alt="Crop preview"
                  onLoad={handleCropImageLoad}
                  style={{ maxWidth: '100%', maxHeight: '65vh', display: 'block' }}
                />
              </ReactCrop>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCropDialog} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCroppedImageUpload}
            disabled={uploading || !Object.keys(FEATURED_IMAGE_VARIANTS).every(
              (name) => variantCrops[name]?.width && variantCrops[name]?.height
            )}
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadIcon />}
          >
            {uploading ? 'Generating both images...' : 'Generate and Upload Both'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={translateDialogOpen}
        onClose={handleCloseTranslateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Translate to All Languages
          <IconButton onClick={handleCloseTranslateDialog} disabled={translating} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {translating && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary">
                Paraphrasing article in Telugu, Hindi, and English…
              </Typography>
            </Box>
          )}

          {!translating && translateError && (
            <Alert severity="error" sx={{ mb: translatePreview ? 2 : 0 }}>{translateError}</Alert>
          )}

          {!translating && !translatePreview && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Paste or type the Telugu news article below. It will be paraphrased into Telugu, Hindi, and English.
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={12}
                maxRows={20}
                placeholder="Enter Telugu article text here…"
                value={teluguInputText}
                onChange={(e) => setTeluguInputText(e.target.value)}
                inputProps={{ maxLength: 12000 }}
                helperText={`${teluguInputText.length} / 12000 characters`}
              />
            </Box>
          )}

          {!translating && translatePreview && (
            <Box>
              <Tabs
                value={translatePreviewTab}
                onChange={(_, v) => setTranslatePreviewTab(v)}
                sx={{ mb: 2 }}
              >
                {[
                  { code: 'te', label: 'Telugu' },
                  { code: 'hi', label: 'Hindi' },
                  { code: 'en', label: 'English' }
                ].map((lang, idx) => (
                  <Tab key={lang.code} label={lang.label} value={idx} />
                ))}
              </Tabs>

              {(() => {
                const previewLangs = ['te', 'hi', 'en'];
                const langCode = previewLangs[translatePreviewTab];
                return (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Heading
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 600 }}>
                      {translatePreview.title?.[langCode] || '—'}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Superlead
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                      {translatePreview.summary?.[langCode] || '—'}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Full News
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {translatePreview.content?.[langCode] || '—'}
                    </Typography>
                  </Box>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {translatePreview && !translating && (
            <Button onClick={handleBackToTranslateInput}>
              Edit Telugu Text
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={handleCloseTranslateDialog} disabled={translating}>
            Cancel
          </Button>
          {!translatePreview ? (
            <Button
              variant="contained"
              onClick={handleRunTranslate}
              disabled={translating || !teluguInputText.trim()}
              startIcon={translating ? <CircularProgress size={18} color="inherit" /> : <TranslateIcon />}
            >
              {translating ? 'Translating…' : 'Translate'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleApplyTranslation}
              disabled={translating}
            >
              Apply to Article
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Publish confirmation dialog with optional notification */}
      <Dialog open={publishDialogOpen} onClose={closePublishDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Publish article?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to publish this article?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
              />
            }
            label="Send push notification to users"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closePublishDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmPublish}
            disabled={saving}
          >
            {saving ? t('loading') : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArticleEditor;
