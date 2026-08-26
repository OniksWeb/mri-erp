import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Box, Typography, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Grid, IconButton, Tooltip, Chip, Divider, Stack, Pagination
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Icons
import ContentPasteSearchIcon from '@mui/icons-material/ContentPasteSearch';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BusinessIcon from '@mui/icons-material/Business';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

import jsPDF from "jspdf";
import "jspdf-autotable";
import Layout from '../components/Layout';

function PatientListPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Data States
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Config Lists
  const [staffList, setStaffList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modalities, setModalities] = useState([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('patient_name');
  const [genderFilter, setGenderFilter] = useState('All');
  const [recordedByFilter, setRecordedByFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [modalityFilter, setModalityFilter] = useState('All');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL;

  // --- 🛡️ PERMISSIONS ENGINE ---
  const perms = user?.permissions || {};
  const canViewFinancials = perms.can_view_financials ?? (user?.role !== 'doctor');

  // ✅ UPGRADED: Dynamic Color Helper (Now supports Report Statuses)
const getStatusColor = (status) => {
    if (!status) return 'default';
    const s = status.toLowerCase();
    
    if (s === 'paid' || s === 'approved' || s === 'issued' || s === 'ready') return 'success'; 
    if (s === 'updated') return 'info'; // ✅ NEW: Returns bright blue
    if (s === 'pending' || s === 'pending_review' || s === 'partially paid' || s === 'in progress') return 'warning';
    if (s === 'not paid' || s === 'unpaid' || s === 'rejected') return 'error'; 
    
    return 'default'; 
  };

  // 1. Fetch Filters Data (Staff, Locations, Modalities)
  const fetchConfig = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [staffRes, locRes, modRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/staff-list`, { headers }),
        fetch(`${API_BASE_URL}/api/locations`, { headers }),
        fetch(`${API_BASE_URL}/api/modalities`, { headers }),
      ]);
      if (staffRes.ok) setStaffList(await staffRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (modRes.ok) setModalities(await modRes.json());
    } catch (err) { console.error("Config fetch error", err); }
  }, [token, API_BASE_URL]);

  // 2. Fetch Patients (with Pagination)
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
      const params = new URLSearchParams({
        page: page,
        limit: 10,
        includeExams: 'true'
      });

      // Append Filters
      if (search) { params.append('search', search); params.append('searchField', searchField); }
      if (genderFilter !== 'All') params.append('gender', genderFilter);
      if (recordedByFilter) params.append('recordedBy', recordedByFilter);
      if (locationFilter !== 'All') params.append('location_id', locationFilter);
      if (modalityFilter !== 'All') params.append('modality_id', modalityFilter);
      if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

      const response = await fetch(`${API_BASE_URL}/api/patients?${params.toString()}`, { headers });
      
      if (!response.ok) throw new Error('Failed to fetch patients.');
      
      const data = await response.json();
      
      setPatients(data.patients || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.totalRecords || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, searchField, genderFilter, recordedByFilter, locationFilter, modalityFilter, startDate, endDate, API_BASE_URL]);

  useEffect(() => {
    if (token) {
      fetchConfig();
      fetchPatients();
    }
  }, [token, fetchConfig, fetchPatients]);

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setSearch('');
    setGenderFilter('All');
    setRecordedByFilter('');
    setLocationFilter('All');
    setModalityFilter('All');
    setStartDate(null);
    setEndDate(null);
    setPage(1);
    fetchPatients();
  };

  const handleDownloadExcel = async () => {
    try {
      const params = new URLSearchParams({ 
        search: search || '', 
        searchField: searchField || '', 
        location_id: locationFilter || 'All', 
        modality_id: modalityFilter || 'All',
        gender: genderFilter || 'All' 
      });

      if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
      if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

      const response = await fetch(`${API_BASE_URL}/api/patients/export/excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Patients_Report_${new Date().toLocaleDateString()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { 
      console.error(err);
      alert("Excel export failed."); 
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.text("G2G Medical ERP - Patient List Summary", 14, 15);
    const tableColumn = ["Name", "Exam Code", "Category", "Location", "Date"];
    const tableRows = patients.map(p => [
      p.patient_name, p.exam_code, p.modality_name, p.branch_name, 
      new Date(p.created_at).toLocaleDateString()
    ]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    doc.save("Patient_List_Page.pdf");
  };

  const handlePrintReceipt = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients/${id}/receipt`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch(e) { alert("Failed to generate receipt"); }
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">Patient Database</Typography>

        {/* --- FILTERS SECTION --- */}
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Search" value={search} onChange={(e) => {setSearch(e.target.value); setPage(1);}} />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Search Field</InputLabel>
                <Select value={searchField} label="Search Field" onChange={(e) => setSearchField(e.target.value)}>
                  <MenuItem value="patient_name">Patient Name</MenuItem>
                  <MenuItem value="exam_code">Exam Code</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Modality</InputLabel>
                <Select value={modalityFilter} label="Modality" onChange={(e) => {setModalityFilter(e.target.value); setPage(1);}}>
                  <MenuItem value="All">All Types</MenuItem>
                  {modalities.map(m => <MenuItem key={m.id} value={m.id}>{m.modality_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth disabled={!user.is_hq && user.role !== 'admin'}>
                <InputLabel>Location</InputLabel>
                <Select value={locationFilter} label="Location" onChange={(e) => {setLocationFilter(e.target.value); setPage(1);}}>
                  <MenuItem value="All">All Labs</MenuItem>
                  {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Stack direction="row" spacing={1}>
                <Button fullWidth variant="contained" onClick={() => {setPage(1); fetchPatients();}} startIcon={<ContentPasteSearchIcon />}>Filter</Button>
                <Button variant="outlined" onClick={handleReset}><ClearIcon /></Button>
              </Stack>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker label="Start Date" value={startDate} onChange={(v) => {setStartDate(v); setPage(1);}} slotProps={{ textField: { fullWidth: true } }} />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker label="End Date" value={endDate} onChange={(v) => {setEndDate(v); setPage(1);}} slotProps={{ textField: { fullWidth: true } }} />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="contained" color="success" startIcon={<FileDownloadIcon />} onClick={handleDownloadExcel}>Excel</Button>
              <Button variant="contained" color="error" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadPDF}>PDF</Button>
            </Grid>
          </Grid>
        </Paper>

        {/* --- DATA TABLE --- */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 10 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 4 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell fontWeight="bold">Patient Detail</TableCell>
                    <TableCell>Exam ID</TableCell>
                    <TableCell>Modality & Branch</TableCell>
                    <TableCell>{canViewFinancials ? 'Billing & Status' : 'Status'}</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patients.length > 0 ? patients.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography fontWeight="bold">{p.patient_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.gender} | Age: {p.age}</Typography>
                      </TableCell>
                      <TableCell><Chip label={p.exam_code} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}>
                            <MedicalServicesIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.main' }} /> {p.modality_name}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'text.secondary' }}>
                            <BusinessIcon sx={{ fontSize: 14, mr: 0.5 }} /> {p.branch_name}
                          </Box>
                        </Stack>
                      </TableCell>
                      
                      <TableCell>
                        <Stack spacing={1}>
                            {/* 🛡️ FINANCIAL CLOAKING: Hide payment status from Doctors */}
                            {canViewFinancials && (
                              <Chip 
                                  label={p.payment_status} 
                                  color={getStatusColor(p.payment_status)} 
                                  size="small" 
                                  variant={p.payment_status === 'Not Paid' ? 'outlined' : 'filled'}
                              />
                            )}

                            {/* Result/Report Status Chip (Visible to everyone) */}
                            {(p.report_status || p.result_status) && (
                                <Chip 
                                    label={p.report_status || p.result_status} 
                                    color={getStatusColor(p.report_status || p.result_status)} 
                                    size="small" 
                                />
                            )}
                            
                            {/* 🛡️ FINANCIAL CLOAKING: Hide totals from Doctors */}
                            {canViewFinancials && (
                              <Typography variant="caption" fontWeight="bold">
                                  ₦{Number(p.total_amount).toLocaleString()}
                              </Typography>
                            )}
                        </Stack>
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton color="primary" onClick={() => navigate(`/patients/${p.id}/details`)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        
                        {/* 🛡️ FINANCIAL CLOAKING: Hide receipt printing from Doctors */}
                        {canViewFinancials && (
                          <Tooltip title="Receipt">
                            <IconButton color="secondary" onClick={() => handlePrintReceipt(p.id)}>
                              <PrintIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} align="center">No records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* --- PAGINATION CONTROLS --- */}
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary" 
                size="large"
                showFirstButton 
                showLastButton
              />
              <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                Page {page} of {totalPages} — Total Records: {totalRecords}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Layout>
  );
}

export default PatientListPage;