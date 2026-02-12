import { useState, useEffect } from 'react';
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
  Badge
} from '@mui/material';
import {
  Save as SaveIcon,
  Publish as PublishIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Star as StarIcon,
  Translate as TranslateIcon
} from '@mui/icons-material';
import { articlesApi, categoriesApi, locationsApi, uploadApi, translateApi } from '../../services/api';
import languageService, { getLocalizedValue } from '../../services/languageService';
import { BlockBlobClient } from '@azure/storage-blob';

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEditing = !!id;

  // Languages state
  const [languages, setLanguages] = useState([]);
  const [defaultLang, setDefaultLang] = useState('en');

  const [article, setArticle] = useState({
    title: {},
    summary: {},
    content: {},
    category: '',
    city: '',
    area: '',
    tags: [],
    status: 'draft',
    isFeatured: false,
    isBreaking: false,
    featuredImage: null
  });
  
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
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

  useEffect(() => {
    if (article.city) {
      fetchAreas(article.city);
    }
  }, [article.city]);

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

      // Fetch other data
      const [categoriesRes, citiesRes] = await Promise.all([
        categoriesApi.getAll({ active: 'true', raw: 'true' }),
        locationsApi.getCities({ raw: 'true' })
      ]);
      setCategories(categoriesRes.data.categories);
      setCities(citiesRes.data.cities);

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

        setArticle({
          title: convertField(articleData.title),
          summary: convertField(articleData.summary),
          content: convertField(articleData.content),
          category: articleData.category?._id || articleData.category || '',
          city: articleData.city?._id || articleData.city || '',
          area: articleData.area?._id || articleData.area || '',
          tags: articleData.tags || [],
          status: articleData.status || 'draft',
          isFeatured: articleData.isFeatured || false,
          isBreaking: articleData.isBreaking || false,
          featuredImage: articleData.featuredImage || null
        });
      }
    } catch (err) {
      setError('Failed to initialize editor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async (cityId) => {
    try {
      const response = await locationsApi.getAreas({ city: cityId, raw: 'true' });
      setAreas(response.data.areas);
    } catch (err) {
      console.error('Failed to fetch areas:', err);
    }
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

      const response = await translateApi.translate(payload);
      const translated = response.data;

      // Merge translations into article (only fill empty fields)
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

        return updated;
      });

      setSuccess('Translation completed successfully');
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

      // Only include optional fields if they have values
      if (article.category) articleData.category = article.category;
      if (article.city) articleData.city = article.city;
      if (article.area) articleData.area = article.area;
      if (article.featuredImage?.url) articleData.featuredImage = article.featuredImage;

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
                  onChange={(e) => handleChange('title', e.target.value, currentLang)}
                  margin="normal"
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                />
                <TextField
                  fullWidth
                  label={`Summary (${languages[langTab]?.name || 'English'})${languages[langTab]?.isDefault ? ' *' : ''}`}
                  value={article.summary[currentLang] || ''}
                  onChange={(e) => handleChange('summary', e.target.value, currentLang)}
                  margin="normal"
                  multiline
                  rows={2}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                />
                <TextField
                  fullWidth
                  label={`Content (${languages[langTab]?.name || 'English'})${languages[langTab]?.isDefault ? ' *' : ''}`}
                  value={article.content[currentLang] || ''}
                  onChange={(e) => handleChange('content', e.target.value, currentLang)}
                  margin="normal"
                  multiline
                  rows={12}
                  required={languages[langTab]?.isDefault}
                  placeholder={languages[langTab]?.isDefault ? '' : `Optional - will fallback to ${defaultLang}`}
                />
              </Box>

              {/* Translate Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
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
                <InputLabel>Category *</InputLabel>
                <Select
                  value={article.category}
                  label="Category *"
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {getLocalizedValue(cat.name, defaultLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>City</InputLabel>
                <Select
                  value={article.city}
                  label="City"
                  onChange={(e) => {
                    handleChange('city', e.target.value);
                    handleChange('area', '');
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {cities.map((city) => (
                    <MenuItem key={city._id} value={city._id}>
                      {getLocalizedValue(city.name, defaultLang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {article.city && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Area</InputLabel>
                  <Select
                    value={article.area}
                    label="Area"
                    onChange={(e) => handleChange('area', e.target.value)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {areas.map((area) => (
                      <MenuItem key={area._id} value={area._id}>
                        {getLocalizedValue(area.name, defaultLang)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
