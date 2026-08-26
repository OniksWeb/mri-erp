// web-frontend/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout'; // Import our Layout component

function ProtectedRoute({ children, requiredRoles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    // User is not authenticated, redirect to login page
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !requiredRoles.includes(user?.role)) {
    // User is authenticated but doesn't have the required role
    // Redirect to a dashboard or unauthorized page, or show an alert
    return <Navigate to="/dashboard" replace />; // Or show a 403 page
  }

  // User is authenticated and has the required role (if any)
  // Render the Layout component and its children
  return <Layout>{children}</Layout>;
}

export default ProtectedRoute;