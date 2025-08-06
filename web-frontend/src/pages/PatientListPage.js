// web-frontend/src/pages/PatientListPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Box, Typography, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Grid, IconButton, Tooltip
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ContentPasteSearchIcon from '@mui/icons-material/ContentPasteSearch'; // For search/filter
import ClearIcon from '@mui/icons-material/Clear'; // For reset button
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print'; // For invoice print

import Layout from '../components/Layout'; // Assuming Layout wraps the page

function PatientListPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffList, setStaffList] = useState([]); // State for medical staff list

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('patient_name'); // 'patient_name' or 'mri_code'
  const [genderFilter, setGenderFilter] = useState('All'); // 'All', 'Male', 'Female', 'Other'
  const [recordedByFilter, setRecordedByFilter] = useState(''); // Staff ID
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const API_BASE_URL = 'http://localhost:5001'; // Your backend URL

  // Function to fetch patients based on current filters
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.append('search', search);
        params.append('searchField', searchField);
      }
      if (genderFilter !== 'All') {
        params.append('gender', genderFilter);
      }
      if (recordedByFilter) {
        params.append('recordedBy', recordedByFilter);
      }
      if (startDate) {
        // Format date to YYYY-MM-DD for backend
        params.append('startDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        // Format date to YYYY-MM-DD for backend
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }

      const response = await fetch(`${API_BASE_URL}/api/patients?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch patients.');
      }

      const data = await response.json();
      setPatients(data);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [token, search, searchField, genderFilter, recordedByFilter, startDate, endDate]);

  // Function to fetch the list of medical staff for the filter dropdown
  const fetchStaffList = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff-list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch staff list.');
      }
      const data = await response.json();
      setStaffList(data);
    } catch (err) {
      console.error('Error fetching staff list:', err);
      // Don't set a global error for this, as patients can still load
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      fetchPatients();
      fetchStaffList(); // Fetch staff list on component mount
    }
    // Ensure that fetchPatients and fetchStaffList are included in the dependency array
    // because they are defined inside the component and rely on `token`.
    // useCallback helps stabilize them, but ESLint might still warn without them here.
  }, [user, token, fetchPatients, fetchStaffList]);


  const handleSearchSubmit = (event) => {
    event.preventDefault(); // Prevent default form submission
    fetchPatients(); // Trigger patient fetch with current filter states
  };

  const handleResetFilters = () => {
    setSearch('');
    setSearchField('patient_name');
    setGenderFilter('All');
    setRecordedByFilter('');
    setStartDate(null);
    setEndDate(null);
    // After resetting states, re-fetch patients to show all
    // The `useEffect` with `fetchPatients` in its dependency array will handle this automatically
    // when the state variables change. So, a direct call here is often not strictly needed,
    // but explicit call ensures immediate update if useEffect's dependencies are complex.
    fetchPatients();
  };

  const handlePrintInvoice = async (patientId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/print-invoice/${patientId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate invoice.');
      }

      // Assuming the backend sends a file stream or a direct download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${patientId}.pdf`; // Suggested filename
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      alert('Invoice generated and downloaded successfully!');
    } catch (err) {
      console.error('Error generating invoice:', err);
      alert(`Error generating invoice: ${err.message}`);
    }
  };


  const renderPatientTable = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height="200px">
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (patients.length === 0) {
      return <Alert severity="info">No patients found matching your criteria.</Alert>;
    }

    return (
      <TableContainer component={Paper} elevation={3}>
        <Table stickyHeader aria-label="patient table">
          <TableHead>
            <TableRow>
              <TableCell>Patient Name</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>MRI Code</TableCell>
              <TableCell>MRI Type</TableCell>
              <TableCell>Date/Time</TableCell>
              <TableCell>Referred By</TableCell>
              <TableCell>Recorded By</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>{patient.patient_name}</TableCell>
                <TableCell>{patient.patient_age}</TableCell>
                <TableCell>{patient.gender}</TableCell>
                <TableCell>{patient.mri_code}</TableCell>
                <TableCell>{patient.mri_type}</TableCell>
                <TableCell>{new Date(patient.mri_date_time).toLocaleString()}</TableCell>
                <TableCell>{patient.referred_by_doctor}</TableCell>
                <TableCell>{patient.recorded_by_staff_name || 'N/A'}</TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton
                      color="primary"
                      onClick={() => navigate(`/patients/${patient.id}/details`)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Print Invoice">
                    <IconButton
                      color="secondary"
                      onClick={() => handlePrintInvoice(patient.id)}
                    >
                      <PrintIcon />
                    </IconButton>
                  </Tooltip>
                  {/* Add more actions like Edit, Delete, Manage Results here later */}
                  <Tooltip title="Manage Results">
                    <IconButton
                      color="info"
                      onClick={() => navigate(`/patients/${patient.id}/results/manage`)}
                    >
                      <ContentPasteSearchIcon /> {/* Use an appropriate icon for results management */}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Patient List
        </Typography>

        {/* Search and Filter Section */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Search & Filters</Typography>
          <form onSubmit={handleSearchSubmit}>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Search"
                  variant="outlined"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or MRI Code"
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Search By</InputLabel>
                  <Select
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    label="Search By"
                  >
                    <MenuItem value="patient_name">Patient Name</MenuItem>
                    <MenuItem value="mri_code">MRI Code</MenuItem>
                    <MenuItem value="both">Both</MenuItem> {/* 'both' handles backend default behavior */}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Gender</InputLabel>
                  <Select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    label="Gender"
                  >
                    <MenuItem value="All">All Genders</MenuItem>
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Recorded By</InputLabel>
                  <Select
                    value={recordedByFilter}
                    onChange={(e) => setRecordedByFilter(e.target.value)}
                    label="Recorded By"
                  >
                    <MenuItem value="">All Staff</MenuItem>
                    {staffList.map((staff) => (
                      <MenuItem key={staff.id} value={staff.id}>
                        {staff.full_name || staff.username}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="MRI Date Start"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    slotProps={{ textField: { fullWidth: true, variant: "outlined" } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="MRI Date End"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    slotProps={{ textField: { fullWidth: true, variant: "outlined" } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<ContentPasteSearchIcon />}
                  fullWidth
                >
                  Search
                </Button>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<ClearIcon />}
                  onClick={handleResetFilters}
                  fullWidth
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>

        {/* Patient Table */}
        {renderPatientTable()}
      </Box>
    </Layout>
  );
}

export default PatientListPage;