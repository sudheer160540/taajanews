import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { videoCategoriesApi } from '../../services/api';

const INITIAL_FORM = {
  name: '',
  description: '',
  order: 0,
  isActive: true
};

const VideoCategoriesManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await videoCategoriesApi.getAll({ limit: 100 });
      setCategories(response.data.categories || []);
    } catch (err) {
      console.error('Failed to fetch video categories:', err);
      setError('Failed to load video categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        description: category.description || '',
        order: Number.isFinite(Number(category.order)) ? Number(category.order) : 0,
        isActive: category.isActive !== false
      });
    } else {
      setEditingCategory(null);
      setFormData(INITIAL_FORM);
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

    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      order: Number(formData.order) || 0,
      isActive: Boolean(formData.isActive)
    };

    try {
      if (editingCategory) {
        await videoCategoriesApi.update(editingCategory._id, payload);
        setSuccess('Video category updated');
      } else {
        await videoCategoriesApi.create(payload);
        setSuccess('Video category created');
      }
      fetchCategories();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save video category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this video category?')) return;
    try {
      await videoCategoriesApi.delete(id);
      setSuccess('Video category deleted');
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete video category');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Button
            component={RouterLink}
            to="/dashboard/videos"
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 1 }}
          >
            Back to Videos
          </Button>
          <Typography variant="h5" fontWeight={700}>
            Video Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create categories and assign them when adding videos.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Category
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">Loading...</TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No video categories yet</TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{category.name}</Typography>
                      {category.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {category.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{category.slug}</Typography>
                    </TableCell>
                    <TableCell>{category.order ?? 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={category.isActive ? 'Active' : 'Inactive'}
                        color={category.isActive ? 'success' : 'default'}
                        size="small"
                      />
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Video Category' : 'Add Video Category'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            fullWidth
            label="Category Name *"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            label="Display Order"
            type="number"
            value={formData.order}
            onChange={(e) => setFormData((prev) => ({ ...prev, order: e.target.value }))}
            margin="normal"
            inputProps={{ min: 0 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
            }
            label="Active"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoCategoriesManager;
