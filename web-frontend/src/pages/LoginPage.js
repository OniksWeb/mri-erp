// web-frontend/src/pages/LoginPage.js
import { useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Still need this for redirection
import { useAuth } from '../contexts/AuthContext'; // Our custom authentication hook
import companyLogo from '../assets/company_logo.png';
// Material-UI components
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Paper,
  Alert,
} from '@mui/material';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // Get the login function from our AuthContext
  const navigate = useNavigate(); // For navigating to register page
  const theme = useTheme();
  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    setError(''); // Clear previous errors
    setLoading(true); // Set loading state

    try {
      const response = await fetch('http://localhost:5001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token);
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setError('Network error or server unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        sx={{
          marginTop: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 4,
          // --- UPDATED Glass Morphism Styles for Dark Blue Translucency ---
          backgroundColor: 'rgba(0, 0, 40, 0.3)', // Dark blue with 30% opacity (more translucent)
          backdropFilter: 'blur(12px) saturate(150%)', // Slightly more blur, slightly less saturate
          WebkitBackdropFilter: 'blur(12px) saturate(150%)', // For Safari
          border: '1px solid rgba(100, 100, 255, 0.2)', // Subtle light blue border
          boxShadow: '0 8px 40px 0 rgba(0, 0, 0, 0.4)', // Slightly deeper shadow
          borderRadius: '16px', // Slightly more rounded corners
          color: 'white', // Default text color for the box content
          // --- End UPDATED Glass Morphism Styles ---
        }}
      >
         <img
        src={companyLogo}
        alt="Company Logo"
        style={{
            width: '100px', // Adjust size as needed
            height: 'auto',
            marginBottom: '20px', // Space below the logo
        }}
    />
        <Typography component="h1" variant="h5" sx={{ mb: 2, color: 'white' }}>
          Welcome, please login
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{
              // Adjusted TextField colors for better contrast on dark blue glass
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(200, 200, 255, 0.4)' }, // Lighter border
                '&:hover fieldset': { borderColor: 'rgba(200, 200, 255, 0.6)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
                color: 'white', // Input text color
              },
              '& .MuiInputLabel-root': { color: 'rgba(200, 200, 255, 0.7)' }, // Lighter label
              '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              '& .MuiInputBase-input': { color: 'white' }, // Input text color
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              // Adjusted TextField colors for better contrast on dark blue glass
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(200, 200, 255, 0.4)' }, // Lighter border
                '&:hover fieldset': { borderColor: 'rgba(200, 200, 255, 0.6)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
                color: 'white', // Input text color
              },
              '& .MuiInputLabel-root': { color: 'rgba(200, 200, 255, 0.7)' }, // Lighter label
              '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              '& .MuiInputBase-input': { color: 'white' }, // Input text color
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2,
                backgroundColor: 'rgba(0, 0, 80, 0.4)', // Darker blue button background
                color: 'white', // Button text color
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 80, 0.6)',
                }
            }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <Link href="#" variant="body2" onClick={() => navigate('/register')}
              sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: 'white' } }}>
              {"Don't have an account? "}
              <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Register Medical Staff</span>
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default LoginPage;