// web-frontend/src/pages/PatientDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // useParams to get ID from URL, useNavigate for navigation
import { useAuth } from '../contexts/AuthContext';

// Material-UI components (COMPLETE LIST OF ALL NEEDED IMPORTS)
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  TextField,
  MenuItem,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Chip,
  FormControl, InputLabel, Select,
  InputAdornment, // For adding currency symbol to TextField
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton, // Ensure this is also here for table actions
  Stack // For consistent layout of buttons/icons
} from '@mui/material';


// Icons
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CodeIcon from '@mui/icons-material/Code'; // For MRI Code
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'; // For dates
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'; // For Radiographer/Radiologist
import AssignmentIcon from '@mui/icons-material/Assignment'; // For remarks
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import MaleIcon from '@mui/icons-material/Male'; // For gender
import ReceiptIcon from '@mui/icons-material/Receipt'; // For receipt number
import LocationOnIcon from '@mui/icons-material/LocationOn'; // For referral hospital
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'; // For referring doctor
import StraightenIcon from '@mui/icons-material/Straighten'; // For weight
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // For age
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'; // For payment type/status/approval
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Import the icon
// Payment Status Icons
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HighlightOffIcon from '@mui/icons-material/HighlightOff'; // Not Paid icon
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'; // For removing exams
import AddIcon from '@mui/icons-material/Add'; // For adding exam

import Layout from '../components/Layout'; // Assuming Layout wraps the page

