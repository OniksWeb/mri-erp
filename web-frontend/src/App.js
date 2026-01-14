// web-frontend/src/App.js
import React, { useEffect } from 'react'; // ✅ Added useEffect
import { Routes, Route, useLocation } from 'react-router-dom'; // ✅ Added useLocation

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import PatientListPage from './pages/PatientListPage';
import AddPatientPage from './pages/AddPatientPage';
import AdminPanelPage from './pages/AdminPanelPage';
import UserProfilePage from './pages/UserProfilePage';
import SubmitQueryPage from './pages/SubmitQueryPage';
import MyQueriesPage from './pages/MyQueriesPage';
import AdminQueriesPage from './pages/AdminQueriesPage';
import ChatPage from './pages/ChatPage';
import PatientDetailPage from './pages/PatientDetailPage';
import ResultUploadPage from './pages/ResultUploadPage';
import ResultManagementPage from './pages/ResultManagementPage';
import AdminStaffActivityPage from './pages/AdminStaffActivityPage';
import ResultsDashboardPage from './pages/ResultsDashboardPage';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// ✅ NEW COMPONENT: Tracks route changes and saves to LocalStorage
const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // We do NOT want to save the login or register pages as the "last visited"
    const publicPaths = ['/login', '/register', '/'];
    
    if (!publicPaths.includes(location.pathname)) {
      localStorage.setItem('last_visited_route', location.pathname);
      console.log('📍 Progress Saved:', location.pathname);
    }
  }, [location]);

  return null; // This component doesn't render anything visible
};

function App() {
  return (
    <div className="App">
      {/* ✅ Insert the Tracker here so it monitors all Route changes */}
      <RouteTracker /> 

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes - require authentication and specific roles */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <PatientListPage />
            </ProtectedRoute>
          }
        />
         <Route
          path="/patients/add"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <AddPatientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/details" // Patient Detail, Edit, Delete page
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/results/manage" // NEW: Manage Results (list, status, issue)
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor']}> 
              <ResultManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/upload" // NEW: Result Upload page
          element={
            <ProtectedRoute requiredRoles={['admin', 'doctor']}> 
              <ResultUploadPage />
            </ProtectedRoute>
          }
        />
       <Route
          path="/results/dashboard" 
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <ResultsDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/queries/submit"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <SubmitQueryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/queries/my"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <MyQueriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <AdminPanelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/queries"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <AdminQueriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff-activity"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <AdminStaffActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all for undefined routes */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;