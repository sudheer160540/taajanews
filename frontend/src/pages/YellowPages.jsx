import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Grid,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Email as EmailIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { yellowPagesApi } from '../services/api';

const YellowPages = () => {
  const { t, localizeField } = useLanguage();
  const { city, area, coordinates } = useLocation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: currentPage, limit: 20 };

      if (coordinates) {
        params.latitude = coordinates.lat;
        params.longitude = coordinates.lng;
        params.radius = 50;
      }

      const response = await yellowPagesApi.getNearby(params);
      setUsers(response.data.users || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load yellow pages:', err);
      setError('Failed to load business directory');
    } finally {
      setLoading(false);
    }
  }, [coordinates]);

  useEffect(() => {
    fetchUsers(page);
  }, [fetchUsers, page]);

  const handlePageChange = (_, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getDisplayName = (item) => {
    if (!item) return '';
    if (typeof item.name === 'string') return item.name;
    return localizeField(item.name);
  };

  const filteredUsers = searchTerm
    ? users.filter(u =>
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone || '').includes(searchTerm) ||
        (u.address || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : users;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Yellow Pages
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Business directory listings
          {city && (
            <Chip
              icon={<LocationIcon />}
              label={area ? getDisplayName(area) : getDisplayName(city)}
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
      </Box>

      <TextField
        fullWidth
        placeholder="Search businesses by name, phone, or address..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          )
        }}
        sx={{ mb: 3 }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : filteredUsers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BusinessIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No business listings found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try a different search term' : 'No listings available in your area yet'}
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {filteredUsers.map((user) => (
              <Grid item xs={12} sm={6} md={4} key={user._id}>
                <Card sx={{ height: '100%', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        src={user.avatar}
                        sx={{ width: 56, height: 56, mr: 2, bgcolor: 'primary.main', fontSize: 20 }}
                      >
                        {(user.name || 'B')[0].toUpperCase()}
                      </Avatar>
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography variant="h6" fontWeight={600} noWrap>
                          {user.name}
                        </Typography>
                        {user.businessCategory && (
                          <Chip label={user.businessCategory} size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    {user.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          <a href={`tel:${user.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {user.phone}
                          </a>
                        </Typography>
                      </Box>
                    )}

                    {user.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <EmailIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {user.email}
                        </Typography>
                      </Box>
                    )}

                    {user.address && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <LocationIcon fontSize="small" color="action" sx={{ mr: 1, mt: 0.3 }} />
                        <Typography variant="body2" color="text.secondary">
                          {user.address}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default YellowPages;
