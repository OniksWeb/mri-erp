// web-frontend/src/pages/AddPatientPage.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  IconButton,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  Snackbar 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function AddPatientPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  // ✅ 1. Create a Reference for the first input
  const nameInputRef = useRef(null);

  // Initial Empty State
  const initialFormState = {
    patient_name: '',
    gender: '',
    contact_email: '',
    contact_phone_number: '',
    radiographer_name: '',
    radiologist_name: '',
    remarks: '',
    age: '',
    weight_kg: '',
    referral_hospital: '',
    referring_doctor: '',
    payment_type: '',
    examinations: [{ id: Date.now(), name: '', amount: '' }],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);

  // ✅ 2. FORCE FOCUS ON LOAD (The "Minimize" Fix)
  useEffect(() => {
    // Wait for the animation to finish, then force the cursor into the box
    const timer = setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 300); // 300ms delay ensures the page is fully rendered
    return () => clearTimeout(timer);
  }, []);

  // 3. LOAD DRAFT
  useEffect(() => {
    const savedDraft = localStorage.getItem('patient_form_draft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormData({ ...initialFormState, ...parsedDraft });
      } catch (err) {
        localStorage.removeItem('patient_form_draft');
      }
    }
  }, []);

  // 4. SAVE DRAFT
  useEffect(() => {
    const hasData = formData.patient_name || formData.contact_email;
    if (hasData) {
      localStorage.setItem('patient_form_draft', JSON.stringify(formData));
    }
  }, [formData]);

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
        exam.id === id ? { ...exam, [field]: value } : exam
      );
      return { ...prev, examinations: updatedExams };
    });
  };

  const handleAddExamination = () => {
    setFormData(prev => ({
      ...prev,
      examinations: [...prev.examinations, { id: Date.now(), name: '', amount: '' }]
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
    setLoading(true);

    const { patient_name, contact_email, examinations, age, weight_kg, payment_type } = formData;
    if (!patient_name?.trim()) { setError('Patient Name is required.'); setLoading(false); return; }
    if (!contact_email?.trim() || !contact_email.includes('@')) { setError('Valid Email required.'); setLoading(false); return; }
    if (!age || isNaN(age) || age <= 0) { setError('Age must be a positive number.'); setLoading(false); return; }
    if (!weight_kg || isNaN(weight_kg) || weight_kg <= 0) { setError('Weight must be positive.'); setLoading(false); return; }
    if (!payment_type) { setError('Payment Type is required.'); setLoading(false); return; }
    
    for (const exam of examinations) {
      if (!exam.name?.trim() || !exam.amount || parseFloat(exam.amount) <= 0) {
        setError('All examinations need valid names and amounts.');
        setLoading(false);
        return;
      }
    }

    if (!token) { setError('Auth missing. Log in again.'); setLoading(false); return; }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok) {
        setOpenSnackbar(true);
        localStorage.removeItem('patient_form_draft');
        setFormData(initialFormState);
        setTimeout(() => navigate('/patients'), 1000);
      } else {
        setError(data.message || 'Failed to add patient record.');
      }
    } catch (err) {
      console.error(err);
      setError(err.name === 'AbortError' ? 'Request timed out.' : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="md" sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
            <IconButton onClick={() => navigate(-1)}>
                <ArrowBackIcon />
            </IconButton>
          <Typography variant="h4" gutterBottom component="h1" sx={{ mb: 3 }}>
            Add New Patient Record
          </Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          {/* Patient Demographics */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Patient Demographics</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {/* ✅ 3. ATTACH REF HERE */}
              <TextField 
                inputRef={nameInputRef} // Forces focus on this input
                margin="normal" required fullWidth id="patient_name" label="Patient Name" name="patient_name"
                value={formData.patient_name || ''} onChange={handleChange} 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField margin="normal" fullWidth select id="gender" label="Gender" name="gender"
                value={formData.gender || ''} onChange={handleChange} size="medium" sx={{ minWidth: 150 }}>
                {genderOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField margin="normal" required fullWidth id="age" label="Age" name="age" type="number"
                value={formData.age || ''} onChange={handleChange} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField margin="normal" required fullWidth id="weight_kg" label="Weight (kg)" name="weight_kg" type="number"
                value={formData.weight_kg || ''} onChange={handleChange} inputProps={{ step: "0.1", min: 0 }} />
            </Grid>
          </Grid>

          {/* Contact Details */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Contact Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField margin="normal" required fullWidth id="contact_email" label="Contact Email" name="contact_email" type="email"
                value={formData.contact_email || ''} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField margin="normal" fullWidth id="contact_phone_number" label="Contact Phone Number" name="contact_phone_number" type="tel"
                value={formData.contact_phone_number || ''} onChange={handleChange} />
            </Grid>
          </Grid>

          {/* Referral Information */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Referral Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField margin="normal" fullWidth id="referral_hospital" label="Referral Hospital" name="referral_hospital"
                value={formData.referral_hospital || ''} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField margin="normal" fullWidth id="referring_doctor" label="Referring Doctor" name="referring_doctor"
                value={formData.referring_doctor || ''} onChange={handleChange} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          {/* Examination Details */}
          <Typography variant="h6" gutterBottom>Examination Details</Typography>
          {formData.examinations.map((exam, index) => (
            <Box key={exam.id} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TextField sx={{ mr: 2, flex: 3 }} label={`Examination ${index + 1} Name`}
                value={exam.name || ''} onChange={(e) => handleExaminationChange(exam.id, 'name', e.target.value)} required />
              <TextField sx={{ mr: 2, flex: 1 }} label="Amount" type="number" inputProps={{ step: "0.01", min: "0" }}
                value={exam.amount || ''} onChange={(e) => handleExaminationChange(exam.id, 'amount', e.target.value)} required
                InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }} />
              {formData.examinations.length > 1 && (
                <IconButton onClick={() => handleRemoveExamination(exam.id)} color="error">
                  <RemoveCircleOutlineIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={handleAddExamination} variant="outlined" size="small" sx={{ mb: 3 }}>
            Add Another Examination
          </Button>

          <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="h6">
                Total Amount: ₦{Number(totalAmount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Payment Details Section */}
          <Typography variant="h6" gutterBottom>Payment Details</Typography>
          <TextField margin="normal" required fullWidth select id="payment_type" label="Payment Type" name="payment_type"
            value={formData.payment_type || ''} onChange={handleChange}>
            {paymentTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>

          {/* Medical Personnel Details */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Medical Personnel</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField margin="normal" fullWidth id="radiographer_name" label="Radiographer's Name" name="radiographer_name"
                value={formData.radiographer_name || ''} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField margin="normal" fullWidth id="radiologist_name" label="Radiologist's Name" name="radiologist_name"
                value={formData.radiologist_name || ''} onChange={handleChange} />
            </Grid>
          </Grid>

          {/* General Remarks */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>General Remarks</Typography>
          <TextField margin="normal" fullWidth id="remarks" label="Additional Remarks" name="remarks" multiline rows={4}
            value={formData.remarks || ''} onChange={handleChange} />

          {/* Submit Button (Spinner inside button now) */}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, height: 50 }} disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Add Patient Record'}
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
        message="Patient record added successfully! Redirecting..."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}

export default AddPatientPage;