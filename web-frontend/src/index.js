// web-frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter as Router } from 'react-router-dom'; // Import BrowserRouter here
// web-frontend/src/index.js (or main entry point)
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router> {/* The Router now wraps everything */}
      <ThemeProvider>
        <AuthProvider>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
          <App />
          </LocalizationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
);