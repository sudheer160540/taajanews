import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
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
import YellowPages from './pages/YellowPages';
import Videos from './pages/Videos';
import DeleteAccount from './pages/DeleteAccount';
import AboutUs from './pages/AboutUs';
import EditorialPolicy from './pages/EditorialPolicy';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';

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
import PromotionsManager from './pages/dashboard/PromotionsManager';
import VideosManager from './pages/dashboard/VideosManager';

const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #B80000 0%, #D43333 100%)'
    }}
  >
    <CircularProgress sx={{ color: 'white' }} size={48} />
  </Box>
);

const ProtectedRoute = ({ children, requireAuth = false, requireReporter = false, requireAdmin = false }) => {
  const { loading, isAuthenticated, isReporter, isAdmin } = useAuth();

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

function App() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Onboarding (optional — accessible but not forced) */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Auth routes */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />

      {/* Public routes — default landing is news feed */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="article/:slug" element={<ArticleView />} />
        <Route path="category/:slug" element={<CategoryView />} />
        <Route path="search" element={<Search />} />
        <Route path="yellow-pages" element={<YellowPages />} />
        <Route path="videos" element={<Videos />} />
        <Route path="about" element={<AboutUs />} />
        <Route path="editorial-policy" element={<EditorialPolicy />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsAndConditions />} />
        <Route path="delete-account" element={<DeleteAccount />} />
        <Route path="bookmarks" element={
          <ProtectedRoute requireAuth>
            <Search bookmarks />
          </ProtectedRoute>
        } />
      </Route>

      {/* Flip reader (fullscreen) */}
      <Route path="/read/:slug" element={<FlipReader />} />

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
        <Route path="categories" element={<ProtectedRoute requireAdmin><CategoriesManager /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute requireAdmin><UsersManager /></ProtectedRoute>} />
        <Route path="locations" element={<ProtectedRoute requireAdmin><LocationsManager /></ProtectedRoute>} />
        <Route path="languages" element={<ProtectedRoute requireAdmin><LanguagesManager /></ProtectedRoute>} />
        <Route path="promotions" element={<ProtectedRoute requireAdmin><PromotionsManager /></ProtectedRoute>} />
        <Route path="videos" element={<ProtectedRoute requireAdmin><VideosManager /></ProtectedRoute>} />
      </Route>

      {/* Catch all — go to home feed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
