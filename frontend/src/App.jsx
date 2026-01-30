import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLocation } from './contexts/LocationContext';
import { Box, CircularProgress } from '@mui/material';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public pages
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import ArticleView from './pages/ArticleView';
import CategoryView from './pages/CategoryView';
import FlipReader from './pages/FlipReader';
import Search from './pages/Search';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Dashboard pages
import Dashboard from './pages/dashboard/Dashboard';
import ArticlesList from './pages/dashboard/ArticlesList';
import ArticleEditor from './pages/dashboard/ArticleEditor';
import CategoriesManager from './pages/dashboard/CategoriesManager';
import UsersManager from './pages/dashboard/UsersManager';
import LocationsManager from './pages/dashboard/LocationsManager';
import LanguagesManager from './pages/dashboard/LanguagesManager';

// Loading screen
const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)'
    }}
  >
    <CircularProgress sx={{ color: 'white' }} size={48} />
  </Box>
);

// Protected route wrapper
const ProtectedRoute = ({ children, requireAuth = false, requireReporter = false, requireAdmin = false }) => {
  const { user, loading, isAuthenticated, isReporter, isAdmin } = useAuth();
  const { isOnboardingComplete } = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requireReporter && !isReporter) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Onboarding gate
const OnboardingGate = ({ children }) => {
  const { isOnboardingComplete, loading } = useLocation();
  const { loading: authLoading } = useAuth();

  if (loading || authLoading) {
    return <LoadingScreen />;
  }

  if (!isOnboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

function App() {
  const { loading: authLoading } = useAuth();
  const { loading: locationLoading } = useLocation();

  if (authLoading || locationLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Onboarding */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Auth routes */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />

      {/* Public routes with main layout */}
      <Route
        path="/"
        element={
          <OnboardingGate>
            <MainLayout />
          </OnboardingGate>
        }
      >
        <Route index element={<Home />} />
        <Route path="article/:slug" element={<ArticleView />} />
        <Route path="category/:slug" element={<CategoryView />} />
        <Route path="search" element={<Search />} />
        <Route path="bookmarks" element={
          <ProtectedRoute requireAuth>
            <Search bookmarks />
          </ProtectedRoute>
        } />
      </Route>

      {/* Flip reader (fullscreen) */}
      <Route
        path="/read/:slug"
        element={
          <OnboardingGate>
            <FlipReader />
          </OnboardingGate>
        }
      />

      {/* Dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireAuth requireReporter>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="articles" element={<ArticlesList />} />
        <Route path="articles/new" element={<ArticleEditor />} />
        <Route path="articles/edit/:id" element={<ArticleEditor />} />
        <Route
          path="categories"
          element={
            <ProtectedRoute requireAdmin>
              <CategoriesManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute requireAdmin>
              <UsersManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="locations"
          element={
            <ProtectedRoute requireAdmin>
              <LocationsManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="languages"
          element={
            <ProtectedRoute requireAdmin>
              <LanguagesManager />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
