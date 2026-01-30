import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { categoriesApi } from '../../services/api';

const CategoriesManager = () => {
  const { t } = useTranslation();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: { te: '', en: '', hi: '' },
    description: { te: '', en: '', hi: '' },
    parent: '',
    color: '#1976d2',
    isActive: true,
    isFeatured: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
        parent: category.parent?._id || category.parent || '',
        color: category.color || '#1976d2',
        isActive: category.isActive !== false,
        isFeatured: category.isFeatured || false
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: { te: '', en: '', hi: '' },
        description: { te: '', en: '', hi: '' },
        parent: '',
        color: '#1976d2',
        isActive: true,
        isFeatured: false
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
        parent: formData.parent || null
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

  const rootCategories = categories.filter(c => !c.parent);

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
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">{t('loading')}</TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">{t('noResults')}</TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category._id}>
                    <TableCell>
                      <Box sx={{ pl: category.level * 2 }}>
                        {category._multilingual?.name?.te || category.name}
                      </Box>
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
          <FormControl fullWidth margin="normal">
            <InputLabel>Parent Category</InputLabel>
            <Select
              value={formData.parent}
              label="Parent Category"
              onChange={(e) => setFormData(prev => ({ ...prev, parent: e.target.value }))}
            >
              <MenuItem value="">None (Root)</MenuItem>
              {rootCategories
                .filter(c => c._id !== editingCategory?._id)
                .map((cat) => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat._multilingual?.name?.te || cat.name}
                  </MenuItem>
                ))
              }
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
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
