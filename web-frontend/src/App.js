// web-frontend/src/App.js
import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

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
import ResultManagementPage from './pages/ResultManagementPage';
import AdminStaffActivityPage from './pages/AdminStaffActivityPage';
import ResultsDashboardPage from './pages/ResultsDashboardPage';
import InventoryPage from './pages/InventoryPage';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Tracks route changes and saves to LocalStorage
const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const publicPaths = ['/login', '/register', '/'];
    
    if (!publicPaths.includes(location.pathname)) {
      localStorage.setItem('last_visited_route', location.pathname);
      console.log('📍 Progress Saved:', location.pathname);
    }
  }, [location]);

  return null;
};

function App() {
  return (
    <div className="App">
      <RouteTracker /> 

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes */}
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
          path="/patients/:id/details"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor', 'financial_admin']}>
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/results/manage"
          element={
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor']}> 
              <ResultManagementPage />
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
          path="/inventory" 
          element={
            <ProtectedRoute requiredRoles={['admin', 'inventory_manager', 'hq_financial_admin']}>
              <InventoryPage />
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