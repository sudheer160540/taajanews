import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
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
  Alert,
  Chip,
  Grid,
  CircularProgress,
  Link
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { epapersApi, uploadApi, locationsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const INITIAL_FORM = {
  title: '',
  date: '',
  pdfUrl: '',
  area: '',
  status: 'active'
};

const getAreaName = (area, lang = 'te') => {
  if (!area) return '-';
  if (typeof area.name === 'string') return area.name;
  if (area.name instanceof Map) {
    const value = area.name.get(lang);
    return (typeof value === 'string' && value.trim()) ? value.trim() : '-';
  }
  const value = area.name?.[lang];
  return (typeof value === 'string' && value.trim()) ? value.trim() : '-';
};

const EPaperManager = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [epapers, setEpapers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEPaper, setEditingEPaper] = useState(null);
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchEpapers();
    }
  }, [page, rowsPerPage, filterStatus, isAdmin]);

  const fetchAreas = async () => {
    try {
      const response = await locationsApi.getAreas({ limit: 500 });
      setAreas(response.data.areas || []);
    } catch (err) {
      console.error('Failed to fetch areas:', err);
    }
  };

  const fetchEpapers = async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };
      if (filterStatus) params.status = filterStatus;

      const response = await epapersApi.getAll(params);
      setEpapers(response.data.epapers);
      setTotal(response.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch e-papers:', err);
      setError('Failed to load e-papers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (epaper = null) => {
    if (epaper) {
      setEditingEPaper(epaper);
      setFormData({
        title: epaper.title || '',
        date: epaper.date ? epaper.date.slice(0, 10) : '',
        pdfUrl: epaper.pdfUrl || '',
        area: epaper.area?._id || epaper.area || '',
        status: epaper.status || 'active'
      });
    } else {
      setEditingEPaper(null);
      setFormData({ ...INITIAL_FORM });
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEPaper(null);
    setError(null);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await uploadApi.uploadFile(file);
      const { blobUrl } = response.data;
      setFormData(prev => ({ ...prev, pdfUrl: blobUrl }));
      setSuccess('PDF uploaded successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload PDF');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.date) {
      setError('Date is required');
      return;
    }
    if (!formData.pdfUrl) {
      setError('PDF is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: formData.title.trim(),
        date: formData.date,
        pdfUrl: formData.pdfUrl,
        status: formData.status,
        area: formData.area || null
      };

      if (editingEPaper) {
        await epapersApi.update(editingEPaper._id, payload);
        setSuccess('E-paper updated successfully');
      } else {
        await epapersApi.create(payload);
        setSuccess('E-paper created successfully');
      }

      fetchEpapers();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save e-paper');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this e-paper?')) return;

    try {
      await epapersApi.delete(id);
      setSuccess('E-paper deleted successfully');
      fetchEpapers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete e-paper');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const getPdfFileName = (url) => {
    if (!url) return '';
    try {
      return decodeURIComponent(url.split('/').pop() || 'document.pdf');
    } catch {
      return 'document.pdf';
    }
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Manage E-Papers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Upload E-Paper
        </Button>
      </Box>

      {error && !dialogOpen && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
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

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Area</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>PDF</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : epapers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No e-papers found
                  </TableCell>
                </TableRow>
              ) : (
                epapers.map((epaper) => (
                  <TableRow key={epaper._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 250 }}>
                        {epaper.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(epaper.date)}</TableCell>
                    <TableCell>
                      <Typography variant="caption" noWrap sx={{ maxWidth: 150, display: 'block' }}>
                        {getAreaName(epaper.area, language)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={epaper.status}
                        size="small"
                        color={epaper.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {epaper.pdfUrl && (
                        <Link href={epaper.pdfUrl} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PdfIcon fontSize="small" color="error" />
                          <Typography variant="caption">View PDF</Typography>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenDialog(epaper)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(epaper._id)} color="error">
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingEPaper ? 'Edit E-Paper' : 'Upload E-Paper'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>PDF *</Typography>
              {formData.pdfUrl ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <PdfIcon color="error" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {getPdfFileName(formData.pdfUrl)}
                    </Typography>
                    <Link href={formData.pdfUrl} target="_blank" rel="noopener noreferrer" variant="caption">
                      Preview PDF
                    </Link>
                  </Box>
                  <IconButton size="small" onClick={() => setFormData(prev => ({ ...prev, pdfUrl: '' }))}>
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
                  {uploading ? 'Uploading...' : 'Upload PDF'}
                  <input type="file" hidden accept="application/pdf,.pdf" onChange={handlePdfUpload} />
                </Button>
              )}
            </Grid>

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

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Date *"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Area (optional)</InputLabel>
                <Select
                  value={formData.area}
                  label="Area (optional)"
                  onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  {areas.map((area) => (
                    <MenuItem key={area._id} value={area._id}>
                      {getAreaName(area, language)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
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
            {saving ? 'Saving...' : editingEPaper ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EPaperManager;
