import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Chip,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { languagesApi } from '../../services/api';
import languageService from '../../services/languageService';

const LanguagesManager = () => {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nativeName: '',
    isRTL: false
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLanguage, setDeletingLanguage] = useState(null);

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await languagesApi.getAllAdmin();
      setLanguages(response.data.languages || []);
    } catch (err) {
      setError('Failed to load languages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (language = null) => {
    if (language) {
      setEditingLanguage(language);
      setFormData({
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        isRTL: language.isRTL || false
      });
    } else {
      setEditingLanguage(null);
      setFormData({
        code: '',
        name: '',
        nativeName: '',
        isRTL: false
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLanguage(null);
    setFormData({ code: '', name: '', nativeName: '', isRTL: false });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (editingLanguage) {
        await languagesApi.update(editingLanguage._id, {
          name: formData.name,
          nativeName: formData.nativeName,
          isRTL: formData.isRTL
        });
        setSuccess('Language updated successfully');
      } else {
        await languagesApi.create(formData);
        setSuccess('Language created successfully');
      }

      handleCloseDialog();
      fetchLanguages();
      languageService.refreshCache();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save language');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (language) => {
    try {
      setError(null);
      await languagesApi.setDefault(language._id);
      setSuccess(`${language.name} is now the default language`);
      fetchLanguages();
      languageService.refreshCache();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set default language');
    }
  };

  const handleToggleActive = async (language) => {
    try {
      setError(null);
      await languagesApi.update(language._id, { isActive: !language.isActive });
      setSuccess(`Language ${language.isActive ? 'deactivated' : 'activated'}`);
      fetchLanguages();
      languageService.refreshCache();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update language status');
    }
  };

  const handleDelete = async () => {
    if (!deletingLanguage) return;
    
    try {
      setError(null);
      await languagesApi.delete(deletingLanguage._id);
      setSuccess('Language deactivated successfully');
      setDeleteDialogOpen(false);
      setDeletingLanguage(null);
      fetchLanguages();
      languageService.refreshCache();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete language');
    }
  };

  const handleOpenDeleteDialog = (language) => {
    setDeletingLanguage(language);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Language Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Language
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50}></TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Native Name</TableCell>
                <TableCell align="center">RTL</TableCell>
                <TableCell align="center">Default</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {languages.map((language) => (
                <TableRow key={language._id} hover>
                  <TableCell>
                    <DragIcon sx={{ color: 'text.disabled', cursor: 'grab' }} />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={language.code} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{language.name}</TableCell>
                  <TableCell>{language.nativeName}</TableCell>
                  <TableCell align="center">
                    {language.isRTL ? (
                      <Chip label="RTL" size="small" color="info" />
                    ) : (
                      <Typography variant="body2" color="text.disabled">LTR</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={language.isDefault ? 'Default language' : 'Set as default'}>
                      <IconButton
                        onClick={() => !language.isDefault && handleSetDefault(language)}
                        color={language.isDefault ? 'primary' : 'default'}
                        disabled={!language.isActive}
                      >
                        {language.isDefault ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={language.isActive}
                          onChange={() => handleToggleActive(language)}
                          disabled={language.isDefault}
                        />
                      }
                      label={language.isActive ? 'Active' : 'Inactive'}
                      labelPlacement="end"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton onClick={() => handleOpenDialog(language)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={language.isDefault ? "Cannot delete default language" : "Deactivate"}>
                      <span>
                        <IconButton
                          onClick={() => handleOpenDeleteDialog(language)}
                          disabled={language.isDefault}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {languages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No languages found. Add your first language to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLanguage ? 'Edit Language' : 'Add New Language'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Language Code"
              placeholder="e.g., en, hi, ta"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
              disabled={!!editingLanguage}
              required
              helperText="ISO 639-1 code (2 letters)"
              inputProps={{ maxLength: 10 }}
            />
            <TextField
              label="Name"
              placeholder="e.g., English, Hindi"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              label="Native Name"
              placeholder="e.g., English, हिन्दी"
              value={formData.nativeName}
              onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
              required
              helperText="Name in the native script"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isRTL}
                  onChange={(e) => setFormData({ ...formData, isRTL: e.target.checked })}
                />
              }
              label="Right-to-Left (RTL) language"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !formData.code || !formData.name || !formData.nativeName}
          >
            {saving ? <CircularProgress size={24} /> : (editingLanguage ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Deactivate Language</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate <strong>{deletingLanguage?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will hide the language from users but won't delete existing content.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LanguagesManager;
