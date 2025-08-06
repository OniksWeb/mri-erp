// web-frontend/src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import PatientListPage from './pages/PatientListPage';
import AddPatientPage from './pages/AddPatientPage';
import AdminPanelPage from './pages/AdminPanelPage';
import UserProfilePage from './pages/UserProfilePage';
import SubmitQueryPage from './pages/SubmitQueryPage'; // Corrected to SubmitQueryPage
import MyQueriesPage from './pages/MyQueriesPage';
import AdminQueriesPage from './pages/AdminQueriesPage';
import ChatPage from './pages/ChatPage'; // Chat page (currently disabled in SideNav but code is here)
import PatientDetailPage from './pages/PatientDetailPage'; // Patient Detail, Edit, Delete
import ResultUploadPage from './pages/ResultUploadPage'; // NEW: Result Upload page
import ResultManagementPage from './pages/ResultManagementPage'; // NEW: Result Management/Issue page
import AdminStaffActivityPage from './pages/AdminStaffActivityPage'; // Admin Staff Activity Analytics
import ResultsUploadPage from './pages/ResultUploadPage';
import ResultsDashboardPage from './pages/ResultsDashboardPage';


// Components
import ProtectedRoute from './components/ProtectedRoute'; // Our ProtectedRoute component

function App() {
  return (
    <div className="App">
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
            <ProtectedRoute requiredRoles={['medical_staff', 'admin', 'doctor']}> {/* Added doctor role for result management */}
              <ResultManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/upload" // NEW: Result Upload page
          element={
            <ProtectedRoute requiredRoles={['admin', 'doctor']}> {/* Admin & Doctor upload results */}
              <ResultUploadPage />
            </ProtectedRoute>
          }
        />
       <Route
          path="/results/dashboard" // This is the path your SideNav button points to
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