import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://taajanews-api.onrender.com/api';



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
    
    // Prefer localStorage (i18n source of truth), then cookie, so Accept-Language
    // always matches the Home page language selector.
    let lang = null;
    try {
      lang = localStorage.getItem('taaja_lang');
    } catch {
      lang = null;
    }
    if (!lang) {
      lang = Cookies.get('taaja_lang');
    }
    const normalized = String(lang || 'en').split('-')[0].toLowerCase();
    config.headers['Accept-Language'] = normalized;
    
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
  getFeed: (params) => api.get('/articles/feed', { params }),
  getAll: (params) => api.get('/articles', { params }),
  getBySlug: (slug, lang = 'en') => api.get(`/articles/slug/${slug}`, { params: { lang } }),
  getById: (id) => api.get(`/articles/${id}`),
  getNearby: (params) => api.get('/articles/nearby', { params }),
  getTrending: (params) => api.get('/articles/trending', { params }),
  create: (data) => api.post('/articles', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  updateStatus: (id, status, options = {}) => api.put(`/articles/${id}/status`, { status, ...options }),
  delete: (id) => api.delete(`/articles/${id}`),
  getManaged: (params) => api.get('/articles/manage/list', { params }),
  getStats: () => api.get('/articles/manage/stats'),
  translateAll: (data) => api.post('/articles/translate-all', data),
  downloadAudio: (id, params) => api.get(`/articles/${id}/audio/download`, {
    params,
    responseType: 'blob'
  })
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
  uploadFile: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.crop) {
      formData.append('crop', JSON.stringify(options.crop));
    }
    if (options.crops) {
      formData.append('crops', JSON.stringify(options.crops));
    }
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
  createAdmin: (data) => api.post('/auth/admin/create', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetOtp: (email, otp) => api.post('/auth/verify-reset-otp', { email, otp }),
  resetPassword: (email, otp, password) =>
    api.post('/auth/reset-password', { email, otp, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword })
};

export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getArticleAuthors: (params) => api.get('/users/article-authors', { params }),
  updateProfile: (data) => api.put('/users/profile', data),
  updatePreferences: (data) => api.put('/users/preferences', data),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, isActive) => api.put(`/users/${id}/status`, { isActive }),
  getReporters: () => api.get('/users/reporters'),
  assignCategories: (id, categories) => api.put(`/users/reporters/${id}/categories`, { categories }),
  delete: (id) => api.delete(`/users/${id}`)
};

export const translateApi = {
  translate: (data) => api.post('/translate', data)
};

export const promotionsApi = {
  getAll: (params) => api.get('/promotions/manage/list', { params }),
  getById: (id) => api.get(`/promotions/${id}`),
  create: (data) => api.post('/promotions', data),
  update: (id, data) => api.put(`/promotions/${id}`, data),
  delete: (id) => api.delete(`/promotions/${id}`)
};

export const epapersApi = {
  getFeed: (params) => api.get('/epapers/feed', { params }),
  getAll: (params) => api.get('/epapers/manage/list', { params }),
  getById: (id) => api.get(`/epapers/${id}`),
  create: (data) => api.post('/epapers', data),
  update: (id, data) => api.put(`/epapers/${id}`, data),
  delete: (id) => api.delete(`/epapers/${id}`)
};

export const videosApi = {
  getAll: (params) => api.get('/videos', { params }),
  getPublic: (params) => api.get('/videos/public', { params }),
  getPublicById: (id) => api.get(`/videos/public/${id}`),
  getById: (id) => api.get(`/videos/${id}`),
  create: (data) => api.post('/videos', data),
  update: (id, data) => api.put(`/videos/${id}`, data),
  delete: (id) => api.delete(`/videos/${id}`)
};

export const yellowPagesApi = {
  getNearby: (params) => api.get('/users/yellow-pages/nearby', { params })
};

export const accountDeletionApi = {
  submit: (data) => api.post('/account-deletion', data),
  checkStatus: (email) => api.get(`/account-deletion/status/${encodeURIComponent(email)}`)
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
