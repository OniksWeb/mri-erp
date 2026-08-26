// web-frontend/src/pages/LoginPage.js
import { useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useAuth } from '../contexts/AuthContext'; 
import companyLogo from '../assets/company_logo.png';

import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
} from '@mui/material';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); 
  const navigate = useNavigate(); 
  const theme = useTheme();

  const handleSubmit = async (event) => {
    event.preventDefault(); 
    setError(''); 
    setLoading(true); 

    try {
      // Ensure your .env file has the correct REACT_APP_API_URL
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Now 'data.user' contains: id, full_name, role, location_id, location_name, is_hq
        // We pass this entire object to your context
        login(data.user, data.token);
        
        // The AuthContext should handle the navigation to the dashboard
        // based on the user's role/location.
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setError('Cannot reach the server. Please check your internet or if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 4,
          backgroundColor: 'rgba(0, 0, 40, 0.3)', 
          backdropFilter: 'blur(12px) saturate(150%)', 
          WebkitBackdropFilter: 'blur(12px) saturate(150%)', 
          border: '1px solid rgba(100, 100, 255, 0.2)', 
          boxShadow: '0 8px 40px 0 rgba(0, 0, 0, 0.4)', 
          borderRadius: '16px', 
          color: 'white', 
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
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(200, 200, 255, 0.4)' },
                '&:hover fieldset': { borderColor: 'rgba(200, 200, 255, 0.6)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
                color: 'white',
              },
              '& .MuiInputLabel-root': { color: 'rgba(200, 200, 255, 0.7)' },
              '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              '& .MuiInputBase-input': { color: 'white' },
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
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(200, 200, 255, 0.4)' },
                '&:hover fieldset': { borderColor: 'rgba(200, 200, 255, 0.6)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
                color: 'white',
              },
              '& .MuiInputLabel-root': { color: 'rgba(200, 200, 255, 0.7)' },
              '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              '& .MuiInputBase-input': { color: 'white' },
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2, backgroundColor: 'rgba(211, 47, 47, 0.2)', color: '#ffcdd2' }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2,
                backgroundColor: 'rgba(0, 0, 80, 0.6)', 
                color: 'white', 
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 100, 0.8)',
                }
            }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <Link 
            component="button"
            variant="body2"
            onClick={() => navigate('/register')}
            sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: 'white' }, textAlign: 'center', width: '100%', display: 'block' }}>
              Don't have an account? <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Register Medical Staff</span>
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default LoginPage;