// web-frontend/src/pages/AdminQueriesPage.js
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
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';

// Icons
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';

function AdminQueriesPage() {
  const { token, user } = useAuth();
  const [allQueries, setAllQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(null);
  const [dialogStatus, setDialogStatus] = useState('');
  const [dialogAdminResponse, setDialogAdminResponse] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAllQueries = async () => {
    if (!token) {
      setError('Authentication token missing. Please log in.');
      setLoading(false);
      return;
    }
    if (user?.role !== 'admin') {
      setError('Access denied: Only administrators can view this page.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/admin/queries', { // Using PORT 5001
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setAllQueries(data);
      } else {
        setError(data.message || 'Failed to fetch all queries.');
      }
    } catch (err) {
      console.error('Error fetching all queries:', err);
      setError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllQueries();
  }, [token, user]);

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

  // --- Dialog Handlers ---
  const handleOpenDialog = (query) => {
    setCurrentQuery(query);
    setDialogStatus(query.status);
    setDialogAdminResponse(query.admin_response || '');
    setOpenDialog(true);
    setSuccess(''); // Clear previous success messages
    setError(''); // Clear previous error messages
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentQuery(null);
    setDialogStatus('');
    setDialogAdminResponse('');
    setIsSaving(false);
  };

  const handleSaveQuery = async () => {
    if (!currentQuery) return;
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`https://g2g-mri-erp-bfw57.ondigitalocean.app/api/admin/queries/${currentQuery.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: dialogStatus,
          admin_response: dialogAdminResponse,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Query updated successfully!');
        fetchAllQueries(); // Refresh list after update
        handleCloseDialog();
      } else {
        setError(data.message || 'Failed to update query.');
      }
    } catch (err) {
      console.error('Error saving query:', err);
      setError('Network error or server unavailable.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading all queries...</Typography>
      </Box>
    );
  }

  if (error && !openDialog) { // Only show global error if not in dialog
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        All Queries - Admin View
      </Typography>

      {success && (
        <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
          {success}
        </Alert>
      )}

      {allQueries.length === 0 ? (
        <Alert severity="info">No queries have been submitted yet.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="admin queries table">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sender</TableCell>
                <TableCell>Date Submitted</TableCell>
                <TableCell>Admin Response</TableCell>
                <TableCell>Resolved By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allQueries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell>{query.id}</TableCell>
                  <TableCell>{query.subject}</TableCell>
                  <TableCell>{getStatusChip(query.status)}</TableCell>
                  <TableCell>{query.sender_full_name || query.sender_username}</TableCell>
                  <TableCell>{new Date(query.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {query.admin_response ? (
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {query.admin_response.length > 50 ? query.admin_response.substring(0, 50) + '...' : query.admin_response}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No response.
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {query.resolver_full_name || query.resolver_username || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenDialog(query)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Query Management Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        {currentQuery && (
          <>
            <DialogTitle>Manage Query #{currentQuery.id}</DialogTitle>
            <DialogContent>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <DialogContentText sx={{ mb: 2 }}>
                <Typography variant="h6">Subject: {currentQuery.subject}</Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 1 }}>
                  From: {currentQuery.sender_full_name || currentQuery.sender_username} on {new Date(currentQuery.created_at).toLocaleString()}
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: 'grey.100' }}>
                  <Typography variant="body2">{currentQuery.message}</Typography>
                </Paper>
              </DialogContentText>

              <FormControl fullWidth margin="normal">
                <InputLabel id="status-select-label">Status</InputLabel>
                <Select
                  labelId="status-select-label"
                  id="status-select"
                  value={dialogStatus}
                  label="Status"
                  onChange={(e) => setDialogStatus(e.target.value)}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>

              <TextField
                margin="normal"
                fullWidth
                label="Admin Response"
                multiline
                rows={4}
                value={dialogAdminResponse}
                onChange={(e) => setDialogAdminResponse(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog} color="error" disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveQuery} color="primary" variant="contained" disabled={isSaving}>
                {isSaving ? <CircularProgress size={24} /> : 'Save Changes'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default AdminQueriesPage;