import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL =  'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

console.log("demo")

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('taaja_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add language header
    const lang = Cookies.get('taaja_lang') || 'en';
    config.headers['Accept-Language'] = lang;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if unauthorized
      Cookies.remove('taaja_token');
      // Don't redirect if already on auth pages
      if (!window.location.pathname.includes('/auth')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// API helper functions
export const articlesApi = {
  getAll: (params) => api.get('/articles', { params }),
  getBySlug: (slug, lang = 'en') => api.get(`/articles/slug/${slug}`, { params: { lang } }),
  getById: (id) => api.get(`/articles/${id}`),
  getNearby: (params) => api.get('/articles/nearby', { params }),
  getTrending: (params) => api.get('/articles/trending', { params }),
  create: (data) => api.post('/articles', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  updateStatus: (id, status) => api.put(`/articles/${id}/status`, { status }),
  delete: (id) => api.delete(`/articles/${id}`),
  getManaged: (params) => api.get('/articles/manage/list', { params })
};

export const categoriesApi = {
  getAll: (params) => api.get('/categories', { params }),
  getTree: () => api.get('/categories/tree'),
  getById: (id) => api.get(`/categories/${id}`),
  getBySlug: (slug) => api.get(`/categories/slug/${slug}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
};

export const locationsApi = {
  getCities: (params) => api.get('/locations/cities', { params }),
  getCityById: (id) => api.get(`/locations/cities/${id}`),
  getAreas: (params) => api.get('/locations/areas', { params }),
  getAreaById: (id) => api.get(`/locations/areas/${id}`),
  getNearbyCities: (params) => api.get('/locations/cities/nearby', { params }),
  getNearbyAreas: (params) => api.get('/locations/areas/nearby', { params }),
  getStates: () => api.get('/locations/states')
};

export const engagementApi = {
  recordView: (articleId, sessionId) => api.post(`/engagement/view/${articleId}`, { sessionId }),
  like: (articleId) => api.post(`/engagement/like/${articleId}`),
  dislike: (articleId) => api.post(`/engagement/dislike/${articleId}`),
  share: (articleId, platform) => api.post(`/engagement/share/${articleId}`, { platform }),
  bookmark: (articleId) => api.post(`/engagement/bookmark/${articleId}`),
  getBookmarks: (params) => api.get('/engagement/bookmarks', { params }),
  getStatus: (articleId) => api.get(`/engagement/status/${articleId}`),
  getComments: (articleId) => api.get(`/engagement/comments/${articleId}`),
  addComment: (articleId, data) => api.post(`/engagement/comments/${articleId}`, data),
  likeComment: (commentId) => api.post(`/engagement/comments/${commentId}/like`),
  moderateComment: (commentId, data) => api.put(`/engagement/comments/${commentId}/moderate`, data)
};

export const uploadApi = {
  getSasToken: (filename, contentType) => api.post('/upload/sas-token', { filename, contentType }),
  getSasTokens: (files) => api.post('/upload/sas-tokens', { files }),
  getReadUrl: (blobName, expiresInMinutes) => api.post('/upload/read-url', { blobName, expiresInMinutes }),
  confirmUpload: (blobUrl, blobName, type) => api.post('/upload/confirm', { blobUrl, blobName, type }),
  delete: (blobName) => api.delete(`/upload/${blobName}`),
  // Upload file through backend (bypasses CORS)
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  createAdmin: (data) => api.post('/auth/admin/create', data)
};

export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  updateProfile: (data) => api.put('/users/profile', data),
  updatePreferences: (data) => api.put('/users/preferences', data),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, isActive) => api.put(`/users/${id}/status`, { isActive }),
  getReporters: () => api.get('/users/reporters'),
  assignCategories: (id, categories) => api.put(`/users/reporters/${id}/categories`, { categories })
};

export const translateApi = {
  translate: (data) => api.post('/translate', data)
};

export const languagesApi = {
  getAll: () => api.get('/languages'),
  getAllAdmin: () => api.get('/languages/all'),
  getDefault: () => api.get('/languages/default'),
  create: (data) => api.post('/languages', data),
  update: (id, data) => api.put(`/languages/${id}`, data),
  setDefault: (id) => api.put(`/languages/${id}/default`),
  delete: (id) => api.delete(`/languages/${id}`),
  reorder: (orders) => api.put('/languages/reorder/batch', { orders })
};

export default api;
