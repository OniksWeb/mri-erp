import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box, Typography, Paper, CircularProgress, Alert, Grid, List, ListItem, 
  ListItemText, ListItemIcon, Divider, Button, TextField, MenuItem, 
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Chip, FormControl, InputLabel, Select, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Tooltip, IconButton, Stack, Card, CardContent
} from '@mui/material';

// Icons
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import MaleIcon from '@mui/icons-material/Male';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StraightenIcon from '@mui/icons-material/Straighten';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import CodeIcon from '@mui/icons-material/Code';

// New Icons for Results Portal
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import Layout from '../components/Layout';

function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [locations, setLocations] = useState([]);
  const [modalities, setModalities] = useState([]);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [paymentStatusOption, setPaymentStatusOption] = useState('');
  const [isApprovingPayment, setIsApprovingPayment] = useState(false);

  // --- NEW: Results State ---
  const [results, setResults] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [scanTitle, setScanTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL;

  // --- 🛡️ PERMISSIONS ENGINE (With safe fallbacks) ---
  const perms = user?.permissions || {};
  const canViewFinancials = perms.can_view_financials ?? (user?.role !== 'doctor');
  const canManagePayments = perms.can_manage_payments ?? ['admin', 'financial_admin', 'hq_financial_admin'].includes(user?.role);
  const canUploadResults = perms.can_upload_results ?? true;
  const canDownloadResults = perms.can_download_results ?? true;
  const canDeleteResults = perms.can_delete_results ?? (user?.role === 'admin');
  const canEditPatients = perms.can_edit_patients ?? true;
  const canDeletePatients = perms.can_delete_patients ?? (user?.role === 'admin');

  const fetchPatientDetails = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [res, locRes, modRes, resultsRes] = await Promise.all([
        fetch(`${API_URL}/api/patients/${id}`, { headers }),
        fetch(`${API_URL}/api/locations`, { headers }),
        fetch(`${API_URL}/api/modalities`, { headers }),
        fetch(`${API_URL}/api/patients/${id}/results`, { headers }) // Fetch the PDF files
      ]);

      const data = await res.json();
      if (res.ok) {
        setPatient(data);
        setLocations(await locRes.json());
        setModalities(await modRes.json());
        if (resultsRes.ok) setResults(await resultsRes.json());
        
        setFormData({ ...data, examinations: data.examinations || [] });
        setPaymentStatusOption(data.payment_status || 'Not Paid');
      } else {
        setError(data.message || 'Failed to fetch patient details.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPatientDetails(); }, [id, token]);

  const handleEditClick = () => setIsEditMode(true);
  const handleCancelEdit = () => { setIsEditMode(false); setFormData({ ...patient }); };
  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleExaminationChange = (examId, field, value) => {
    setFormData((prev) => ({
      ...prev, examinations: prev.examinations.map((exam) => exam.id === examId ? { ...exam, [field]: value } : exam)
    }));
  };

  const handleAddExamination = () => setFormData((prev) => ({ ...prev, examinations: [...prev.examinations, { id: `new-${Date.now()}`, name: '', amount: '' }] }));
  const handleRemoveExamination = (examId) => setFormData((prev) => ({ ...prev, examinations: prev.examinations.filter((exam) => exam.id !== examId) }));

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/patients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...formData, age: parseInt(formData.age), weight_kg: parseFloat(formData.weight_kg) }),
      });
      if (response.ok) {
        await fetchPatientDetails();
        setIsEditMode(false);
        alert('Record updated successfully!');
      } else {
        const data = await response.json();
        setError(data.message || 'Update failed.');
      }
    } catch (err) { setError('Connection error.'); }
    finally { setIsSaving(false); }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/patients/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) navigate('/patients');
    } catch (err) { setError('Delete failed.'); }
    finally { setIsDeleting(false); setOpenDeleteDialog(false); }
  };

  const handleApprovePayment = async () => {
    setIsApprovingPayment(true);
    try {
      const response = await fetch(`${API_URL}/api/patients/${id}/approve-payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: paymentStatusOption }),
      });
      if (response.ok) {
        await fetchPatientDetails();
        setOpenPaymentDialog(false);
      }
    } catch (err) { setError('Payment update failed.'); }
    finally { setIsApprovingPayment(false); }
  };

  // --- NEW: Handle File Upload ---
  const handleUploadReport = async () => {
    if (!uploadFile) return alert("Please select a PDF or Image file first.");
    setIsUploading(true);

    const data = new FormData();
    data.append("resultFile", uploadFile);
    data.append("scan_title", scanTitle || "General Result");

    try {
      const res = await fetch(`${API_URL}/api/patients/${id}/results/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // Notice NO Content-Type here. Browser sets it for FormData
        body: data
      });
      if (res.ok) {
        alert("Report Uploaded Successfully!");
        setUploadFile(null);
        setScanTitle('');
        fetchPatientDetails(); // Refresh everything
      } else {
        alert("Upload failed.");
      }
    } catch (e) { alert("Connection Error"); }
    finally { setIsUploading(false); }
  };

  // --- NEW: Download Result ---
  const handleDownloadResult = async (fileId) => {
    try {
      const res = await fetch(`${API_URL}/api/patients/results/${fileId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, '_blank');
      } else alert("Failed to download.");
    } catch (e) { alert("Error downloading file."); }
  };

  // --- NEW: Delete Result ---
  const handleDeleteResult = async (fileId) => {
    if (!window.confirm("Are you sure you want to permanently delete this report? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`${API_URL}/api/patients/results/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert("Report deleted successfully.");
        fetchPatientDetails(); // Refresh the list!
      } else {
        alert("Failed to delete report.");
      }
    } catch (e) { alert("Error connecting to server."); }
  };

  // Badges
  const getStatusChip = (status) => {
    if (status === 'Approved') return <Chip label="Approved" color="success" icon={<CheckCircleOutlineIcon />} size="small" />;
    if (status === 'Pending') return <Chip label="Pending" color="warning" icon={<HourglassEmptyIcon />} size="small" />;
    return <Chip label="Not Paid" color="error" icon={<HighlightOffIcon />} size="small" />;
  };

