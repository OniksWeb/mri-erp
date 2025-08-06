// web-frontend/src/pages/AdminPanelPage.js
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
  Chip, // For status display
  Dialog, // For confirmation dialog
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select, // For status dropdown in dialog
  MenuItem, // For status dropdown items
  FormControl, // For select label
  InputLabel, // For select label
  TextField, // For admin response in dialog
} from '@mui/material';

// Icons
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit'; // For editing role/status

function AdminPanelPage() {
  const { token, user } = useAuth(); // Get token and current user's role
  const [medicalStaff, setMedicalStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State for confirmation dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState(null); // 'suspend', 'activate', 'delete', 'change_role'
  const [selectedStaff, setSelectedStaff] = useState(null); // The staff member selected for action
  const [isActionLoading, setIsActionLoading] = useState(false); // For action buttons
  const [newRole, setNewRole] = useState(''); // For role change dialog

  // Options for role dropdown
  const roleOptions = [
    { value: 'medical_staff', label: 'Medical Staff' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'financial_admin', label: 'Financial Admin' },
    // Admin role should not be assignable from here for security
  ];

  const fetchMedicalStaff = async () => {
    if (!token) {
      setError('Authentication token missing. Please log in.');
      setLoading(false);
      return;
    }
    if (user?.role !== 'admin') { // This check is also in ProtectedRoute, but good for clarity
      setError('Access denied: Only administrators can view this page.');
      setLoading(false);
      return;
    }

    try {
      // Fetch all non-admin users for management
      const response = await fetch('http://localhost:5001/api/admin/medical-staff', { // Using PORT 5001
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setMedicalStaff(data);
      } else {
        setError(data.message || 'Failed to fetch medical staff records.');
      }
    } catch (err) {
      console.error('Error fetching medical staff:', err);
      setError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicalStaff();
  }, [token, user]); // Re-fetch if token or user changes

  // --- Dialog Handlers ---
  const handleOpenDialog = (action, staff) => {
    setDialogAction(action);
    setSelectedStaff(staff);
    if (action === 'change_role') {
        setNewRole(staff.role); // Set current role as default in dialog
    }
    setOpenDialog(true);
    setSuccess(''); // Clear previous success messages before dialog
    setError(''); // Clear previous errors
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogAction(null);
    setSelectedStaff(null);
    setNewRole(''); // Clear newRole state
    setError(''); // Clear any previous error on dialog close
    setSuccess('');
  };

  const handleConfirmAction = async () => {
    if (!selectedStaff || !dialogAction) return;

    setIsActionLoading(true);
    setError('');
    setSuccess('');

    try {
      let response;
      let message = '';
      let url = '';
      let body = {};
      let method = '';

      if (dialogAction === 'verify' || dialogAction === 'suspend' || dialogAction === 'activate') {
        const isVerifiedStatus = dialogAction === 'verify' || dialogAction === 'activate';
        url = `http://localhost:5001/api/admin/verify-medical-staff/${selectedStaff.id}`;
        method = 'PATCH';
        body = { suspend: !isVerifiedStatus };
        message = `User ${selectedStaff.username} successfully ${isVerifiedStatus ? 'activated' : 'suspended'}.`;
      } else if (dialogAction === 'delete') {
        url = `http://localhost:5001/api/admin/medical-staff/${selectedStaff.id}`;
        method = 'DELETE';
        message = `User ${selectedStaff.username} deleted.`;
      } else if (dialogAction === 'change_role') {
        url = `http://localhost:5001/api/admin/medical-staff/${selectedStaff.id}/role`; // NEW ENDPOINT
        method = 'PATCH';
        body = { role: newRole };
        message = `User ${selectedStaff.username} role changed to ${newRole.replace('_', ' ')}.`;
      } else {
          throw new Error('Unknown dialog action.');
      }

      response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: method === 'PATCH' || method === 'POST' ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(message);
        fetchMedicalStaff(); // Refresh the list
      } else {
        setError(data.message || `Action failed for ${selectedStaff.username}.`);
      }
    } catch (err) {
      console.error(`Error performing ${dialogAction} action:`, err);
      setError('Network error or server unavailable for action.');
    } finally {
      setIsActionLoading(false);
      handleCloseDialog(); // Close dialog regardless
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading medical staff...</Typography>
      </Box>
    );
  }

  if (error && !openDialog) { // Only show global error if not handling dialog error
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}> {/* Page-level padding */}
      <Typography variant="h4" gutterBottom>
        Admin Panel - Manage Medical Staff
      </Typography>

      {success && (
        <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
          {success}
        </Alert>
      )}

      {medicalStaff.length === 0 ? (
        <Alert severity="info">No medical staff accounts found (other than admins).</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="medical staff table">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell> {/* NEW: Role column */}
                <TableCell>Status</TableCell>
                <TableCell>Registered On</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicalStaff.map((staff) => (
                <TableRow
                  key={staff.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {staff.id}
                  </TableCell>
                  <TableCell>{staff.username}</TableCell>
                  <TableCell>{staff.full_name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>{staff.role.replace('_', ' ').toUpperCase()}</TableCell> {/* NEW: Role display */}
                  <TableCell>
                    {staff.is_verified ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                        <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 0.5 }} /> Verified
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', color: 'warning.main' }}>
                        <BlockIcon fontSize="small" sx={{ mr: 0.5 }} /> Unverified / Suspended
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>{new Date(staff.created_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    {staff.id !== user?.id && staff.role !== 'admin' ? ( // Prevent admin from managing self or other admins
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ mr: 1 }}
                          onClick={() => handleOpenDialog('change_role', staff)} // NEW: Change Role button
                        >
                          Change Role
                        </Button>
                        {staff.is_verified ? (
                          <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<BlockIcon />}
                            size="small"
                            sx={{ mr: 1 }}
                            onClick={() => handleOpenDialog('suspend', staff)}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="outlined"
                            color="success"
                            startIcon={<CheckCircleOutlineIcon />}
                            size="small"
                            sx={{ mr: 1 }}
                            onClick={() => handleOpenDialog('activate', staff)}
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('delete', staff)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        (Cannot manage self)
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {dialogAction === 'delete' ? 'Confirm Deletion' :
           dialogAction === 'change_role' ? 'Change User Role' :
           `Confirm ${dialogAction === 'suspend' ? 'Suspension' : 'Activation'}`}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <DialogContentText id="confirm-dialog-description">
            {dialogAction === 'change_role' ? (
                <Box>
                    <Typography>Change role for: <Typography component="span" sx={{ fontWeight: 'bold' }}>{selectedStaff?.full_name || selectedStaff?.username}</Typography></Typography>
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="new-role-select-label">New Role</InputLabel>
                        <Select
                            labelId="new-role-select-label"
                            id="new-role-select"
                            value={newRole}
                            label="New Role"
                            onChange={(e) => setNewRole(e.target.value)}
                        >
                            {roleOptions.map(option => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            ) : (
                `Are you sure you want to ${dialogAction} user: ` +
                <Typography component="span" sx={{ fontWeight: 'bold', mx: 0.5 }}>
                  {selectedStaff?.full_name || selectedStaff?.username}?
                </Typography> +
                (dialogAction === 'delete' ? ' This action cannot be undone.' : '')
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary" disabled={isActionLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirmAction} color={dialogAction === 'delete' ? 'error' : 'primary'} variant="contained" disabled={isActionLoading}>
            {isActionLoading ? <CircularProgress size={24} /> : (
              dialogAction === 'delete' ? 'Delete' :
              dialogAction === 'change_role' ? 'Save Role' :
              (dialogAction === 'suspend' ? 'Suspend' : 'Activate')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminPanelPage;