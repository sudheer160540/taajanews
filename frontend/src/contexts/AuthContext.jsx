import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = Cookies.get('taaja_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (err) {
      console.error('Auth check failed:', err);
      Cookies.remove('taaja_token');
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;

      Cookies.set('taaja_token', token, { expires: 7 });
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error || 'Invalid username or password';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/register', { name, email, password });
      const { token, user: userData } = response.data;

      Cookies.set('taaja_token', token, { expires: 7 });
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    try {
      setError(null);
      const response = await api.post('/auth/google', { idToken });
      const { token, user: userData } = response.data;

      Cookies.set('taaja_token', token, { expires: 7 });
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error || 'Google login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      Cookies.remove('taaja_token');
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    try {
      const response = await api.put('/users/profile', data);
      setUser(prev => ({ ...prev, ...response.data.user }));
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Update failed';
      return { success: false, error: message };
    }
  }, []);

  const updatePreferences = useCallback(async (preferences) => {
    try {
      const response = await api.put('/users/preferences', preferences);
      setUser(prev => ({ 
        ...prev, 
        preferences: response.data.preferences 
      }));
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Update failed';
      return { success: false, error: message };
    }
  }, []);

  const isReporter = ['reporter', 'sub-editor', 'chief-editor', 'admin'].includes(user?.role);
  const isEditor = ['sub-editor', 'chief-editor', 'admin'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    isEditor,
    isReporter,
    login,
    googleLogin,
    register,
    logout,
    updateProfile,
    updatePreferences,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
