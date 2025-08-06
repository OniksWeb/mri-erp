// web-frontend/src/pages/ResultManagementPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Box, Typography, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Button, IconButton, Tooltip, Chip, Stack,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  TextField, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop'; // Icon for 'Issue Result'
import WarningIcon from '@mui/icons-material/Warning';
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Import the icon

import Layout from '../components/Layout'; // Assuming Layout wraps the page

const API_BASE_URL = 'http://localhost:5001'; // Your backend URL

function ResultManagementPage() {
  const { id: patientId } = useParams(); // Get patientId from URL
  const { user, token } = useAuth();

  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientRelationship, setRecipientRelationship] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const [patientName, setPatientName] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
    const navigate = useNavigate();

  // Dialog states for actions
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState(null); // 'status', 'issue'
  const [selectedResult, setSelectedResult] = useState(null); // Result object for the action
  const [newStatus, setNewStatus] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const fetchPatientAndResults = useCallback(async () => {
    if (!token || !patientId) {
      setError('Authentication token or Patient ID missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch patient details (to display patient name)
      const patientResponse = await axios.get(`${API_BASE_URL}/api/patients/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatientName(patientResponse.data.patient_name);

      // Fetch patient results
      const resultsResponse = await axios.get(`${API_BASE_URL}/api/patients/${patientId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(resultsResponse.data);
      console.log("Fetched results for patient:", resultsResponse.data); // Keep this log for debugging
       console.log("Fetched results for patient:", resultsResponse.data); // ADD THIS LINE 
    } catch (err) {
      console.error('Error fetching patient or results:', err);
      setError(err.response?.data?.message || `Failed to fetch data for patient ${patientId}.`);
    } finally {
      setLoading(false);
    }
  }, [patientId, token]);

  useEffect(() => {
    fetchPatientAndResults();
  }, [fetchPatientAndResults]);

  const handleDownloadResult = async (resultId, fileName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/patients/results/${resultId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', // Important for file downloads
      });

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName); // Use original filename
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert('File downloaded successfully!');
    } catch (err) {
      console.error('Error downloading result:', err);
      alert(`Failed to download file: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleOpenStatusDialog = (result) => {
    console.log("Result object when opening dialog:", result); // Keep this log for debugging
    setSelectedResult(result);
    // Initialize newStatus ensuring it's a valid string, not undefined
    setNewStatus(result.result_status || '');
    setDialogAction('status');
    setOpenConfirmDialog(true);
  };

  const handleOpenIssueDialog = (result) => {
    setSelectedResult(result);
    setRecipientName(result.issued_to_recipient_name || '');
    // PRE-FILL NEW FIELDS FROM FETCHED RESULT (if they exist)
    setRecipientPhone(result.issued_to_recipient_phone || '');
    setRecipientRelationship(result.issued_to_recipient_relationship || '');
    setRecipientEmail(result.issued_to_recipient_email || '');
    setDialogAction('issue');
    setOpenConfirmDialog(true);
  };

  const handleCloseConfirmDialog = () => {
    setOpenConfirmDialog(false);
    setSelectedResult(null);
    setNewStatus('');
    setRecipientName('');
    setDialogAction(null);
  };

  const handleConfirmAction = async () => {
    if (!selectedResult || !token) {
        console.warn("Attempted confirm action with no selected result or token."); // Keep this log
        return;
    }
    console.log("Selected result ID for action:", selectedResult.file_id); // Keep this log

    try {
      if (dialogAction === 'status') {
        const response = await axios.patch(`${API_BASE_URL}/api/patients/results/${selectedResult.file_id}/status`, // Corrected
          { status: newStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Result status updated successfully!');
        setResults(prevResults => prevResults.map(res =>
        res.file_id === selectedResult.file_id ? response.data.result : res // Assuming backend returns { result: updatedObject }
      ));
      } else if (dialogAction === 'issue') {
        if (!recipientName.trim()) {
            alert('Recipient name is required to issue the result.');
            return;
        }
        const response = await axios.patch(`${API_BASE_URL}/api/patients/results/${selectedResult.file_id}/issue`, // Corrected
          { recipient_name: recipientName, 
            recipient_phone: recipientPhone, // <<-- ADD THIS
            recipient_relationship: recipientRelationship, // <<-- ADD THIS
            recipient_email: recipientEmail // <<-- ADD THIS
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Result marked as issued successfully!');
        setResults(prevResults => prevResults.map(res =>
        res.file_id === selectedResult.file_id ? response.data.result : res // Assuming backend returns { result: updatedObject }
      ));
      }
      handleCloseConfirmDialog();
    } catch (err) {
      console.error(`Error ${dialogAction}ing result:`, err);
      alert(`Failed to ${dialogAction} result: ${err.response?.data?.message || err.message}`);
    }
  };

  // Helper to determine chip color for status
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return 'warning';
      case 'final': return 'info';
      case 'issued': return 'success';
      default: return 'default'; // Fallback for undefined/null status
    }
  };

  const canApproveOrIssue = user?.role === 'admin' || user?.role === 'medical_staff' || user?.role === 'doctor';
  // isFinAdmin role does not manage results directly, but can view the page.

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading patient results...</Typography>
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
                    <IconButton onClick={() => navigate(-1)}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" gutterBottom>Upload Patient Result</Typography>
                </Stack>

        {results.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No results uploaded for this patient yet.
          </Alert>
        ) : (
          <TableContainer component={Paper} elevation={3} sx={{ mt: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Uploaded By</TableCell>
                  <TableCell>Upload Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Issued To</TableCell>
                  <TableCell>Issued By</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.file_id}> {/* Corrected: result.file_id */}
                    <TableCell>{result.file_name}</TableCell>
                    <TableCell>{result.file_mimetype}</TableCell>
                    <TableCell>{result.uploaded_by_name || 'N/A'}</TableCell>
                    <TableCell>{new Date(result.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={result.result_status ? result.result_status.replace('_', ' ').toUpperCase() : 'N/A'}
                        color={getStatusColor(result.result_status || 'default')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{result.issued_to_recipient_name || 'N/A'}</TableCell>
                    <TableCell>{result.issued_by_name || 'N/A'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Download File">
                          <IconButton
                            color="primary"
                            onClick={() => handleDownloadResult(result.file_id, result.file_name)} // Corrected
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        {result.file_mimetype && result.file_mimetype.includes('image') && (
                          <Tooltip title="View Image">
                            <IconButton
                              color="secondary"
                              component="a"
                              href={`${API_BASE_URL}/api/patients/results/${result.file_id}/download`} // Corrected
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canApproveOrIssue && result.result_status !== 'issued' && (
                          <Tooltip title="Change Status">
                            <IconButton
                              color="info"
                              onClick={() => handleOpenStatusDialog(result)}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canApproveOrIssue && result.result_status !== 'issued' && (
                          <Tooltip title="Issue Result">
                            <IconButton
                              color="success"
                              onClick={() => handleOpenIssueDialog(result)}
                            >
                              <LocalPrintshopIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Confirmation Dialog */}
        <Dialog
          open={openConfirmDialog}
          onClose={handleCloseConfirmDialog}
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          <DialogTitle id="confirm-dialog-title">
            {dialogAction === 'status' ? 'Change Result Status' : 'Issue Result to Recipient'}
          </DialogTitle>
          <DialogContent>
            {dialogAction === 'status' && (
              <>
                <DialogContentText sx={{ mb: 2 }}>
                  Are you sure you want to change the status of result: <strong>{selectedResult?.file_name}</strong>?
                </DialogContentText>
                <FormControl fullWidth variant="outlined">
                  <InputLabel id="new-status-label">New Status</InputLabel>
                  <Select
                    labelId="new-status-label"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    label="New Status"
                  >
                    <MenuItem value="pending_review">Pending Review</MenuItem>
                    <MenuItem value="final">Final</MenuItem>
                    {/* 'issued' status can only be set via the 'Issue Result' action */}
                  </Select>
                </FormControl>
              </>
            )}
            {dialogAction === 'issue' && (
              <>
                <DialogContentText sx={{ mb: 2 }}>
                  Are you sure you want to mark result: <strong>{selectedResult?.file_name}</strong> as issued?
                </DialogContentText>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Recipient Name"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g., Patient's Guardian Name"
                  required
                />
                 <TextField
                  margin="dense"
                  label="Recipient Phone Number (Optional)"
                  type="tel" // Use type="tel" for phone numbers
                  fullWidth
                  variant="outlined"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
                <TextField
                  margin="dense"
                  label="Recipient Relationship to Patient (Optional)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={recipientRelationship}
                  onChange={(e) => setRecipientRelationship(e.target.value)}
                />
                <TextField
                  margin="dense"
                  label="Recipient Email (Optional)"
                  type="email"
                  fullWidth
                  variant="outlined"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </>
            )}
            <Alert severity="warning" sx={{mt:2}}>
                This action cannot be undone for the selected result status.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseConfirmDialog} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleConfirmAction} color="primary" variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
}

export default ResultManagementPage;