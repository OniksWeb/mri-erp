// web-frontend/src/pages/MyQueriesPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BuildIcon from '@mui/icons-material/Build';

function MyQueriesPage() {
  const { token, user } = useAuth();
  const [myQueries, setMyQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyQueries = async () => {
      if (!token) {
        setError('Authentication token missing. Please log in.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/queries/my', { // Using PORT 5001
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setMyQueries(data);
        } else {
          setError(data.message || 'Failed to fetch your queries.');
        }
      } catch (err) {
        console.error('Error fetching my queries:', err);
        setError('Network error or server unavailable.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyQueries();
  }, [token]);

  const getStatusChip = (status) => {
    switch (status) {
      case 'open':
        return <Chip label="Open" color="primary" size="small" icon={<HourglassEmptyIcon />} />;
      case 'in_progress':
        return <Chip label="In Progress" color="info" size="small" icon={<BuildIcon />} />;
      case 'resolved':
        return <Chip label="Resolved" color="success" size="small" icon={<CheckCircleOutlineIcon />} />;
      case 'closed':
        return <Chip label="Closed" color="default" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading your queries...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}> {/* ADD p:3 here for page-level padding */}
      <Typography variant="h4" gutterBottom>
        My Submitted Queries
      </Typography>

      {myQueries.length === 0 ? (
        <Alert severity="info">You have not submitted any queries yet.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="my queries table">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Date Submitted</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Admin Response</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myQueries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell>{query.id}</TableCell>
                  <TableCell>{query.subject}</TableCell>
                  <TableCell>{getStatusChip(query.status)}</TableCell>
                  <TableCell>{query.sender_full_name || query.sender_username}</TableCell>
                  <TableCell>{new Date(query.created_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(query.updated_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {query.admin_response ? (
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {query.admin_response}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No response yet.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default MyQueriesPage;