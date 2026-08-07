import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

import MainLayout from './layouts/MainLayout';

// Code-split pages so mobile only downloads what it needs for the current route
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Home = lazy(() => import('./pages/Home'));
const ArticleView = lazy(() => import('./pages/ArticleView'));
const CategoryView = lazy(() => import('./pages/CategoryView'));
const FlipReader = lazy(() => import('./pages/FlipReader'));
const Search = lazy(() => import('./pages/Search'));
const YellowPages = lazy(() => import('./pages/YellowPages'));
const Videos = lazy(() => import('./pages/Videos'));
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const EditorialPolicy = lazy(() => import('./pages/EditorialPolicy'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const ContactUs = lazy(() => import('./pages/ContactUs'));

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const ArticlesList = lazy(() => import('./pages/dashboard/ArticlesList'));
const ArticleEditor = lazy(() => import('./pages/dashboard/ArticleEditor'));
const CategoriesManager = lazy(() => import('./pages/dashboard/CategoriesManager'));
const UsersManager = lazy(() => import('./pages/dashboard/UsersManager'));
const LocationsManager = lazy(() => import('./pages/dashboard/LocationsManager'));
const LanguagesManager = lazy(() => import('./pages/dashboard/LanguagesManager'));
const PromotionsManager = lazy(() => import('./pages/dashboard/PromotionsManager'));
const EPaperManager = lazy(() => import('./pages/dashboard/EPaperManager'));
const VideosManager = lazy(() => import('./pages/dashboard/VideosManager'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));

const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '40vh',
      py: 6
    }}
  >
    <CircularProgress color="primary" size={40} />
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
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  // Do not block the whole app on auth — public homepage can render immediately
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />

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
          <Route path="contact" element={<ContactUs />} />
          <Route
            path="bookmarks"
            element={
              <ProtectedRoute requireAuth>
                <Search bookmarks />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/read/:slug" element={<FlipReader />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireAuth requireReporter>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="articles" element={<ArticlesList />} />
          <Route path="articles/new" element={<ArticleEditor />} />
          <Route path="articles/edit/:id" element={<ArticleEditor />} />
          <Route path="categories" element={<ProtectedRoute requireAdmin><CategoriesManager /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute requireAdmin><UsersManager /></ProtectedRoute>} />
          <Route path="locations" element={<ProtectedRoute requireAdmin><LocationsManager /></ProtectedRoute>} />
          <Route path="languages" element={<ProtectedRoute requireAdmin><LanguagesManager /></ProtectedRoute>} />
          <Route path="promotions" element={<ProtectedRoute requireAdmin><PromotionsManager /></ProtectedRoute>} />
          <Route path="epapers" element={<EPaperManager />} />
          <Route path="videos" element={<ProtectedRoute requireAdmin><VideosManager /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
