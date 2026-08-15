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
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { articlesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedField } from '../../utils/articleLocalization';

/**
 * Persisted audio lives on article.audio as a lang→URL map
 * (same shape Edit Article uses: article.audio[currentLang]).
 * Example: { te: 'https://...wav', en: 'https://...wav', hi: '...' }
 */
const normalizeAudioMap = (audio) => {
  if (!audio) return {};
  if (audio instanceof Map) {
    return Object.fromEntries(
      [...audio.entries()].filter(([, v]) => typeof v === 'string' && v.trim())
    );
  }
  if (typeof audio !== 'object') return {};
  const out = {};
  Object.entries(audio).forEach(([lang, url]) => {
    if (typeof url === 'string' && url.trim()) out[lang] = url.trim();
  });
  return out;
};

/** Resolve download URL the same way ArticleEditor picks the player src. */
const resolveArticleAudioUrl = (article, preferredLang = 'en') => {
  if (!article) return null;
  const audio = normalizeAudioMap(article.audio);
  const lang = String(preferredLang || 'en').split('-')[0];
  return (
    audio[lang] ||
    audio.en ||
    audio.te ||
    audio.hi ||
    Object.values(audio).find(Boolean) ||
    (typeof article.audioUrl === 'string' && article.audioUrl.trim() ? article.audioUrl.trim() : null) ||
    null
  );
};

const downloadArticleAudio = async (article, preferredLang = 'en') => {
  const audioUrl = resolveArticleAudioUrl(article, preferredLang);
  if (!audioUrl) return;

  const title =
    getLocalizedField(article.title, preferredLang) ||
    (typeof article.title === 'string' ? article.title : '') ||
    'article-audio';
  const safeName = String(title || 'article-audio')
    .replace(/[^\w\u0C00-\u0C7F\u0900-\u097F\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'article-audio';

  const triggerBlobDownload = (blob, filename) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  // Try authenticated proxy when available; otherwise download the Azure URL directly
  if (article?._id) {
    try {
      const response = await articlesApi.downloadAudio(article._id, {
        lang: String(preferredLang || 'en').split('-')[0]
      });
      const blob = response.data;
      const contentType = response.headers?.['content-type'] || blob.type || '';
      if (!contentType.includes('application/json')) {
        const ext = contentType.includes('mpeg') ? 'mp3' : 'wav';
        triggerBlobDownload(blob, `${safeName}.${ext}`);
        return;
      }
    } catch (err) {
      console.warn('[My Articles] proxy download unavailable, using article.audio URL', err?.message || err);
    }
  }

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Audio fetch failed');
    const blob = await response.blob();
    const ext = blob.type?.includes('mpeg') ? 'mp3' : blob.type?.includes('wav') ? 'wav' : 'audio';
    triggerBlobDownload(blob, `${safeName}.${ext}`);
  } catch {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${safeName}.wav`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

const ArticlesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isEditor, canPublish, canDeleteArticles, user } = useAuth();
  const { language, localizeField } = useLanguage();
  const lang = language;

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
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    fetchArticles();
  }, [page, rowsPerPage, statusFilter, fromDate, toDate, search, lang]);

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
      if (lang) params.lang = String(lang).split('-')[0];

      const response = await articlesApi.getManaged(params);
      const rawList = response.data.articles || [];

      // TEMP: inspect actual manage/list payload (production historically omits `audio`)
      if (rawList[0]) {
        console.log('[My Articles] list API sample keys:', Object.keys(rawList[0]));
        console.log('[My Articles] list API audio fields:', {
          hasAudioKey: Object.prototype.hasOwnProperty.call(rawList[0], 'audio'),
          audio: rawList[0].audio,
          audioUrl: rawList[0].audioUrl
        });
      }

      const list = rawList.map((a) => ({
        ...a,
        audio: normalizeAudioMap(a.audio)
      }));

      setArticles(list);
      setTotal(response.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = async (event, article) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedArticle(article);

    console.log('[My Articles] menu open — list article audio:', {
      audio: article?.audio,
      audioUrl: article?.audioUrl,
      resolved: resolveArticleAudioUrl(article, lang)
    });

    // List API may omit `audio`. Edit API returns the real persisted field: article.audio[lang]
    if (resolveArticleAudioUrl(article, lang)) return;

    try {
      const res = await articlesApi.getById(article._id);
      const audio = normalizeAudioMap(res.data?.article?.audio);
      console.log('[My Articles] edit API article.audio:', audio);
      const enriched = { ...article, audio };
      setSelectedArticle(enriched);
      if (Object.keys(audio).length > 0) {
        setArticles((prev) => prev.map((a) => (a._id === article._id ? enriched : a)));
      }
    } catch (err) {
      console.warn('[My Articles] failed to load article.audio from edit API', err?.message || err);
    }
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

  const canEditArticle = (article) => {
    if (isEditor) return true;
    const ownerId = article.createdBy?._id || article.author?._id;
    return ownerId?.toString() === (user?.id || user?._id)?.toString();
  };

  const handleDeleteArticle = async () => {
    if (!selectedArticle) return;
    const title =
      localizeField(selectedArticle.title) ||
      (typeof selectedArticle.title === 'string' ? selectedArticle.title : '') ||
      'this article';
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

  const handleDownloadAudio = (article, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!resolveArticleAudioUrl(article, lang)) return;
    downloadArticleAudio(article, lang);
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
                articles.map((article) => {
                  const hasAudio = Boolean(resolveArticleAudioUrl(article, lang));
                  return (
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
                        {localizeField(article.title) ||
                          (typeof article.title === 'string' ? article.title : '') ||
                          t('versionUnavailable')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={localizeField(article.category?.name) || '-'}
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
                      {hasAudio && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleDownloadAudio(article, e)}
                          aria-label="Download Audio"
                          title="Download Audio"
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      )}
                      {(canEditArticle(article) || canPublish || canDeleteArticles || hasAudio) && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, article)}
                        >
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
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
        {resolveArticleAudioUrl(selectedArticle, lang) && (
          <MenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDownloadAudio(selectedArticle, e);
              handleMenuClose();
            }}
          >
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
            Download Audio
          </MenuItem>
        )}
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
        {/* Chief editor / Admin: publish pending article */}
        {canPublish && selectedArticle?.status === 'pending' && (
          <MenuItem onClick={() => handleStatusChange('published')}>
            Publish
          </MenuItem>
        )}
        {/* Chief editor / Admin: archive published article */}
        {canPublish && selectedArticle?.status === 'published' && (
          <MenuItem onClick={() => handleStatusChange('archived')}>
            Archive
          </MenuItem>
        )}
        {/* Chief editor / Admin: restore archived article */}
        {canPublish && selectedArticle?.status === 'archived' && (
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
    </Box>
  );
};

export default ArticlesList;
