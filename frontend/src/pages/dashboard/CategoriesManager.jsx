import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { categoriesApi, uploadApi } from '../../services/api';

const CategoriesManager = () => {
  const { t } = useTranslation();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: { te: '', en: '', hi: '' },
    description: { te: '', en: '', hi: '' },
    order: 0,
    color: '#B80000',
    isActive: true,
    isFeatured: false,
    icon: '',
    image: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll({});
      setCategories(response.data.categories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      // Get multilingual data from _multilingual field
      const multilingual = category._multilingual || {};
      setFormData({
        name: {
          te: multilingual.name?.te || '',
          en: multilingual.name?.en || '',
          hi: multilingual.name?.hi || ''
        },
        description: {
          te: multilingual.description?.te || '',
          en: multilingual.description?.en || '',
          hi: multilingual.description?.hi || ''
        },
        order: Number.isFinite(Number(category.order)) ? Number(category.order) : 0,
        color: category.color || '#B80000',
        isActive: category.isActive !== false,
        isFeatured: category.isFeatured || false,
        icon: category.icon || '',
        image: category.image || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: { te: '', en: '', hi: '' },
        description: { te: '', en: '', hi: '' },
        order: 0,
        color: '#B80000',
        isActive: true,
        isFeatured: false,
        icon: '',
        image: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    
    if (!formData.name.te) {
      setError('Name is required in Telugu');
      return;
    }

    try {
      const data = {
        ...formData,
        order: Number.isFinite(Number(formData.order)) ? Number(formData.order) : 0
      };

      if (editingCategory) {
        await categoriesApi.update(editingCategory._id, data);
        setSuccess('Category updated successfully');
      } else {
        await categoriesApi.create(data);
        setSuccess('Category created successfully');
      }
      
      fetchCategories();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoriesApi.delete(id);
      setSuccess('Category deleted successfully');
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete category');
    }
  };

  const extractBlobName = (blobUrl) => {
    if (!blobUrl) return null;
    try {
      const url = new URL(blobUrl);
      // Path is /container/blobName — strip leading slash and container
      const parts = url.pathname.split('/');
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  };

  const deleteBlobFromAzure = async (blobUrl) => {
    const blobName = extractBlobName(blobUrl);
    if (blobName) {
      try {
        await uploadApi.delete(blobName);
      } catch (err) {
        console.error('Failed to delete blob from Azure:', err);
      }
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingIcon(true);
    setError(null);
    try {
      if (formData.icon) await deleteBlobFromAzure(formData.icon);
      const response = await uploadApi.uploadFile(file);
      setFormData(prev => ({ ...prev, icon: response.data.blobUrl }));
    } catch (err) {
      setError('Failed to upload icon');
      console.error('Icon upload error:', err);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      if (formData.image) await deleteBlobFromAzure(formData.image);
      const response = await uploadApi.uploadFile(file);
      setFormData(prev => ({ ...prev, image: response.data.blobUrl }));
    } catch (err) {
      setError('Failed to upload stock icon');
      console.error('Stock icon upload error:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveIcon = async () => {
    await deleteBlobFromAzure(formData.icon);
    setFormData(prev => ({ ...prev, icon: '' }));
  };

  const handleRemoveImage = async () => {
    await deleteBlobFromAzure(formData.image);
    setFormData(prev => ({ ...prev, image: '' }));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {t('manageCategories')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Category
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Categories Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Icon</TableCell>
                <TableCell>Stock Icon</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">{t('loading')}</TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">{t('noResults')}</TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category._id}>
                    <TableCell>{Number.isFinite(Number(category.order)) ? Number(category.order) : 0}</TableCell>
                    <TableCell>
                      {category.icon ? (
                        <Box component="img" src={category.icon} alt="icon"
                          sx={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 1 }} />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {category.image ? (
                        <Box component="img" src={category.image} alt="stock icon"
                          sx={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 1 }} />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {category._multilingual?.name?.te || category.name}
                    </TableCell>
                    <TableCell>
                      {category._multilingual?.description?.te || category.description || '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(category)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(category._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Add Category'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <TextField
            fullWidth
            label="Order"
            type="number"
            value={formData.order}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              order: e.target.value === '' ? '' : Number(e.target.value)
            }))}
            margin="normal"
            inputProps={{ min: 0, step: 1 }}
          />

          <TextField
            fullWidth
            label="Name (Telugu) *"
            value={formData.name.te}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, te: e.target.value }
            }))}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Name (English)"
            value={formData.name.en}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, en: e.target.value }
            }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Name (Hindi)"
            value={formData.name.hi}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, hi: e.target.value }
            }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description (Telugu)"
            value={formData.description.te}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              description: { ...prev.description, te: e.target.value }
            }))}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Description (English)"
            value={formData.description.en}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              description: { ...prev.description, en: e.target.value }
            }))}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Description (Hindi)"
            value={formData.description.hi}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              description: { ...prev.description, hi: e.target.value }
            }))}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />

          {/* Icon Upload */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Normal Icon</Typography>
            {formData.icon ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src={formData.icon} alt="Icon"
                  sx={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid #e0e0e0', borderRadius: 1, p: 0.5 }} />
                <IconButton size="small" color="error" onClick={handleRemoveIcon}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                component="label"
                startIcon={uploadingIcon ? <CircularProgress size={18} /> : <UploadIcon />}
                disabled={uploadingIcon}
                size="small"
              >
                {uploadingIcon ? 'Uploading...' : 'Upload Icon'}
                <input type="file" hidden accept="image/*" onChange={handleIconUpload} />
              </Button>
            )}
          </Box>

          {/* Stock Icon Upload */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Stock Icon</Typography>
            {formData.image ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src={formData.image} alt="Stock Icon"
                  sx={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid #e0e0e0', borderRadius: 1, p: 0.5 }} />
                <IconButton size="small" color="error" onClick={handleRemoveImage}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                component="label"
                startIcon={uploadingImage ? <CircularProgress size={18} /> : <UploadIcon />}
                disabled={uploadingImage}
                size="small"
              >
                {uploadingImage ? 'Uploading...' : 'Upload Stock Icon'}
                <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                />
              }
              label="Featured"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>{t('save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoriesManager;
