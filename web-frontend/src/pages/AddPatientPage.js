// web-frontend/src/pages/AddPatientPage.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Material-UI Components
import {
  Container, Box, TextField, Button, Typography, Alert, CircularProgress,
  MenuItem, IconButton, Divider, Grid, InputAdornment, Stack, Snackbar,
  FormControl, InputLabel, Select, Card, CardContent
} from '@mui/material';

// Icons
import {
  Person as PersonIcon,
  LocalHospital as LocalHospitalIcon,
  MonitorWeight as MonitorWeightIcon,
  AttachMoney as AttachMoneyIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  RemoveCircleOutline as RemoveCircleOutlineIcon,
  Save as SaveIcon,
  ArrowBackIosNew as ArrowBackIosNewIcon
} from '@mui/icons-material';

import Layout from '../components/Layout';

function AddPatientPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const nameInputRef = useRef(null);

  // Configuration States
  const [modalities, setModalities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [fetchingConfig, setFetchingConfig] = useState(true);

  // Initial Form State
  const initialFormState = {
    patient_name: '',
    dob: '', 
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
    modality_id: '', 
    location_id: user?.location_id || '', 
    examinations: [{ id: Date.now(), name: '', amount: '' }],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);

  // --- Smart Age Calculator ---
  const calculateAge = (dobString) => {
    if (!dobString) return "";
    
    const birthDate = new Date(dobString);
    const today = new Date();
    
    const ageInMs = today - birthDate;
    const days = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

    if (days < 0) return "";
    
    if (days === 0) return "Today";
    if (days < 7) return `${days} day${days > 1 ? 's' : ''}`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    if (days < 730) {
      const months = Math.floor(days / 30.44);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    
    let years = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      years--;
    }
    return `${years} years`;
  };

  const handleDobChange = (e) => {
    const selectedDate = e.target.value;
    setFormData((prev) => ({
      ...prev,
      dob: selectedDate,
      age: calculateAge(selectedDate) 
    }));
  };

  // 1. Force Focus on Load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.focus();
    }, 300); 
    return () => clearTimeout(timer);
  }, []);

  // 2. Load Draft from LocalStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('patient_form_draft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormData(prev => ({ ...prev, ...parsedDraft }));
      } catch (err) { localStorage.removeItem('patient_form_draft'); }
    }
  }, []);

  // 3. Save Draft Automatically
  useEffect(() => {
    const hasData = formData.patient_name || formData.contact_email;
    if (hasData) {
      localStorage.setItem('patient_form_draft', JSON.stringify(formData));
    }
  }, [formData]);

  // 4. Fetch System Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [modRes, locRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL}/api/modalities`, { headers }),
          fetch(`${process.env.REACT_APP_API_URL}/api/locations`, { headers })
        ]);
        if (modRes.ok) setModalities(await modRes.json());
        if (locRes.ok) setLocations(await locRes.json());
      } catch (err) {
        console.error("Config fetch failed", err);
      } finally {
        setFetchingConfig(false);
      }
    };
    if (token) fetchConfig();
  }, [token]);

  // --- Handlers ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleExaminationChange = (id, field, value) => {
    const updatedExams = formData.examinations.map(exam =>
      exam.id === id ? { ...exam, [field]: value } : exam
    );
    setFormData({ ...formData, examinations: updatedExams });
  };

  const handleAddExamination = () => {
    setFormData({
      ...formData,
      examinations: [...formData.examinations, { id: Date.now(), name: '', amount: '' }]
    });
  };

  const handleRemoveExamination = (id) => {
    setFormData({
      ...formData,
      examinations: formData.examinations.filter(exam => exam.id !== id)
    });
  };

  const totalAmount = useMemo(() => {
    return formData.examinations.reduce((sum, exam) => {
      const amount = parseFloat(exam.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [formData.examinations]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Validations
    const { patient_name, age, weight_kg, payment_type, modality_id, location_id, examinations } = formData;
    
    if (!patient_name?.trim()) return setError('Patient Name is required.');
    if (!modality_id) return setError('Please select an Examination Type.');
    if (!location_id) return setError('Please confirm the Lab Location.');
    
    // ✅ FIX: Removed `isNaN` check so text strings like "3 weeks" or "2 months" pass validation
    if (!age?.toString().trim()) return setError('Age is required.'); 
    if (!weight_kg || isNaN(weight_kg) || weight_kg <= 0) return setError('Weight must be valid.');
    if (!payment_type) return setError('Payment Type is required.');
    
    for (const exam of examinations) {
      if (!exam.name?.trim() || !exam.amount || parseFloat(exam.amount) <= 0) {
        return setError('Please ensure all examinations have valid names and amounts.');
      }
    }

    // Payload: Pass age as a string directly to support descriptive text
    const payload = {
      ...formData,
      age: String(formData.age),
      weight_kg: parseFloat(formData.weight_kg)
    };

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setOpenSnackbar(true);
        localStorage.removeItem('patient_form_draft');
        setTimeout(() => navigate('/patients'), 1500);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save record.');
      }
    } catch (err) {
      setError('Network error: Ensure backend is reachable.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingConfig) return <Layout><Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress /></Box></Layout>;

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        
        {/* Header Section */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight="800" color="primary.main">New Patient Registration</Typography>
            <Typography variant="body2" color="text.secondary">Enter patient demographics and clinical details below.</Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            
            {/* LEFT COLUMN: Demographics & Clinical Info */}
            <Grid item xs={12} md={8}>
              <Stack spacing={3}>
                
                {/* 1. Demographics Card */}
                <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="primary" /> Demographics
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <TextField 
                          inputRef={nameInputRef} required fullWidth 
                          label="Full Name" name="patient_name" 
                          value={formData.patient_name} onChange={handleChange} 
                          placeholder="e.g. John Doe"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Gender</InputLabel>
                          <Select name="gender" value={formData.gender} label="Gender" onChange={handleChange}>
                            <MenuItem value="Male">Male</MenuItem>
                            <MenuItem value="Female">Female</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={4}>
                        <TextField 
                          fullWidth type="date" label="Date of Birth" name="dob" 
                          value={formData.dob || ''} onChange={handleDobChange} 
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <TextField 
                          required fullWidth type="text" label="Age" name="age" 
                          value={formData.age} onChange={handleChange} 
                          placeholder="e.g. 3 weeks or 30"
                        />
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <TextField 
                          required fullWidth type="number" label="Weight" name="weight_kg" 
                          value={formData.weight_kg} onChange={handleChange} 
                          InputProps={{ endAdornment: <InputAdornment position="end"><MonitorWeightIcon fontSize="small" /></InputAdornment> }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Phone" name="contact_phone_number" value={formData.contact_phone_number} onChange={handleChange} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Email Address" name="contact_email" value={formData.contact_email} onChange={handleChange} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* 2. Clinical Info Card */}
                <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalHospitalIcon color="error" /> Clinical Data
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <FormControl fullWidth required>
                          <InputLabel>Modality (Scan Type)</InputLabel>
                          <Select name="modality_id" value={formData.modality_id} label="Modality (Scan Type)" onChange={handleChange}>
                            {modalities.map(m => <MenuItem key={m.id} value={m.id}>{m.modality_name}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Referral Hospital" name="referral_hospital" value={formData.referral_hospital} onChange={handleChange} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Referring Doctor" name="referring_doctor" value={formData.referring_doctor} onChange={handleChange} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Radiologist" name="radiologist_name" value={formData.radiologist_name} onChange={handleChange} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth multiline rows={2} label="Clinical History / Remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

              </Stack>
            </Grid>

            {/* RIGHT COLUMN: Financials & Admin */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                
                {/* 3. Location Assignment */}
                <Card sx={{ borderRadius: 3, bgcolor: 'background.default', border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" gutterBottom>
                      ASSIGNMENT LOCATION
                    </Typography>
                    <FormControl fullWidth size="small" disabled={!user?.is_hq && user?.role !== 'admin'}>
                      <InputLabel>Lab Branch</InputLabel>
                      <Select name="location_id" value={formData.location_id} label="Lab Branch" onChange={handleChange}>
                        {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>

                {/* 4. Financials Card */}
                <Card sx={{ borderRadius: 3, boxShadow: '0 4px 15px rgba(0,0,0,0.08)', bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon color="success" /> Billing Details
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ mb: 2, maxHeight: 300, overflowY: 'auto' }}>
                      {formData.examinations.map((exam, index) => (
                        <Box key={exam.id} sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover', position: 'relative', border: '1px dashed #e0e0e0' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Item {index + 1}
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={12}>
                              <TextField 
                                fullWidth size="small" placeholder="Scan Name (e.g. Brain MRI)" 
                                value={exam.name} onChange={(e) => handleExaminationChange(exam.id, 'name', e.target.value)} 
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField 
                                fullWidth size="small" type="number" placeholder="0.00"
                                value={exam.amount} onChange={(e) => handleExaminationChange(exam.id, 'amount', e.target.value)}
                                InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
                              />
                            </Grid>
                          </Grid>
                          {formData.examinations.length > 1 && (
                            <IconButton 
                              size="small" color="error" onClick={() => handleRemoveExamination(exam.id)}
                              sx={{ position: 'absolute', top: 5, right: 5 }}
                            >
                              <RemoveCircleOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      ))}
                    </Box>

                    <Button 
                      fullWidth startIcon={<AddCircleOutlineIcon />} onClick={handleAddExamination} 
                      variant="outlined" size="small" sx={{ mb: 3, borderStyle: 'dashed' }}
                    >
                      Add Line Item
                    </Button>

                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Total Payable:</Typography>
                      <Typography variant="h6" fontWeight="bold" color="primary.main">
                        ₦{Number(totalAmount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>

                    <FormControl fullWidth required>
                      <InputLabel>Payment Method</InputLabel>
                      <Select name="payment_type" value={formData.payment_type} label="Payment Method" onChange={handleChange}>
                        <MenuItem value="Cash">Cash</MenuItem>
                        <MenuItem value="POS/Card">POS / Card</MenuItem>
                        <MenuItem value="Transfer">Bank Transfer</MenuItem>
                      </Select>
                    </FormControl>

                  </CardContent>
                </Card>

                {/* 5. Submit Action */}
                <Button 
                  type="submit" fullWidth variant="contained" size="large" 
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  disabled={loading}
                  sx={{ py: 1.5, fontSize: '1rem', borderRadius: 2, textTransform: 'none', boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)' }}
                >
                  {loading ? 'Processing...' : 'Register Patient'}
                </Button>

              </Stack>
            </Grid>

          </Grid>
        </Box>

        <Snackbar 
          open={openSnackbar} autoHideDuration={4000} onClose={() => setOpenSnackbar(false)} 
          message="Patient Registered Successfully!" 
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} 
        />
      </Container>
    </Layout>
  );
}

export default AddPatientPage;