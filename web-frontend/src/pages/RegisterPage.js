// web-frontend/src/pages/RegisterPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import companyLogo from '../assets/company_logo.png';

// Material-UI components
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';

function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '', // For password confirmation
    email: '',
    phone_number: '',
    full_name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    const { username, password, confirmPassword, email, full_name, phone_number } = formData;

    // --- Basic Frontend Validation ---
    if (!username || !password || !email || !full_name) {
      setError('All required fields (Username, Password, Email, Full Name) must be provided.');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    if (password.length < 6) { // Basic password strength
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }
    // --- End Validation ---

    try {
      // Make API call to your backend register endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/register`, { // Using PORT 5001
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Do NOT send confirmPassword to backend
        body: JSON.stringify({ username, password, email, phone_number, full_name }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setError('');
        // Clear form
        setFormData({
          username: '', password: '', confirmPassword: '', email: '', phone_number: '', full_name: '',
        });
        // Optionally redirect to login page after a short delay
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration request failed:', err);
      setError('Network error or server unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 4,
          boxShadow: 3,
          borderRadius: 2,
          backgroundColor: 'background.paper', // Use theme's background color for form card
        }}
      >
        <img
                src={companyLogo}
                alt="Company Logo"
                style={{
                    width: '100px',
                    height: 'auto',
                    marginBottom: '20px',
                }}
            />
        <Typography component="h1" variant="h5">
          Register Medical Staff
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          Your account requires admin verification.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
            Registration successful! Awaiting admin verification. Redirecting to login...
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="new-username"
            autoFocus
            value={formData.username}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="full_name"
            label="Full Name"
            name="full_name"
            autoComplete="name"
            value={formData.full_name}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            id="phone_number"
            label="Phone Number (Optional)"
            name="phone_number"
            autoComplete="tel"
            type="tel"
            value={formData.phone_number}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Register'}
          </Button>
          <Link onClick={() => navigate('/login')}>
            {"Already have an account? Sign In"}
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default RegisterPage;