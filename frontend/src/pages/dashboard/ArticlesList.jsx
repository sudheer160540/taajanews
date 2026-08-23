import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { articlesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const ArticlesList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isEditor, canPublish, canArchiveArticles, canDeleteArticles, user } = useAuth();
  const lang = i18n.language;

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishArticle, setPublishArticle] = useState(null);
  const [sendNotification, setSendNotification] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    fetchArticles();
  }, [page, rowsPerPage, statusFilter, fromDate, toDate, search]);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: rowsPerPage };
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (search) params.search = search;

      const response = await articlesApi.getManaged(params);
      setArticles(response.data.articles);
      setTotal(response.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, article) => {
    setMenuAnchor(event.currentTarget);
    setSelectedArticle(article);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedArticle(null);
  };

  const handleStatusChange = async (status) => {
    try {
      await articlesApi.updateStatus(selectedArticle._id, status);
      fetchArticles();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    handleMenuClose();
  };

  const openPublishDialog = () => {
    setPublishArticle(selectedArticle);
    setSendNotification(true);
    setPublishDialogOpen(true);
    // Close the menu but keep the target article captured in publishArticle.
    setMenuAnchor(null);
  };

  const closePublishDialog = () => {
    if (publishing) return;
    setPublishDialogOpen(false);
    setPublishArticle(null);
    setSelectedArticle(null);
  };

  const handleConfirmPublish = async () => {
    if (!publishArticle) return;
    setPublishing(true);
    try {
      await articlesApi.updateStatus(publishArticle._id, 'published', { sendNotification });
      fetchArticles();
      setPublishDialogOpen(false);
      setPublishArticle(null);
      setSelectedArticle(null);
    } catch (err) {
      console.error('Failed to publish article:', err);
      alert(err.response?.data?.error || 'Failed to publish article');
    } finally {
      setPublishing(false);
    }
  };

  const canEditArticle = (article) => {
    if (isEditor) return true;
    const ownerId = article.createdBy?._id || article.author?._id;
    return ownerId?.toString() === (user?.id || user?._id)?.toString();
  };

  const handleDeleteArticle = async () => {
    if (!selectedArticle) return;
    const title = typeof selectedArticle.title === 'string'
      ? selectedArticle.title
      : (selectedArticle.title?.te || selectedArticle.title?.en || 'this article');
    if (!window.confirm(`Permanently delete "${title}"? This removes all images, audio, and videos from storage and cannot be undone.`)) {
      return;
    }

    try {
      await articlesApi.delete(selectedArticle._id);
      fetchArticles();
    } catch (err) {
      console.error('Failed to delete article:', err);
      alert(err.response?.data?.error || 'Failed to delete article');
    }
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'success';
      case 'draft': return 'default';
      case 'pending': return 'warning';
      case 'archived': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setStatusFilter('');
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
          {t('myArticles')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/dashboard/articles/new')}
        >
          {t('createArticle')}
        </Button>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search articles by title, slug, article ID, reporter, or source URL..."
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
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="draft">{t('draft')}</MenuItem>
            <MenuItem value="pending">{t('pending')}</MenuItem>
            <MenuItem value="published">{t('published')}</MenuItem>
            <MenuItem value="archived">{t('archived')}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <TextField
          size="small"
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        {(fromDate || toDate || statusFilter || search) && (
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </Box>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Views</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    {t('noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => (
                  <TableRow key={article._id} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {typeof article.title === 'string' ? article.title : (article.title?.te || article.title?.en || article.title)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={typeof article.category?.name === 'string' 
                          ? article.category.name 
                          : (article.category?.name?.te || article.category?.name?.en || '-')}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={article.status}
                        size="small"
                        color={getStatusColor(article.status)}
                      />
                    </TableCell>
                    <TableCell>{article.engagement?.views || 0}</TableCell>
                    <TableCell>{formatDate(article.createdAt)}</TableCell>
                    <TableCell align="right">
                      {canEditArticle(article) && (
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/dashboard/articles/edit/${article._id}`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => window.open(`/article/${article.slug}`, '_blank')}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      {(canEditArticle(article) || canPublish || canDeleteArticles) && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, article)}
                        >
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      )}
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

      {/* Actions Menu — role-based status transitions */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {/* Any role: submit draft for review */}
        {selectedArticle?.status === 'draft' && (
          <MenuItem onClick={() => handleStatusChange('pending')}>
            Submit for Review
          </MenuItem>
        )}
        {/* Sub-editor+: send pending article back to draft for rework */}
        {isEditor && selectedArticle?.status === 'pending' && (
          <MenuItem onClick={() => handleStatusChange('draft')}>
            Send Back to Draft
          </MenuItem>
        )}
        {/* Sub-Editor+: publish pending article */}
        {canPublish && selectedArticle?.status === 'pending' && (
          <MenuItem onClick={openPublishDialog}>
            Publish
          </MenuItem>
        )}
        {/* Chief Editor / Admin: archive published article */}
        {canArchiveArticles && selectedArticle?.status === 'published' && (
          <MenuItem onClick={() => handleStatusChange('archived')}>
            Archive
          </MenuItem>
        )}
        {/* Chief Editor / Admin: restore archived article */}
        {canArchiveArticles && selectedArticle?.status === 'archived' && (
          <MenuItem onClick={() => handleStatusChange('draft')}>
            Restore to Draft
          </MenuItem>
        )}
        {canDeleteArticles && (
          <MenuItem onClick={handleDeleteArticle} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Permanently
          </MenuItem>
        )}
      </Menu>

      {/* Publish confirmation dialog with optional notification */}
      <Dialog open={publishDialogOpen} onClose={closePublishDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Publish article?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Are you sure you want to publish
            {' '}
            "{typeof publishArticle?.title === 'string'
              ? publishArticle.title
              : (publishArticle?.title?.te || publishArticle?.title?.en || 'this article')}"?
          </DialogContentText>
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
          <Button onClick={closePublishDialog} disabled={publishing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmPublish}
            disabled={publishing}
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArticlesList;
