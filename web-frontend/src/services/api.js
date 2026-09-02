// web-frontend/src/services/api.js
import axios from 'axios';

// Create an Axios instance with the base URL configured for your backend
const api = axios.create({
  // ✅ FIX: Force the live DigitalOcean URL as the default fallback
  baseURL: process.env.REACT_APP_API_URL || 'https://g2g-mri-erp-bfw57.ondigitalocean.app/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach the JWT token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;