const getReportStatusChip = (status) => {
    // ✅ NEW: Striking Blue badge for re-uploads or additions
    if (status === 'Updated') return <Chip label="Result Updated" color="info" size="small" sx={{ ml: 2, fontWeight: 'bold' }}/>;
    if (status === 'Ready') return <Chip label="Result Ready" color="success" size="small" sx={{ ml: 2, fontWeight: 'bold' }}/>;
    if (status === 'In Progress') return <Chip label="Result In Progress" color="warning" size="small" sx={{ ml: 2 }}/>;
    return <Chip label="Result Not Ready" color="default" size="small" sx={{ ml: 2 }}/>;
  };

  if (loading) return <Layout><Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box></Layout>;
  if (error && !openDeleteDialog && !openPaymentDialog) return <Layout><Alert severity="error" sx={{ mt: 2 }}>{error}</Alert></Layout>;
  if (!patient) return <Layout><Alert severity="info" sx={{ mt: 2 }}>Patient not found.</Alert></Layout>;

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          
          {/* HEADER & ACTIONS */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
              <Typography variant="h4" fontWeight="bold">Patient File</Typography>
              {getReportStatusChip(patient.report_status)}
            </Stack>
            
            <Box>
              {canEditPatients && !isEditMode && <Button variant="contained" startIcon={<EditIcon />} onClick={handleEditClick} sx={{ mr: 1 }}>Edit</Button>}
              {canDeletePatients && <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setOpenDeleteDialog(true)} sx={{ mr: 1 }}>Delete</Button>}
              {canManagePayments && <Button variant="contained" color="info" startIcon={<AttachMoneyIcon />} onClick={() => setOpenPaymentDialog(true)}>Manage Payment</Button>}
            </Box>
          </Stack>

          {/* BASIC INFO */}
          <Grid container spacing={3}>
            {/* Column 1: Demographics & Contact */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="primary" gutterBottom>Demographics & Contact</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><PersonIcon /></ListItemIcon>
                  <ListItemText primary="Patient Name" secondary={isEditMode ? <TextField fullWidth name="patient_name" value={formData.patient_name} onChange={handleFormChange} size="small" /> : patient.patient_name} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><AccessTimeIcon /></ListItemIcon>
                  <ListItemText primary="Age (Years)" secondary={isEditMode ? <TextField fullWidth name="age" type="number" value={formData.age} onChange={handleFormChange} size="small" /> : patient.age} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><StraightenIcon /></ListItemIcon>
                  <ListItemText primary="Weight (kg)" secondary={isEditMode ? <TextField fullWidth name="weight_kg" type="number" value={formData.weight_kg} onChange={handleFormChange} size="small" /> : patient.weight_kg} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><MaleIcon /></ListItemIcon>
                  <ListItemText primary="Gender" secondary={isEditMode ? <TextField select fullWidth name="gender" value={formData.gender} onChange={handleFormChange} size="small"><MenuItem value="Male">Male</MenuItem><MenuItem value="Female">Female</MenuItem></TextField> : patient.gender} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText primary="Contact Details" secondary={`${patient.contact_email} / ${patient.contact_phone_number}`} />
                </ListItem>
              </List>
            </Grid>

            {/* Column 2: Exam & Clinical Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="primary" gutterBottom>Clinical Information</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                  <ListItemText primary="Date of Entry" secondary={new Date(patient.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><BusinessIcon /></ListItemIcon>
                  <ListItemText primary="Lab Branch" secondary={isEditMode && user.is_hq ? <TextField select fullWidth name="location_id" value={formData.location_id} onChange={handleFormChange} size="small">{locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}</TextField> : patient.branch_name} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
                  <ListItemText primary="Modality Type" secondary={isEditMode ? <TextField select fullWidth name="modality_id" value={formData.modality_id} onChange={handleFormChange} size="small">{modalities.map(m => <MenuItem key={m.id} value={m.id}>{m.modality_name}</MenuItem>)}</TextField> : patient.modality_name} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CodeIcon /></ListItemIcon>
                  <ListItemText primary="Exam Code" secondary={<Chip label={patient.exam_code} color="primary" variant="outlined" size="small" />} />
                </ListItem>
                
                {/* 🛡️ FINANCIAL CLOAKING: Hide receipt numbers from Doctors */}
                {canViewFinancials && (
                  <ListItem>
                    <ListItemIcon><ReceiptIcon /></ListItemIcon>
                    <ListItemText primary="Receipt Number" secondary={patient.receipt_number || 'N/A'} />
                  </ListItem>
                )}
                
                <ListItem>
                  <ListItemIcon><LocalHospitalIcon /></ListItemIcon>
                  <ListItemText primary="Referring Entity" secondary={isEditMode ? <TextField fullWidth name="referring_doctor" value={formData.referring_doctor} onChange={handleFormChange} size="small" /> : `${patient.referring_doctor} (${patient.referral_hospital})`} />
                </ListItem>
              </List>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3}>
            {/* Medical Personnel */}
            <Grid item xs={12} md={canViewFinancials ? 6 : 12}>
              <Typography variant="h6" gutterBottom>Medical Personnel</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
                  <ListItemText primary="Radiographer" secondary={isEditMode ? <TextField fullWidth name="radiographer_name" value={formData.radiographer_name} onChange={handleFormChange} size="small" /> : patient.radiographer_name || 'N/A'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon><MedicalServicesIcon /></ListItemIcon>
                  <ListItemText primary="Radiologist" secondary={isEditMode ? <TextField fullWidth name="radiologist_name" value={formData.radiologist_name} onChange={handleFormChange} size="small" /> : patient.radiologist_name || 'N/A'} />
                </ListItem>
              </List>
            </Grid>
            
            {/* 🛡️ FINANCIAL CLOAKING: Hide payment status from Doctors */}
            {canViewFinancials && (
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Billing & Status</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><AttachMoneyIcon /></ListItemIcon>
                    <ListItemText primary="Payment Status" secondary={getStatusChip(patient.payment_status)} />
                  </ListItem>
                  {patient.payment_status === 'Approved' && (
                    <ListItem>
                      <ListItemIcon><CheckCircleOutlineIcon /></ListItemIcon>
                      <ListItemText primary="Approved By" secondary={`${patient.approved_by_staff_name || 'Admin'} on ${new Date(patient.approved_at).toLocaleString()}`} />
                    </ListItem>
                  )}
                </List>
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* EXAMINATIONS & TESTS */}
          <Typography variant="h6" gutterBottom>Tests Performed</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell fontWeight="bold">Examination Name</TableCell>
                  {/* 🛡️ FINANCIAL CLOAKING */}
                  {canViewFinancials && <TableCell align="right" fontWeight="bold">Amount (₦)</TableCell>}
                  {isEditMode && <TableCell align="center">Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {(isEditMode ? formData.examinations : patient.examinations).map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>{isEditMode ? <TextField fullWidth value={exam.name} onChange={(e) => handleExaminationChange(exam.id, 'name', e.target.value)} size="small" /> : exam.name}</TableCell>
                    
                    {/* 🛡️ FINANCIAL CLOAKING */}
                    {canViewFinancials && (
                        <TableCell align="right">{isEditMode ? <TextField type="number" value={exam.amount} onChange={(e) => handleExaminationChange(exam.id, 'amount', e.target.value)} size="small" InputProps={{ startAdornment: '₦' }} /> : `₦${Number(exam.amount).toLocaleString()}`}</TableCell>
                    )}

                    {isEditMode && <TableCell align="center"><IconButton color="error" onClick={() => handleRemoveExamination(exam.id)}><RemoveCircleOutlineIcon /></IconButton></TableCell>}
                  </TableRow>
                ))}
                {isEditMode && (
                  <TableRow><TableCell colSpan={canViewFinancials ? 3 : 2}><Button startIcon={<AddIcon />} onClick={handleAddExamination}>Add Line Item</Button></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 🛡️ FINANCIAL CLOAKING */}
          {canViewFinancials && (
            <Box sx={{ mt: 2, textAlign: 'right', p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'white' }}>
              <Typography variant="h6">Total Bill: ₦{Number((isEditMode ? formData.examinations : patient.examinations).reduce((s, e) => s + parseFloat(e.amount || 0), 0)).toLocaleString()}</Typography>
            </Box>
          )}

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom><AssignmentIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Remarks</Typography>
            {isEditMode ? <TextField fullWidth multiline rows={4} name="remarks" value={formData.remarks} onChange={handleFormChange} /> : 
              <Paper sx={{ p: 2, bgcolor: 'grey.50', fontStyle: 'italic' }}>{patient.remarks || 'No clinical remarks recorded.'}</Paper>
            }
          </Box>

          {/* --- NEW: CLINICAL REPORTS PORTAL --- */}
          {(canUploadResults || canDownloadResults) && (
             <Box sx={{ mt: 5 }}>
               <Divider sx={{ mb: 4 }}><Chip label="Clinical Reports & Scans" color="primary" /></Divider>
               
               <Grid container spacing={3}>
                  {/* Upload Section (For Doctors) */}
                  {canUploadResults && (
                      <Grid item xs={12} md={5}>
                        {/* ✅ FIX: Changed bgcolor to 'background.default' so it adapts to dark/light mode */}
                        <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                          <CardContent>
                             <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                               <CloudUploadIcon sx={{ verticalAlign: 'middle', mr: 1}}/> Upload New Scan
                             </Typography>
                             
                             {/* ✅ FIX: Removed bgcolor: 'white' */}
                             <TextField 
                                fullWidth size="small" 
                                label="Scan Title (e.g. Brain MRI)" 
                                value={scanTitle} onChange={(e) => setScanTitle(e.target.value)} 
                                sx={{ mb: 2, mt: 1 }} 
                             />
                             
                             {/* ✅ FIX: Removed bgcolor: 'white' */}
                             <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }}>
                               {uploadFile ? uploadFile.name : "Select PDF/Image File"}
                               <input type="file" hidden accept=".pdf,image/*" onChange={(e) => setUploadFile(e.target.files[0])} />
                             </Button>
                             
                             <Button 
                                variant="contained" color="primary" fullWidth 
                                onClick={handleUploadReport} disabled={isUploading || !uploadFile}
                             >
                               {isUploading ? <CircularProgress size={24} color="inherit" /> : 'Upload Report'}
                             </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                  )}

                  {/* List Section (For Doctors and Medical Staff) */}
                  {canDownloadResults && (
                      <Grid item xs={12} md={canUploadResults ? 7 : 12}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Available Reports</Typography>
                        {results.length === 0 ? (
                            <Alert severity="info">No reports have been uploaded yet.</Alert>
                        ) : (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead sx={{ bgcolor: 'action.hover' }}>
                                  <TableRow>
                                    <TableCell>Scan Title</TableCell>
                                    <TableCell>Date Uploaded</TableCell>
                                    <TableCell align="center">Action</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {results.map((r) => (
                                    <TableRow key={r.file_id}>
                                      <TableCell><PictureAsPdfIcon color="error" sx={{ verticalAlign: 'middle', mr: 1, fontSize: 18 }} /> {r.scan_title || 'General Result'}</TableCell>
                                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                                      <TableCell align="center">
                                        {/* ✅ THE FRONTEND LOCK */}
                                        <Tooltip title={patient.payment_status === 'Approved' ? "Download/View" : "Payment Required to Download"}>
                                          <span> {/* Span is required for Tooltips on disabled buttons */}
                                            <IconButton 
                                              color={patient.payment_status === 'Approved' ? "primary" : "default"} 
                                              onClick={() => handleDownloadResult(r.file_id)}
                                              disabled={patient.payment_status !== 'Approved' && user.role !== 'admin'}
                                            >
                                              <DownloadIcon />
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                        
                                        {canDeleteResults && (
                                          <Tooltip title="Delete File">
                                            <IconButton color="error" onClick={() => handleDeleteResult(r.file_id)}>
                                              <DeleteIcon />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                        )}
                      </Grid>
                  )}
               </Grid>
             </Box>
          )}

          {isEditMode && (
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
              <Button variant="contained" size="large" startIcon={<SaveIcon />} onClick={handleSaveEdit} disabled={isSaving}>Save Record</Button>
              <Button variant="outlined" size="large" onClick={handleCancelEdit}>Discard Changes</Button>
            </Stack>
          )}
        </Paper>

        {/* Dialogs */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent><DialogContentText>Are you sure you want to delete {patient?.patient_name}?</DialogContentText></DialogContent>
            <DialogActions>
                <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
                <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting}>Delete</Button>
            </DialogActions>
        </Dialog>

        <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)}>
          <DialogTitle>Update Billing Status</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select value={paymentStatusOption} label="Status" onChange={(e) => setPaymentStatusOption(e.target.value)}>
                    <MenuItem value="Not Paid">Not Paid</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Approved">Approved</MenuItem>
                </Select>
            </FormControl>
          </DialogContent>
          <DialogActions><Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button><Button onClick={handleApprovePayment} variant="contained">Update</Button></DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
}

export default PatientDetailPage;