// web-frontend/src/pages/ResultsUploadPage.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
  Paper // Added Paper for consistent styling
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { styled } from '@mui/material/styles';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Stack, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import Layout from '../components/Layout'; // Assuming Layout wraps the page

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

function ResultsUploadPage() {
  const { token, user } = useAuth(); // Ensure user is available for initial check
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch list of patients for the dropdown
  useEffect(() => {
    const fetchPatients = async () => {
      if (!token) {
        setErrorMessage('Authentication token missing. Please log in.');
        return;
      }
      try {
        setLoading(true); // Set loading for patient list fetch
        const response = await axios.get('https://g2g-mri-erp-bfw57.ondigitalocean.app/api/patients', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPatients(response.data);
      } catch (error) {
        console.error('Error fetching patients:', error);
        setErrorMessage(error.response?.data?.message || 'Failed to fetch patients for dropdown.');
      } finally {
        setLoading(false); // Stop loading after patient list fetch
      }
    };
    if (user && token) { // Only fetch if user and token are present
        fetchPatients();
    }
  }, [token, user]); // Add user to dependencies

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Basic validation for file type (optional, but good practice)
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
      ];
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage('Invalid file type. Please upload a PDF, JPG, PNG, or Word document.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage(''); // Clear error if a valid file is selected
    } else {
        setSelectedFile(null); // Clear selected file if user cancels file selection
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    console.log("Submit button clicked.");
    console.log("selectedPatientId state:", selectedPatientId);
    console.log("selectedFile state:", selectedFile);

    if (!selectedPatientId) {
      setErrorMessage('Please select a patient before uploading.');
      setLoading(false);
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('resultFile', selectedFile);
    // Do NOT append patientId to formData for this specific backend route,
    // as the backend expects it in req.params.patientId, not req.body.
    // formData.append('patientId', selectedPatientId); // <-- REMOVED THIS LINE
    formData.append('remarks', remarks);

    try {
      console.log(`Attempting to upload for patient ID: ${selectedPatientId}`);
      console.log(`Target URL: https://g2g-mri-erp-bfw57.ondigitalocean.app/api/patients/${selectedPatientId}/results/upload`);

      const response = await axios.post(
        `https://g2g-mri-erp-bfw57.ondigitalocean.app/api/patients/${selectedPatientId}/results/upload`, // Use selectedPatientId in URL
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data', // Crucial for file uploads
            Authorization: `Bearer ${token}`
          },
        }
      );
      setSuccessMessage(response.data.message);
      setSelectedFile(null); // Clear file input
      setSelectedPatientId(''); // Clear patient selection after successful upload
      setRemarks(''); // Clear remarks
      // Optionally navigate to results management page for the patient after successful upload
      // navigate(`/patients/${selectedPatientId}/results/manage`);
    } catch (error) {
      console.error('Error uploading result:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to upload result. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !token) { // Handle unauthenticated state
    return (
      <Layout>
        <Alert severity="error" sx={{mt:3}}>You must be logged in to upload results.</Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        {/* Go Back Button and Page Title */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
            <IconButton onClick={() => navigate(-1)}>
                <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4">Upload Patient Result</Typography>
        </Stack>

        {/* Status Messages */}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
        {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

        <Paper elevation={3} sx={{ p: 4, mt: 2, borderRadius: 2 }}>
            <form onSubmit={handleSubmit}>
                {/* Select Patient Dropdown */}
                <FormControl fullWidth margin="normal" error={!selectedPatientId && !!errorMessage}>
                    <InputLabel id="patient-select-label">Select Patient</InputLabel>
                    <Select
                        labelId="patient-select-label"
                        id="patient-select"
                        value={selectedPatientId}
                        label="Select Patient"
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                        disabled={loading || patients.length === 0}
                    >
                        {loading && patients.length === 0 ? (
                            <MenuItem value="" disabled>Loading patients...</MenuItem>
                        ) : patients.length === 0 ? (
                            <MenuItem value="" disabled>No patients available</MenuItem>
                        ) : (
                            <MenuItem value="">
                                <em>None Selected</em>
                            </MenuItem>
                        )}
                        {patients.map((patient) => (
                            <MenuItem key={patient.id} value={patient.id}>
                                {patient.patient_name} (ID: {patient.id}) - MRI Code: {patient.mri_code || 'N/A'}
                            </MenuItem>
                        ))}
                    </Select>
                    {!selectedPatientId && !!errorMessage && errorMessage.includes('patient') && (
                        <FormHelperText>Please select a patient.</FormHelperText>
                    )}
                </FormControl>

                {/* Remarks Field */}
                <TextField
                    fullWidth
                    margin="normal"
                    label="Remarks (Optional)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    multiline
                    rows={3}
                    disabled={loading}
                />

                {/* File Upload Button */}
                <Button
                    component="label"
                    role={undefined}
                    variant="outlined"
                    tabIndex={-1}
                    startIcon={<CloudUploadIcon />}
                    sx={{ mt: 2, mb: 2 }}
                    disabled={loading}
                >
                    {selectedFile ? `File Selected: ${selectedFile.name}` : 'Select Result File'}
                    <VisuallyHiddenInput type="file" name="resultFile" onChange={handleFileChange} />
                </Button>
                {selectedFile && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </Typography>
                )}
                 {!!errorMessage && errorMessage.includes('file type') && (
                    <FormHelperText error>{errorMessage}</FormHelperText>
                 )}


                {/* Submit Button */}
                <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                    disabled={loading || !selectedPatientId || !selectedFile}
                >
                    {loading ? <CircularProgress size={24} /> : 'Submit Result'}
                </Button>
            </form>
        </Paper>

        {/* Go to Dashboard Button */}
        <Button
          variant="text"
          onClick={() => navigate('/dashboard')} // Links to the main dashboard page
          sx={{ mt: 2 }}
        >
          Go to Dashboard
        </Button>
      </Box>
    </Layout>
  );
}

export default ResultsUploadPage;