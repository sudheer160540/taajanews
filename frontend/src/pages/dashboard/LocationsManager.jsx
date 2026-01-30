import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { locationsApi } from '../../services/api';
import api from '../../services/api';

const LocationsManager = () => {
  const [tab, setTab] = useState(0);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchAreas(selectedCity);
    }
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const response = await locationsApi.getCities();
      setCities(response.data.cities);
      if (response.data.cities.length > 0 && !selectedCity) {
        setSelectedCity(response.data.cities[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch cities:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async (cityId) => {
    try {
      const response = await locationsApi.getAreas({ city: cityId });
      setAreas(response.data.areas);
    } catch (err) {
      console.error('Failed to fetch areas:', err);
    }
  };

  const handleOpenDialog = (item = null, type) => {
    setEditingItem(item ? { ...item, type } : { type });
    
    if (type === 'city') {
      const multilingual = item?._multilingual || {};
      setFormData(item ? {
        name: {
          te: multilingual.name?.te || '',
          en: multilingual.name?.en || '',
          hi: multilingual.name?.hi || ''
        },
        state: {
          te: multilingual.state?.te || '',
          en: multilingual.state?.en || '',
          hi: multilingual.state?.hi || ''
        },
        center: item.center?.coordinates || [0, 0],
        isActive: item.isActive,
        isFeatured: item.isFeatured
      } : {
        name: { te: '', en: '', hi: '' },
        state: { te: '', en: '', hi: '' },
        center: [0, 0],
        isActive: true,
        isFeatured: false
      });
    } else {
      const multilingual = item?._multilingual || {};
      setFormData(item ? {
        name: {
          te: multilingual.name?.te || '',
          en: multilingual.name?.en || '',
          hi: multilingual.name?.hi || ''
        },
        city: item.city?._id || item.city,
        center: item.center?.coordinates || [0, 0],
        pincode: item.pincode || '',
        isActive: item.isActive,
        isFeatured: item.isFeatured
      } : {
        name: { te: '', en: '', hi: '' },
        city: selectedCity,
        center: [0, 0],
        pincode: '',
        isActive: true,
        isFeatured: false
      });
    }
    
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    const isCity = editingItem?.type === 'city';

    if (!formData.name.te) {
      setError('Name is required in Telugu');
      return;
    }

    try {
      const data = {
        ...formData,
        center: {
          type: 'Point',
          coordinates: formData.center.map(Number)
        }
      };

      if (isCity) {
        if (editingItem._id) {
          await api.put(`/locations/cities/${editingItem._id}`, data);
        } else {
          data.location = data.center;
          await api.post('/locations/cities', data);
        }
        fetchCities();
      } else {
        if (editingItem._id) {
          await api.put(`/locations/areas/${editingItem._id}`, data);
        } else {
          await api.post('/locations/areas', data);
        }
        fetchAreas(selectedCity);
      }

      setSuccess(`${isCity ? 'City' : 'Area'} saved successfully`);
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === 'city') {
        await api.delete(`/locations/cities/${id}`);
        fetchCities();
      } else {
        await api.delete(`/locations/areas/${id}`);
        fetchAreas(selectedCity);
      }
      setSuccess(`${type} deleted successfully`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Manage Locations
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Cities" />
        <Tab label="Areas" />
      </Tabs>

      {/* Cities Tab */}
      {tab === 0 && (
        <Card>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog(null, 'city')}
            >
              Add City
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cities.map((city) => (
                  <TableRow key={city._id}>
                    <TableCell>{city._multilingual?.name?.te || city.name}</TableCell>
                    <TableCell>{city._multilingual?.state?.te || city.state}</TableCell>
                    <TableCell>
                      <Chip
                        label={city.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={city.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(city, 'city')}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(city._id, 'city')}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Areas Tab */}
      {tab === 1 && (
        <Card>
          <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Select City</InputLabel>
              <Select
                value={selectedCity}
                label="Select City"
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {cities.map((city) => (
                  <MenuItem key={city._id} value={city._id}>
                    {city._multilingual?.name?.te || city.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog(null, 'area')}
              disabled={!selectedCity}
            >
              Add Area
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Pincode</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {areas.map((area) => (
                  <TableRow key={area._id}>
                    <TableCell>{area._multilingual?.name?.te || area.name}</TableCell>
                    <TableCell>{area.pincode || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={area.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={area.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(area, 'area')}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(area._id, 'area')}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem?._id ? 'Edit' : 'Add'} {editingItem?.type === 'city' ? 'City' : 'Area'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, color: 'text.secondary' }}>
            Name
          </Typography>
          <TextField
            fullWidth
            label="Name (Telugu) *"
            value={formData.name?.te || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, te: e.target.value }
            }))}
            margin="dense"
            required
          />
          <TextField
            fullWidth
            label="Name (English)"
            value={formData.name?.en || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, en: e.target.value }
            }))}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Name (Hindi)"
            value={formData.name?.hi || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              name: { ...prev.name, hi: e.target.value }
            }))}
            margin="dense"
          />

          {editingItem?.type === 'city' && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                State
              </Typography>
              <TextField
                fullWidth
                label="State (Telugu)"
                value={formData.state?.te || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  state: { ...prev.state, te: e.target.value }
                }))}
                margin="dense"
              />
              <TextField
                fullWidth
                label="State (English)"
                value={formData.state?.en || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  state: { ...prev.state, en: e.target.value }
                }))}
                margin="dense"
              />
              <TextField
                fullWidth
                label="State (Hindi)"
                value={formData.state?.hi || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  state: { ...prev.state, hi: e.target.value }
                }))}
                margin="dense"
              />
            </>
          )}

          {editingItem?.type === 'area' && (
            <TextField
              fullWidth
              label="Pincode"
              value={formData.pincode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
              margin="normal"
            />
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              label="Longitude"
              type="number"
              value={formData.center?.[0] || 0}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                center: [parseFloat(e.target.value), prev.center?.[1] || 0]
              }))}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Latitude"
              type="number"
              value={formData.center?.[1] || 0}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                center: [prev.center?.[0] || 0, parseFloat(e.target.value)]
              }))}
              sx={{ flex: 1 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isFeatured || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                />
              }
              label="Featured"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LocationsManager;
