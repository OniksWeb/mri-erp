// web-frontend/src/pages/AddPatientPage.js
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  MenuItem,
  Paper,
  IconButton, // For adding/removing examination fields
  Divider,    // For section separators
  Grid,       // For better form layout
  InputAdornment, // For currency symbol in TextField
  FormControl, // For Select label
  InputLabel, // For Select label
  Select, // For Select dropdown
  Tooltip // For tooltips on icons
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send'; // Make sure this is imported if used directly
import AddIcon from '@mui/icons-material/Add'; // NEW: Icon for add examination button
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'; // NEW: Icon for remove examination button
import { Stack} from '@mui/material'; // Import Stack and IconButton
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Import the icon

function AddPatientPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    patient_name: '',
    gender: '',
    contact_email: '',
    contact_phone_number: '',
    radiographer_name: '',
    radiologist_name: '',
    remarks: '',
    age: '', // New field
    weight_kg: '', // New field
    referral_hospital: '', // New field
    referring_doctor: '', // New field
    payment_type: '', // Default to empty
    examinations: [{ id: Date.now(), name: '', amount: '' }], // Initial examination field
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const paymentTypeOptions = [
    { value: '', label: 'Select Payment Type' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Transfer', label: 'Transfer' },
    { value: 'Card', label: 'Card' },
  ];

  const genderOptions = [
    { value: '', label: 'Select Gender' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

const handleExaminationChange = (id, field, value) => {
  setFormData(prev => {
    const updatedExams = prev.examinations.map(exam =>
      exam.id === id
        ? { ...exam, [field]: value } // update the right exam
        : exam
    );
    return { ...prev, examinations: updatedExams }; // return new object
  });
};


  const handleAddExamination = () => {
  setFormData(prev => ({
    ...prev,
    examinations: [
      ...prev.examinations,
      { id: Date.now(), name: '', amount: '' } // new exam with temp id
    ]
  }));
};


  const handleRemoveExamination = (id) => {
  setFormData(prev => ({
    ...prev,
    examinations: prev.examinations.filter(exam => exam.id !== id)
  }));
};


const totalAmount = useMemo(() => {
  return (formData.examinations || []).reduce((sum, exam) => {
    const amount = parseFloat(exam.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
}, [formData.examinations]);


  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // --- Frontend Validation ---
    const { patient_name, contact_email, examinations, age, weight_kg, payment_type } = formData;
    if (!patient_name.trim()) {
      setError('Patient Name is required.');
      setLoading(false);
      return;
    }
    if (!contact_email.trim() || !contact_email.includes('@')) {
        setError('A valid Email Address is required.');
        setLoading(false);
        return;
    }
    if (!age || isNaN(age) || age <= 0 || !Number.isInteger(Number(age))) {
        setError('Age must be a positive whole number.');
        setLoading(false);
        return;
    }
    if (!weight_kg || isNaN(weight_kg) || weight_kg <= 0) {
        setError('Weight (kg) must be a positive number.');
        setLoading(false);
        return;
    }
    if (!payment_type) {
        setError('Payment Type is required.');
        setLoading(false);
        return;
    }
    if (examinations.length === 0) {
      setError('At least one examination is required.');
      setLoading(false);
      return;
    }
    for (const exam of examinations) {
      if (!exam.name.trim() || !exam.amount || isNaN(exam.amount) || parseFloat(exam.amount) <= 0) {
        setError('All examination names and positive amounts are required.');
        setLoading(false);
        return;
      }
    }
    // --- End Frontend Validation ---

    if (!token) {
      setError('Authentication token missing. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData), // Send all form data, including examinations
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setError('');
        alert(data.message || 'Patient record added successfully!');
        setFormData({ // Clear form and reset examinations to initial state after successful submission
          patient_name: '', gender: '', contact_email: '', contact_phone_number: '',
          radiographer_name: '', radiologist_name: '', remarks: '',
          age: '', weight_kg: '', referral_hospital: '', referring_doctor: '',
          payment_type: '',
          examinations: [{ id: Date.now(), name: '', amount: '' }],
        });
        setTimeout(() => {
          navigate('/patients');
        }, 2000);
      } else {
        setError(data.message || 'Failed to add patient record.');
      }
    } catch (err) {
      console.error('Error adding patient record:', err);
      setError('Network error or server unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="md" sx={{ p: 3 }}> {/* Page-level padding */}
      <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
                    <IconButton onClick={() => navigate(-1)}> {/* Go back to previous page */}
                        <ArrowBackIcon />
                    </IconButton>
          <Typography variant="h4" gutterBottom component="h1" sx={{ mb: 3 }}>
            Add New Patient Record
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
            Patient record added successfully! Redirecting to Patient List...
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          {/* Patient Demographics */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Patient Demographics</Typography>
          <Grid container spacing={2}> {/* Use Grid for responsive layout */}
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" required fullWidth
                id="patient_name" label="Patient Name" name="patient_name"
                value={formData.patient_name} onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" fullWidth select
                id="gender" label="Gender" name="gender"
                value={formData.gender} onChange={handleChange}
                size="medium" // Ensure this is medium
                sx={{ minWidth: 150 }} // Ensure this is here
              >
                {genderOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" required fullWidth
                id="age" label="Age" name="age" type="number"
                value={formData.age} onChange={handleChange} inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" required fullWidth
                id="weight_kg" label="Weight (kg)" name="weight_kg" type="number"
                value={formData.weight_kg} onChange={handleChange} inputProps={{ step: "0.1", min: 0 }}
              />
            </Grid>
          </Grid>

          {/* Contact Details */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Contact Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                margin="normal" required fullWidth
                id="contact_email" label="Contact Email" name="contact_email" type="email"
                value={formData.contact_email} onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="normal" fullWidth
                id="contact_phone_number" label="Contact Phone Number" name="contact_phone_number" type="tel"
                value={formData.contact_phone_number} onChange={handleChange}
              />
            </Grid>
          </Grid>

          {/* Referral Information */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Referral Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                margin="normal" fullWidth
                id="referral_hospital" label="Referral Hospital" name="referral_hospital"
                value={formData.referral_hospital} onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="normal" fullWidth
                id="referring_doctor" label="Referring Doctor" name="referring_doctor"
                value={formData.referring_doctor} onChange={handleChange}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          {/* Examination Details (Dynamic List) */}
          <Typography variant="h6" gutterBottom>Examination Details</Typography>
          {formData.examinations.map((exam, index) => (
            <Box key={exam.id} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TextField
                sx={{ mr: 2, flex: 3 }}
                label={`Examination ${index + 1} Name`}
                value={exam.name}
                onChange={(e) => handleExaminationChange(exam.id, 'name', e.target.value)}
                required
              />
              <TextField
                sx={{ mr: 2, flex: 1 }}
                label="Amount"
                type="number"
                inputProps={{ step: "0.01", min: "0" }}
                value={exam.amount}
                onChange={(e) => handleExaminationChange(exam.id, 'amount', e.target.value)}
                required
                InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
              />
              {formData.examinations.length > 1 && (
                <IconButton onClick={() => handleRemoveExamination(exam.id)} color="error">
                  <RemoveCircleOutlineIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddExamination}
            variant="outlined"
            size="small"
            sx={{ mb: 3 }}
          >
            Add Another Examination
          </Button>

          {/* Total Amount Display */}
          <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="h6">
                Total Amount: ₦{Number(totalAmount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>


          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Payment Details Section */}
          <Typography variant="h6" gutterBottom>Payment Details</Typography>
          <TextField
            margin="normal"
            required
            fullWidth
            select
            id="payment_type"
            label="Payment Type"
            name="payment_type"
            value={formData.payment_type}
            onChange={handleChange}
          >
            {paymentTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {/* Medical Personnel Details */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Medical Personnel</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" fullWidth
                id="radiographer_name" label="Radiographer's Name" name="radiographer_name"
                value={formData.radiographer_name} onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal" fullWidth
                id="radiologist_name" label="Radiologist's Name" name="radiologist_name"
                value={formData.radiologist_name} onChange={handleChange}
              />
            </Grid>
          </Grid>

          {/* General Remarks */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>General Remarks</Typography>
          <TextField
            margin="normal" fullWidth
            id="remarks" label="Additional Remarks" name="remarks"
            multiline rows={4}
            value={formData.remarks} onChange={handleChange}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Add Patient Record'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default AddPatientPage;