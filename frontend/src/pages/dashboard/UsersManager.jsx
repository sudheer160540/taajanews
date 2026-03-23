import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { usersApi, authApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = ['user', 'reporter', 'admin'];
const emptyForm = { name: '', email: '', password: '', role: 'user' };

const UsersManager = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Add User
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [adding, setAdding] = useState(false);

  // Delete User
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: rowsPerPage };
      if (searchQuery) params.search = searchQuery;
      const response = await usersApi.getAll(params);
      setUsers(response.data.users);
      setTotal(response.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Actions menu ────────────────────────────────────────
  const handleMenuOpen = (event, user) => {
    setMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedUser(null);
  };

  const handleRoleChange = async (role) => {
    try {
      await usersApi.updateRole(selectedUser._id, role);
      setSuccess(`User role updated to ${role}`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
    handleMenuClose();
  };

  const handleStatusToggle = async () => {
    try {
      await usersApi.updateStatus(selectedUser._id, !selectedUser.isActive);
      setSuccess(`User ${selectedUser.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
    handleMenuClose();
  };

  // ── Add User ────────────────────────────────────────────
  const handleAddOpen = () => {
    setForm(emptyForm);
    setFormErrors({});
    setAddOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Invalid email address';
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 6) errors.password = 'Minimum 6 characters';
    return errors;
  };

  const handleAddSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setAdding(true);
    try {
      await authApi.createAdmin({ ...form });
      setAddOpen(false);
      showSnack(`User "${form.name}" created successfully`);
      fetchUsers();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setAdding(false);
    }
  };

  // ── Delete User ─────────────────────────────────────────
  const handleDeleteClick = (user) => {
    handleMenuClose();
    setDeleteDialog({ open: true, user });
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await usersApi.delete(deleteDialog.user._id);
      setDeleteDialog({ open: false, user: null });
      showSnack('User deleted successfully');
      fetchUsers();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to delete user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'reporter': return 'primary';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {t('manageUsers')}
        </Typography>

        {/* Add User — admin only */}
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleAddOpen}
            sx={{ borderRadius: 2 }}
          >
            Add User
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Search */}
      <TextField
        placeholder="Search users..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ mb: 3, width: 300 }}
        size="small"
      />

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">{t('loading')}</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">{t('noResults')}</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.avatar} sx={{ width: 36, height: 36 }}>
                          {user.name?.[0]}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {user.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" color={getRoleColor(user.role)} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={user.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>{user.lastLogin ? formatDate(user.lastLogin) : '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, user)}>
                        <MoreIcon fontSize="small" />
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
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Card>

      {/* Actions Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">Change Role</Typography>
        </MenuItem>
        {selectedUser?.role !== 'user' && (
          <MenuItem onClick={() => handleRoleChange('user')}>Set as User</MenuItem>
        )}
        {selectedUser?.role !== 'reporter' && (
          <MenuItem onClick={() => handleRoleChange('reporter')}>Set as Reporter</MenuItem>
        )}
        {selectedUser?.role !== 'admin' && (
          <MenuItem onClick={() => handleRoleChange('admin')}>Set as Admin</MenuItem>
        )}
        <MenuItem divider />
        <MenuItem onClick={handleStatusToggle}>
          {selectedUser?.isActive ? 'Deactivate User' : 'Activate User'}
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => handleDeleteClick(selectedUser)} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete User
          </MenuItem>
        )}
      </Menu>

      {/* ── Add User Dialog ─────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => !adding && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon color="primary" />
          Add New User
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleFormChange}
            error={!!formErrors.name}
            helperText={formErrors.name}
            fullWidth
            autoFocus
          />
          <TextField
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleFormChange}
            error={!!formErrors.email}
            helperText={formErrors.email}
            fullWidth
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleFormChange}
            error={!!formErrors.password}
            helperText={formErrors.password}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={form.role}
              label="Role"
              onChange={handleFormChange}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
          <Button
            onClick={handleAddSubmit}
            variant="contained"
            disabled={adding}
            startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
          >
            {adding ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────── */}
      <Dialog open={deleteDialog.open} onClose={() => !deleting && setDeleteDialog({ open: false, user: null })}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete{' '}
            <strong>{deleteDialog.user?.name}</strong> ({deleteDialog.user?.email})?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, user: null })} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ─────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UsersManager;