function PatientDetailPage() {
  const { id } = useParams(); // Get patient ID from URL (e.g., from /patients/1/details, id will be "1")
  const navigate = useNavigate(); // Initialize useNavigate
  const { token, user } = useAuth(); // Need token for API calls and user role for delete permission

  const [patient, setPatient] = useState(null); // Stores the patient data
  const [loading, setLoading] = useState(true); // Loading state for initial fetch
  const [error, setError] = useState(''); // General error message
  const [isEditMode, setIsEditMode] = useState(false); // Controls if fields are editable
  const [formData, setFormData] = useState({}); // Stores form data for edit mode
  const [isSaving, setIsSaving] = useState(false); // Loading state for save button

  // Dialog states
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false); // For payment approval dialog
  const [paymentStatusOption, setPaymentStatusOption] = useState(''); // Selected status in dialog
  const [isApprovingPayment, setIsApprovingPayment] = useState(false); // Loading state for payment approval

  const genderOptions = [ // Options for gender dropdown in edit mode
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ];

  const paymentTypeOptions = [
    { value: '', label: 'Select Payment Type' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Transfer', label: 'Transfer' },
    { value: 'Card', label: 'Card' },
  ];

  const paymentStatusDisplayOptions = [ // Options for payment status dropdown in dialog
    { value: 'Not Paid', label: 'Not Paid' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
  ];

  // --- Fetch Patient Details on component mount or ID/token change ---
  const fetchPatientDetails = async () => {
    if (!token) {
      setError('Authentication token missing. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/patients/${id}`, { // Fetch from backend API
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setPatient(data); // Set patient data
        // Initialize formData ensuring examinations is an array
        setFormData({ ...data, examinations: data.examinations || [] });
        setError(''); // Clear any previous errors
        setPaymentStatusOption(data.payment_status || 'Not Paid'); // Set initial dialog status
      } else {
        setError(data.message || 'Failed to fetch patient details.');
      }
    } catch (err) {
      console.error('Error fetching patient details:', err);
      setError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [id, token]); // Re-fetch if patient ID in URL or token changes

  // --- Edit Mode Handlers ---
  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setFormData({ ...patient, examinations: patient.examinations || [] }); // Revert form data to original patient data, ensure exams is array
    setError(''); // Clear any edit-specific errors
  };

  const handleFormChange = (e) => {
    // Handle changes for main form fields
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handlers for dynamic Examinations list in edit mode
  const handleExaminationChange = (examId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      examinations: (prev.examinations || []).map((exam) => // Ensure prev.examinations is an array
        exam.id === examId ? { ...exam, [field]: value } : exam
      ),
    }));
  };

  const handleAddExamination = () => {
    setFormData((prev) => ({
      ...prev,
      examinations: [...(prev.examinations || []), { id: `new-${Date.now()}`, name: '', amount: '' }], // Ensure prev.examinations is an array
    }));
  };

  const handleRemoveExamination = (examId) => {
    setFormData((prev) => ({
      ...prev,
      examinations: (prev.examinations || []).filter((exam) => exam.id !== examId), // Ensure prev.examinations is an array
    }));
  };


  const handleSaveEdit = async () => {
    setIsSaving(true);
    setError('');
    try {
      // Send updated form data to backend
      const response = await fetch(`http://localhost:5001/api/patients/${id}`, {
        method: 'PATCH', // Use PATCH for partial updates
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            ...formData,
            patient_age: parseInt(formData.patient_age), // Ensure age is integer (using patient_age from DB)
            weight_kg: parseFloat(formData.weight_kg), // Ensure weight is float
            // Ensure examination amounts are floats for backend, provide default 0 for new
            examinations: (formData.examinations || []).map(exam => ({ ...exam, amount: parseFloat(exam.amount || 0) }))
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPatient(data.patient); // Update patient state with returned data
        setFormData({ ...data.patient, examinations: data.patient.examinations || [] }); // Also update form data with new patient object, ensure exams is array
        setIsEditMode(false); // Exit edit mode
        alert('Patient updated successfully!');
      } else {
        setError(data.message || 'Failed to update patient record.');
      }
    } catch (err) {
      console.error('Error saving patient edit:', err);
      setError('Network error or server unavailable. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete Handlers ---
  const handleDeleteClick = () => {
    setOpenDeleteDialog(true); // Open confirmation dialog
    setError(''); // Clear error before dialog
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false); // Close confirmation dialog
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5001/api/patients/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Patient deleted successfully!');
        navigate('/patients'); // Redirect to patient list after successful deletion
      } else {
        const errorData = await response.json(); // Get error message from backend
        setError(errorData.message || 'Failed to delete patient record.');
      }
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError('Network error or server unavailable.');
    } finally {
      setIsDeleting(false);
      setOpenDeleteDialog(false); // Close dialog
    }
  };

  // --- Payment Approval Handlers ---
  const handleOpenPaymentDialog = () => {
    setOpenPaymentDialog(true);
    setPaymentStatusOption(patient.payment_status || 'Not Paid'); // Set initial status in dialog
    setError('');
  };

  const handleClosePaymentDialog = () => {
    setOpenPaymentDialog(false);
    setIsApprovingPayment(false);
    setError('');
  };

  const handleApprovePayment = async () => {
    setIsApprovingPayment(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5001/api/patients/${id}/approve-payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: paymentStatusOption }),
      });

      const data = await response.json();

      if (response.ok) {
        setPatient(data.patient); // Update patient state with new payment info
        alert(`Payment status updated to "${paymentStatusOption}"!`);
        handleClosePaymentDialog();
      } else {
        setError(data.message || 'Failed to update payment status.');
      }
    } catch (err) {
      console.error('Error approving payment:', err);
      setError('Network error or server unavailable.');
    } finally {
      setIsApprovingPayment(false);
    }
  };

  // Helper for Payment Status Chip Display (reused from PatientListPage)
  const getPaymentStatusChip = (status) => {
    switch (status) {
      case 'Approved':
        return <Chip label="Approved" color="success" size="small" icon={<CheckCircleOutlineIcon />} />;
      case 'Pending':
        return <Chip label="Pending" color="warning" size="small" icon={<HourglassEmptyIcon />} />;
      case 'Not Paid':
        return <Chip label="Not Paid" color="error" size="small" icon={<HighlightOffIcon />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const calculateTotalAmount = () => {
    // Use patient.examinations for display, formData.examinations for edit mode calculation
    const exams = isEditMode ? formData.examinations : patient.examinations;
    // Ensure exams is an array before reducing
    return (exams || []).reduce((sum, exam) => {
      const amount = parseFloat(exam.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  // --- Conditional Loading and Error Displays ---
  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading patient details...</Typography>
        </Box>
      </Layout>
    );
  }

  // Display main error if present and no dialog is open
  if (error && !openDeleteDialog && !openPaymentDialog) {
    return (
      <Layout>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Layout>
    );
  }

  // If patient data is null (e.g., after deletion and redirect), display info
  if (!patient) {
    return (
      <Layout>
        <Alert severity="info" sx={{ mt: 2 }}>
          Patient not found or could not be loaded.
        </Alert>
      </Layout>
    );
  }

  // --- Main Component Render ---
  return (
    <Layout>
      <Box sx={{ p: 3 }}> {/* Page-level padding */}
        <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
          {/* Go Back Button and Page Title */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
              <IconButton onClick={() => navigate(-1)}>
                  <ArrowBackIcon />
              </IconButton>
              <Typography variant="h4" gutterBottom>Patient Details</Typography>
          </Stack>

          {/* Edit/Delete/Manage Payment Buttons */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
            {!isEditMode && ( // Show Edit button only when not in edit mode
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleEditClick}
                sx={{ mr: 1 }}
              >
                Edit Patient
              </Button>
            )}
            {/* Delete button only for admin users */}
            {user?.role === 'admin' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
                sx={{ mr: 1 }} // Add margin-right for spacing
              >
                Delete Patient
              </Button>
            )}
            {/* Manage Payment Button (visible for Admin & Financial Admin) */}
            {user && (user.role === 'admin' || user.role === 'financial_admin') && (
                <Button
                    variant="contained"
                    color="info"
                    startIcon={<AttachMoneyIcon />}
                    onClick={handleOpenPaymentDialog}
                >
                    Manage Payment
                </Button>
            )}
          </Box>

          {/* Error displayed inside dialog if dialog is open and error exists */}
          {error && (openDeleteDialog || openPaymentDialog) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Left Column - Patient Demographics & Contact */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Demographics & Contact</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><PersonIcon /></ListItemIcon>
                  <ListItemText primary="Patient Name" secondary={isEditMode ? (
                    <TextField fullWidth name="patient_name" value={formData.patient_name || ''} onChange={handleFormChange} size="small" />
                  ) : patient.patient_name} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><AccessTimeIcon /></ListItemIcon>
                  <ListItemText primary="Age" secondary={isEditMode ? (
                    <TextField fullWidth name="patient_age" value={formData.patient_age || ''} onChange={handleFormChange} size="small" type="number" inputProps={{ min: 0 }} />
                  ) : patient.patient_age || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><StraightenIcon /></ListItemIcon>
                  <ListItemText primary="Weight (kg)" secondary={isEditMode ? (
                    <TextField fullWidth name="weight_kg" value={formData.weight_kg || ''} onChange={handleFormChange} size="small" type="number" inputProps={{ min: 0, step: "0.1" }} />
                  ) : patient.weight_kg || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><MaleIcon /></ListItemIcon>
                  <ListItemText primary="Gender" secondary={isEditMode ? (
                    <TextField select fullWidth name="gender" value={formData.gender || ''} onChange={handleFormChange} size="small">
                      {genderOptions.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                    </TextField>
                  ) : patient.gender || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText primary="Contact Email" secondary={isEditMode ? (
                    <TextField fullWidth name="contact_email" value={formData.contact_email || ''} onChange={handleFormChange} size="small" />
                  ) : patient.contact_email || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><PhoneIcon /></ListItemIcon>
                  <ListItemText primary="Contact Phone" secondary={isEditMode ? (
                    <TextField fullWidth name="contact_phone_number" value={formData.contact_phone_number || ''} onChange={handleFormChange} size="small" />
                  ) : patient.contact_phone_number || 'N/A'} />
                </ListItem>
              </List>
            </Grid>

            {/* Right Column - MRI Details & Personnel */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>MRI & Personnel Details</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><CodeIcon /></ListItemIcon>
                  <ListItemText primary="MRI Code" secondary={patient.mri_code} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><ReceiptIcon /></ListItemIcon>
                  <ListItemText primary="Receipt Number" secondary={patient.receipt_number || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><CodeIcon /></ListItemIcon>
                  <ListItemText primary="Serial Number" secondary={patient.serial_number} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                  <ListItemText primary="Scan Date/Time" secondary={new Date(patient.mri_date_time).toLocaleString()} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><LocationOnIcon /></ListItemIcon>
                  <ListItemText primary="Referral Hospital" secondary={isEditMode ? (
                    <TextField fullWidth name="referral_hospital" value={formData.referral_hospital || ''} onChange={handleFormChange} size="small" />
                  ) : patient.referral_hospital || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><LocalHospitalIcon /></ListItemIcon>
                  <ListItemText primary="Referring Doctor" secondary={isEditMode ? (
                    <TextField fullWidth name="referred_by_doctor" value={formData.referred_by_doctor || ''} onChange={handleFormChange} size="small" />
                  ) : patient.referred_by_doctor || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
                  <ListItemText primary="Radiographer" secondary={isEditMode ? (
                    <TextField fullWidth name="radiographer_name" value={formData.radiographer_name || ''} onChange={handleFormChange} size="small" />
                  ) : patient.radiographer_name || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
                  <ListItemText primary="Radiologist" secondary={isEditMode ? (
                    <TextField fullWidth name="radiologist_name" value={formData.radiologist_name || ''} onChange={handleFormChange} size="small" />
                  ) : patient.radiologist_name || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><PersonIcon /></ListItemIcon>
                  <ListItemText primary="Recorded By" secondary={patient.recorded_by_staff_name || patient.recorded_by_staff_username || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText primary="Recorded By Email" secondary={patient.recorded_by_staff_email || 'N/A'} />
                </ListItem>
              </List>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Examinations Section */}
          <Typography variant="h6" gutterBottom>Examinations / Tests</Typography>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                  <TableHead>
                      <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell align="right">Amount (₦)</TableCell>
                          {isEditMode && <TableCell align="center">Actions</TableCell>}
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {isEditMode ? (
                          // Add check here: formData.examinations must be an array
                          (formData.examinations && formData.examinations.length > 0) ? (
                              formData.examinations.map((exam, index) => (
                                  <TableRow key={exam.id || `new-${index}`}>
                                      <TableCell>
                                          <TextField fullWidth name="name" value={exam.name || ''} onChange={(e) => handleExaminationChange(exam.id, 'name', e.target.value)} size="small" />
                                      </TableCell>
                                      <TableCell align="right">
                                          <TextField
                                              fullWidth
                                              name="amount"
                                              type="number"
                                              inputProps={{ step: "0.01", min: "0" }}
                                              value={exam.amount || ''} // Handle empty string for new exams
                                              onChange={(e) => handleExaminationChange(exam.id, 'amount', e.target.value)}
                                              size="small"
                                              InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
                                          />
                                      </TableCell>
                                      <TableCell align="center">
                                          <IconButton onClick={() => handleRemoveExamination(exam.id)} color="error" size="small">
                                              <RemoveCircleOutlineIcon />
                                          </IconButton>
                                      </TableCell>
                                  </TableRow>
                              ))
                          ) : (
                              // Display message if no examinations in edit mode
                              <TableRow>
                                  <TableCell colSpan={3} align="center">No examinations added yet.</TableCell>
                              </TableRow>
                          )
                      ) : (
                          // Add check here: patient.examinations must be an array
                          (patient.examinations && patient.examinations.length > 0) ? (
                              patient.examinations.map((exam) => (
                                  <TableRow key={exam.id}>
                                      <TableCell>{exam.exam_name || 'N/A'}</TableCell>
                                      <TableCell align="right">₦{parseFloat(exam.exam_amount || 0).toFixed(2)}</TableCell>
                                  </TableRow>
                              ))
                          ) : (
                              // Display message if no examinations in view mode
                              <TableRow>
                                  <TableCell colSpan={2} align="center">No examinations recorded for this patient.</TableCell>
                              </TableRow>
                          )
                      )}
                      {isEditMode && (
                          <TableRow>
                              <TableCell colSpan={3} sx={{ borderBottom: 'none' }}>
                                  <Button startIcon={<AddIcon />} onClick={handleAddExamination} variant="outlined" size="small" sx={{ mt: 1 }}>
                                      Add Examination
                                  </Button>
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
          </TableContainer>

          {/* Total Amount Display */}
          <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="h6">
                  Total Amount: ₦{calculateTotalAmount().toFixed(2)}
              </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Payment Status Section */}
          <Typography variant="h6" gutterBottom>Payment Status</Typography>
          <List>
            <ListItem>
              <ListItemIcon><AttachMoneyIcon /></ListItemIcon>
              <ListItemText primary="Payment Type" secondary={isEditMode ? (
                <TextField fullWidth name="payment_type" value={formData.payment_type || ''} onChange={handleFormChange} size="small" select>
                  {paymentTypeOptions.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </TextField>
              ) : patient.payment_type || 'N/A'} />
            </ListItem>
            <Divider component="li" variant="inset" />
            <ListItem>
              <ListItemIcon>
                {getPaymentStatusChip(patient.payment_status).props.icon} {/* Display icon from chip helper */}
              </ListItemIcon>
              <ListItemText primary="Status" secondary={getPaymentStatusChip(patient.payment_status)} />
            </ListItem>
            {patient.payment_status === 'Approved' && (
              <>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><PersonIcon /></ListItemIcon>
                  <ListItemText primary="Approved By" secondary={patient.approved_by_staff_name || patient.approved_by_staff_username || 'N/A'} />
                </ListItem>
                <Divider component="li" variant="inset" />
                <ListItem>
                  <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                  <ListItemText primary="Approved At" secondary={patient.approved_at ? new Date(patient.approved_at).toLocaleString() : 'N/A'} />
                </ListItem>
              </>
            )}
          </List>

          {/* General Remarks Section */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Remarks</Typography>
          {isEditMode ? (
            <TextField
              fullWidth
              multiline
              rows={4}
              name="remarks"
              value={formData.remarks || ''}
              onChange={handleFormChange}
              variant="outlined"
            />
          ) : (
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                {patient.remarks || 'No remarks provided.'}
              </Typography>
            </Paper>
          )}

          {/* Save/Cancel Buttons in Edit Mode */}
          {isEditMode && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                onClick={handleSaveEdit}
                disabled={isSaving}
                sx={{ mr: 2 }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Paper>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">Confirm Patient Deletion</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <DialogContentText id="delete-dialog-description">
              Are you sure you want to permanently delete patient:
              <Typography component="span" sx={{ fontWeight: 'bold', mx: 0.5 }}>
                {patient.patient_name} (ID: {patient.id})
              </Typography>
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog} color="primary" disabled={isDeleting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting}>
              {isDeleting ? <CircularProgress size={24} /> : 'Delete Patient'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Payment Approval Dialog */}
        {user && (user.role === 'admin' || user.role === 'financial_admin') && ( // Only admins/financial_admins see this dialog logic
          <Dialog
            open={openPaymentDialog}
            onClose={handleClosePaymentDialog}
            aria-labelledby="payment-dialog-title"
            aria-describedby="payment-dialog-description"
          >
            <DialogTitle id="payment-dialog-title">Manage Payment Status</DialogTitle>
            <DialogContent>
              {error && ( // Show error inside dialog
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <DialogContentText id="payment-dialog-description" sx={{ mb: 2 }}>
                Patient: <Typography component="span" sx={{ fontWeight: 'bold' }}>{patient.patient_name}</Typography><br/>
                Current Status: {getPaymentStatusChip(patient.payment_status)}
              </DialogContentText>
              <FormControl fullWidth margin="normal">
                <InputLabel id="payment-status-select-label">Set New Status</InputLabel>
                <Select
                  labelId="payment-status-select-label"
                  id="payment-status-select"
                  value={paymentStatusOption}
                  label="Set New Status"
                  onChange={(e) => setPaymentStatusOption(e.target.value)}
                >
                  {paymentStatusDisplayOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClosePaymentDialog} color="error" disabled={isApprovingPayment}>
                Cancel
              </Button>
              <Button onClick={handleApprovePayment} color="primary" variant="contained" disabled={isApprovingPayment}>
                {isApprovingPayment ? <CircularProgress size={24} /> : 'Update Status'}
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </Layout>
  );
}

export default PatientDetailPage;