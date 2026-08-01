import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Alert,
  Chip,
  Avatar,
  Grid,
  CircularProgress,
  InputAdornment,
  Autocomplete as MuiAutocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  OpenInNew as LinkIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { promotionsApi, uploadApi, languagesApi } from '../../services/api';

const INITIAL_FORM = {
  image: '',
  title: '',
  description: '',
  type: 'advertisement',
  location: null,
  status: 'active',
  link: '',
  youtubeUrl: '',
  priority: 0,
  startDate: '',
  endDate: '',
  languages: []
};

// Strict allow-list for YouTube URLs (HTTPS only, known hosts only)
const YOUTUBE_URL_REGEX = /^https:\/\/(www\.youtube\.com\/(watch\?v=|embed\/|shorts\/)[A-Za-z0-9_-]{6,}(\S*)?|youtu\.be\/[A-Za-z0-9_-]{6,}(\S*)?)$/;

const isValidYouTubeUrl = (url) => !url || YOUTUBE_URL_REGEX.test(url);

const PromotionsManager = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);

  const [locationInput, setLocationInput] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    fetchPromotions();
  }, [page, rowsPerPage, filterType, filterStatus, sortBy, sortOrder, search]);

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await languagesApi.getAll();
        setAvailableLanguages(response.data.languages || []);
      } catch (err) {
        console.error('Failed to load languages:', err);
      } finally {
        setLanguagesLoading(false);
      }
    };
    loadLanguages();
  }, []);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy,
        sortOrder
      };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;

      const response = await promotionsApi.getAll(params);
      setPromotions(response.data.promotions);
      setTotal(response.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch promotions:', err);
      setError('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultLanguageCodes = () => {
    const defaults = availableLanguages.filter((l) => l.isDefault).map((l) => l.code);
    if (defaults.length) return defaults;
    return availableLanguages[0] ? [availableLanguages[0].code] : [];
  };

  const getLanguageLabel = (code) => {
    const lang = availableLanguages.find((l) => l.code === code);
    return lang ? lang.nativeName || lang.name : code;
  };

  const handleLanguageToggle = (code) => {
    setFormData((prev) => {
      const selected = prev.languages.includes(code)
        ? prev.languages.filter((c) => c !== code)
        : [...prev.languages, code];
      return { ...prev, languages: selected };
    });
  };

  const handleOpenDialog = (promotion = null) => {
    if (promotion) {
      setEditingPromotion(promotion);
      setFormData({
        image: promotion.image || '',
        title: promotion.title || '',
        description: promotion.description || '',
        type: promotion.type || 'advertisement',
        location: promotion.location || null,
        status: promotion.status || 'active',
        link: promotion.link || '',
        youtubeUrl: promotion.youtubeUrl || '',
        priority: promotion.priority || 0,
        startDate: promotion.startDate ? promotion.startDate.slice(0, 10) : '',
        endDate: promotion.endDate ? promotion.endDate.slice(0, 10) : '',
        languages: promotion.languages?.length
          ? [...promotion.languages]
          : getDefaultLanguageCodes()
      });
      setLocationInput(promotion.location?.formattedAddress || '');
    } else {
      setEditingPromotion(null);
      setFormData({ ...INITIAL_FORM, languages: getDefaultLanguageCodes() });
      setLocationInput('');
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPromotion(null);
    setError(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const response = await uploadApi.uploadFile(file);
      const { blobUrl } = response.data;
      setFormData(prev => ({ ...prev, image: blobUrl }));
      setSuccess('Image uploaded successfully');
    } catch (err) {
      setError('Failed to upload image');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
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
        if (types.includes('locality')) city = city || comp.longText;
        if (types.includes('sublocality') || types.includes('sublocality_level_1')) area = area || comp.longText;
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

      setFormData(prev => ({ ...prev, location: locationData }));
      setLocationInput(place.formattedAddress || '');
      setLocationSuggestions([]);
      sessionTokenRef.current = null;
    } catch (err) {
      console.error('Place details error:', err);
    }
  }, []);

  const clearLocation = () => {
    setFormData(prev => ({ ...prev, location: null }));
    setLocationInput('');
  };

  const handleSubmit = async () => {
    setError(null);

    if (!formData.image) {
      setError('Image is required');
      return;
    }
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.type) {
      setError('Type is required');
      return;
    }
    if (!formData.languages.length) {
      setError('Select at least one language');
      return;
    }

    const trimmedYoutube = formData.youtubeUrl?.trim() || '';
    if (trimmedYoutube && !isValidYouTubeUrl(trimmedYoutube)) {
      setError('YouTube URL must be a valid HTTPS link (youtube.com or youtu.be)');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        image: formData.image,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        type: formData.type,
        status: formData.status,
        link: formData.link?.trim() || null,
        // YouTube video only applies to advertisements
        youtubeUrl: formData.type === 'advertisement' ? (trimmedYoutube || null) : null,
        priority: Number(formData.priority) || 0,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        languages: formData.languages
      };

      if (formData.location && formData.location.formattedAddress) {
        payload.location = formData.location;
      }

      if (editingPromotion) {
        await promotionsApi.update(editingPromotion._id, payload);
        setSuccess('Promotion updated successfully');
      } else {
        await promotionsApi.create(payload);
        setSuccess('Promotion created successfully');
      }

      fetchPromotions();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) return;

    try {
      await promotionsApi.delete(id);
      setSuccess('Promotion deleted successfully');
      fetchPromotions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete promotion');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  // Toggle asc/desc for a column; switching columns starts at desc.
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(0);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(0);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(0);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Manage Promotions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Promotion
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by title, description, location, or link..."
        value={searchInput}
        onChange={handleSearchChange}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: searchInput ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClearSearch} aria-label="Clear search">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null
        }}
      />

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            label="Type"
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="advertisement">Advertisement</MenuItem>
            <MenuItem value="goodwords">Goodwords</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Promotions Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Image</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Languages</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sortDirection={sortBy === 'priority' ? sortOrder : false}>
                  <TableSortLabel
                    active={sortBy === 'priority'}
                    direction={sortBy === 'priority' ? sortOrder : 'desc'}
                    onClick={() => handleSort('priority')}
                  >
                    Priority
                  </TableSortLabel>
                </TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell sortDirection={sortBy === 'endDate' ? sortOrder : false}>
                  <TableSortLabel
                    active={sortBy === 'endDate'}
                    direction={sortBy === 'endDate' ? sortOrder : 'desc'}
                    onClick={() => handleSort('endDate')}
                  >
                    End Date
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    No promotions found
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((promo) => (
                  <TableRow key={promo._id} hover>
                    <TableCell>
                      <Avatar
                        src={promo.image}
                        variant="rounded"
                        sx={{ width: 60, height: 40 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                        {promo.title}
                      </Typography>
                      {promo.link && (
                        <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LinkIcon sx={{ fontSize: 12 }} /> Has link
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          maxWidth: 240,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                        title={promo.description || ''}
                      >
                        {promo.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={promo.type === 'advertisement' ? 'Ad' : 'Goodwords'}
                        size="small"
                        color={promo.type === 'advertisement' ? 'primary' : 'secondary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 160 }}>
                        {promo.languages?.length ? (
                          promo.languages.map((code) => (
                            <Chip
                              key={`${promo._id}-${code}`}
                              label={getLanguageLabel(code)}
                              size="small"
                            />
                          ))
                        ) : (
                          <Chip label="All languages" size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={promo.status}
                        size="small"
                        color={promo.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{promo.priority}</TableCell>
                    <TableCell>
                      <Typography variant="caption" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                        {promo.location?.city || promo.location?.formattedAddress || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(promo.startDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(promo.endDate)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(promo)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(promo._id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPromotion ? 'Edit Promotion' : 'Add Promotion'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={2} sx={{ mt: 0 }}>
            {/* Image Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Image *</Typography>
              {formData.image ? (
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={formData.image}
                    alt="Promotion"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.9)' }}
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Image'}
                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
              )}
            </Grid>

            {/* Title */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                inputProps={{ maxLength: 200 }}
                helperText={`${formData.title.length}/200`}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
                inputProps={{ maxLength: 500 }}
                helperText={`${(formData.description || '').length}/500`}
              />
            </Grid>

            {/* Languages */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Languages *
              </Typography>
              {languagesLoading ? (
                <CircularProgress size={20} />
              ) : availableLanguages.length === 0 ? (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  No active languages found. Add languages in Language Management first.
                </Alert>
              ) : (
                <>
                  <FormGroup row sx={{ gap: 1 }}>
                    {availableLanguages.map((lang) => (
                      <FormControlLabel
                        key={lang.code}
                        control={
                          <Checkbox
                            checked={formData.languages.includes(lang.code)}
                            onChange={() => handleLanguageToggle(lang.code)}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {lang.nativeName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {lang.name}
                            </Typography>
                          </Box>
                        }
                        sx={{
                          border: 1,
                          borderColor: formData.languages.includes(lang.code) ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          px: 1,
                          m: 0,
                          bgcolor: formData.languages.includes(lang.code) ? 'action.selected' : 'transparent'
                        }}
                      />
                    ))}
                  </FormGroup>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Select one or more languages. The promotion will appear only for users in those languages.
                  </Typography>
                </>
              )}
            </Grid>

            {/* Type & Status */}
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type *</InputLabel>
                <Select
                  value={formData.type}
                  label="Type *"
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <MenuItem value="advertisement">Advertisement</MenuItem>
                  <MenuItem value="goodwords">Goodwords</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      status: e.target.checked ? 'active' : 'inactive'
                    }))}
                  />
                }
                label={formData.status === 'active' ? 'Active' : 'Inactive'}
                sx={{ mt: 1 }}
              />
            </Grid>

            {/* Priority */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                inputProps={{ min: 0 }}
                helperText="Higher value = shown first"
              />
            </Grid>

            {/* Link */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="External Link"
                value={formData.link}
                onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                placeholder="https://example.com"
                helperText="Optional — users will navigate to this URL when they tap"
              />
            </Grid>

            {/* YouTube Video (advertisements only) */}
            {formData.type === 'advertisement' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="YouTube Video URL"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  error={!!formData.youtubeUrl && !isValidYouTubeUrl(formData.youtubeUrl.trim())}
                  helperText={
                    formData.youtubeUrl && !isValidYouTubeUrl(formData.youtubeUrl.trim())
                      ? 'Must be a valid HTTPS YouTube URL (youtube.com or youtu.be)'
                      : 'Optional — plays a YouTube video for this advertisement'
                  }
                />
              </Grid>
            )}

            {/* Location (Google Maps Autocomplete) */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Location (optional)</Typography>
              <MuiAutocomplete
                freeSolo
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
                    placeholder="Search location..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {formData.location && (
                            <IconButton size="small" onClick={clearLocation}>
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
              {formData.location?.formattedAddress && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {formData.location.formattedAddress}
                  {formData.location.city && ` | ${formData.location.city}`}
                </Typography>
              )}
            </Grid>

            {/* Start Date & End Date */}
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Optional scheduling"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving...' : editingPromotion ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromotionsManager;
