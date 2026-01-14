// web-frontend/src/pages/SubmitQueryPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container,
  Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send'; // Make sure this is imported if used directly

function SubmitQueryPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!subject.trim() || !message.trim()) {
      setError('Subject and message cannot be empty.');
      setLoading(false);
      return;
    }

    if (!token) {
      setError('Authentication token missing. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/queries', { // Using PORT 5001
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, message }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Query submitted successfully!');
        setSubject(''); // Clear form
        setMessage('');
        // Optional: navigate to 'my queries' page after submission
        // setTimeout(() => navigate('/queries/my'), 2000);
      } else {
        setError(data.message || 'Failed to submit query.');
      }
    } catch (err) {
      console.error('Error submitting query:', err);
      setError('Network error or server unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="md" sx={{ p: 3 }}> {/* ADD p:3 here for page-level padding */}
      <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom component="h1" sx={{ mb: 3 }}>
          Submit a Query / Need
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="subject"
            label="Subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="message"
            label="Message / Details of Need"
            name="message"
            multiline
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Query'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default SubmitQueryPage;