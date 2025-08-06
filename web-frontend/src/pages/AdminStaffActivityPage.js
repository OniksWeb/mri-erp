// web-frontend/src/pages/AdminStaffActivityPage.js
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

// Icons
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
// Removed unused icons: PersonOutlineIcon, QueryStatsIcon

function AdminStaffActivityPage() {
  const { token, user } = useAuth();
  const [staffActivity, setStaffActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStaffActivity = async () => {
    // Ensure token and user are available, and user is admin
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
      const response = await fetch('http://localhost:5001/api/admin/analytics/staff-activity', { // Using PORT 5001
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setStaffActivity(data);
      } else {
        setError(data.message || 'Failed to fetch staff activity data.');
      }
    } catch (err) {
      console.error('Error fetching staff activity:', err);
      setError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffActivity();
    // Re-fetch if token or user role changes
  }, [token, user]);

  // Helper function to display status chip
  const getStatusChip = (isVerified) => {
    return isVerified ? (
      <Chip label="Verified" color="success" size="small" icon={<CheckCircleOutlineIcon />} />
    ) : (
      <Chip label="Suspended" color="warning" size="small" icon={<BlockIcon />} />
    );
  };

  // --- Conditional rendering for loading and error states ---
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading staff activity analytics...</Typography>
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

  // --- Main component rendering ---
  return (
    // Outermost Box for page-level padding
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Admin Panel - Staff Activity Analytics
      </Typography>

      {/* Display message if no staff activity found */}
      {staffActivity.length === 0 ? (
        <Alert severity="info">No medical staff activity data found.</Alert>
      ) : (
        // Table to display staff activity
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="staff activity table">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Patients Logged</TableCell>
                <TableCell>Queries Submitted</TableCell>
                <TableCell>Last Patient Logged</TableCell>
                <TableCell>Last Query Submitted</TableCell>
                <TableCell>Member Since</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffActivity.map((staff) => (
                <TableRow
                  key={staff.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }} // Remove bottom border for last row
                >
                  <TableCell>{staff.id}</TableCell>
                  <TableCell>{staff.username}</TableCell>
                  <TableCell>{staff.full_name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>{getStatusChip(staff.is_verified)}</TableCell>
                  <TableCell>{staff.patients_logged_count || 0}</TableCell>
                  <TableCell>{staff.queries_submitted_count || 0}</TableCell>
                  <TableCell>
                    {staff.last_patient_logged_at ? new Date(staff.last_patient_logged_at).toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {staff.last_query_submitted_at ? new Date(staff.last_query_submitted_at).toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell>{new Date(staff.user_created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default AdminStaffActivityPage;