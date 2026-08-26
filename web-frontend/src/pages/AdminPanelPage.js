import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, CircularProgress, Alert, Button, IconButton, Chip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Select, MenuItem, FormControl, InputLabel, TextField, Stack, Tabs, Tab, Grid, Tooltip,
  FormControlLabel, Checkbox
} from '@mui/material';

// Icons
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import SecurityIcon from '@mui/icons-material/Security'; // ✅ NEW: Icon for permissions

function AdminPanelPage() {
  const { token, user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0); 

  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  // Actions: 'edit_staff', 'delete', 'add_location', 'add_modality', 'edit_permissions'
  const [dialogAction, setDialogAction] = useState(null); 
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Forms
  const [newRole, setNewRole] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [locForm, setLocForm] = useState({ name: '', address: '', location_code: '', is_hq: false });
  const [modForm, setModForm] = useState({ modality_name: '' });

  // ✅ NEW: Permissions State
  const [permissions, setPermissions] = useState({
    perm_add_patients: false,
    perm_edit_patients: false,
    perm_delete_patients: false,
    perm_view_financials: false,
    perm_manage_payments: false,
    perm_upload_results: false,
    perm_download_results: false,
    perm_delete_results: false,
  });

  const API_URL = process.env.REACT_APP_API_URL;

  const fetchAllData = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [staffRes, locRes, modRes] = await Promise.all([
        fetch(`${API_URL}/api/staff-list`, { headers }),
        fetch(`${API_URL}/api/locations`, { headers }),
        fetch(`${API_URL}/api/modalities`, { headers }),
      ]);

      if (staffRes.ok) setStaff(await staffRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (modRes.ok) setModalities(await modRes.json());
    } catch (err) {
      setError('Network error: Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [token, user, API_URL]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // Actions
  const handleOpenDialog = (action, target = null) => {
    setDialogAction(action);
    setSelectedStaff(target);
    
    // Reset forms based on action
    if (action === 'edit_staff' && target) {
        setNewRole(target.role || '');
        setNewLocationId(target.location_id || '');
    } else if (action === 'add_location') {
        setLocForm({ name: '', address: '', location_code: '', is_hq: false });
    } else if (action === 'add_modality') {
        setModForm({ modality_name: '' });
    } else if (action === 'edit_permissions' && target) {
        // ✅ Pre-fill the toggles with the user's current DB values
        setPermissions({
          perm_add_patients: target.perm_add_patients ?? false,
          perm_edit_patients: target.perm_edit_patients ?? false,
          perm_delete_patients: target.perm_delete_patients ?? false,
          perm_view_financials: target.perm_view_financials ?? false,
          perm_manage_payments: target.perm_manage_payments ?? false,
          perm_upload_results: target.perm_upload_results ?? false,
          perm_download_results: target.perm_download_results ?? false,
          perm_delete_results: target.perm_delete_results ?? false,
        });
    }
    setOpenDialog(true);
  };

  // ✅ Handle Checkbox change for permissions
  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({ ...prev, [name]: checked }));
  };

  // Handle Activation/Deactivation
  const handleToggleStatus = async (staffMember) => {
    const shouldSuspend = staffMember.is_verified; 
    try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const res = await fetch(`${API_URL}/api/admin/medical-staff/${staffMember.id}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ suspend: shouldSuspend })
        });
        if(res.ok) {
            setSuccess(`User ${shouldSuspend ? 'Deactivated' : 'Activated'}!`);
            fetchAllData();
        } else {
            setError('Failed to update status');
        }
    } catch(e) { setError('Connection error'); }
  };

  const handleConfirmAction = async () => {
    setIsActionLoading(true);
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    try {
      let url = '';
      let method = 'POST'; 
      let body = {};

      if (dialogAction === 'edit_staff') {
        url = `${API_URL}/api/admin/medical-staff/${selectedStaff.id}/details`;
        method = 'PATCH';
        body = { location_id: newLocationId, role: newRole };
      } else if (dialogAction === 'delete') {
        url = `${API_URL}/api/admin/medical-staff/${selectedStaff.id}`;
        method = 'DELETE';
      } else if (dialogAction === 'add_location') {
        url = `${API_URL}/api/locations`;
        body = locForm;
      } else if (dialogAction === 'add_modality') {
        url = `${API_URL}/api/modalities`;
        body = modForm;
      } else if (dialogAction === 'edit_permissions') {
        // ✅ Add the save route logic for permissions
        url = `${API_URL}/api/admin/medical-staff/${selectedStaff.id}/permissions`;
        method = 'PATCH';
        body = permissions;
      }

      const res = await fetch(url, { method, headers, body: method !== 'DELETE' ? JSON.stringify(body) : null });
      
      if (res.ok) {
        setSuccess('Action successful!');
        fetchAllData();
        setOpenDialog(false);
      } else {
        const data = await res.json();
        setError(data.message || 'Action failed.');
      }
    } catch (err) { setError('Connection error.'); }
    finally { setIsActionLoading(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>System Administration</Typography>
      
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Staff Management" />
        <Tab label="Locations (Labs)" />
        <Tab label="Modality (Machines)" />
      </Tabs>

      {/* TAB 0: STAFF MANAGEMENT */}
      {tabValue === 0 && (
        <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell fontWeight="bold">Name</TableCell>
                <TableCell>Branch (Location)</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Typography fontWeight="bold">{s.full_name}</Typography>
                    <Typography variant="caption">{s.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      icon={<BusinessIcon />} 
                      label={s.location_name || locations.find(l => l.id === s.location_id)?.name || 'Unassigned'} 
                      color={s.location_id ? "primary" : "default"}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{s.role.replace('_', ' ').toUpperCase()}</TableCell>
                  <TableCell>
                    {s.is_verified ? <Chip label="Active" color="success" size="small" /> : <Chip label="Inactive" color="error" size="small" />}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        
                        {/* ✅ NEW: Manage Permissions Button */}
                        <Tooltip title="Manage Permissions">
                            <IconButton onClick={() => handleOpenDialog('edit_permissions', s)} color="secondary">
                                <SecurityIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={s.is_verified ? "Deactivate User" : "Activate User"}>
                            <IconButton 
                                color={s.is_verified ? "warning" : "success"} 
                                onClick={() => handleToggleStatus(s)}
                            >
                                {s.is_verified ? <BlockIcon /> : <CheckCircleOutlineIcon />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit Role & Location">
                            <IconButton onClick={() => handleOpenDialog('edit_staff', s)} color="primary"><EditIcon /></IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete User">
                            <IconButton onClick={() => handleOpenDialog('delete', s)} color="error"><DeleteIcon /></IconButton>
                        </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 1: LOCATIONS */}
      {tabValue === 1 && (
        <Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('add_location')} sx={{ mb: 3 }}>
                Add New Branch
            </Button>
            <Grid container spacing={2}>
                {locations.map(loc => (
                    <Grid item xs={12} sm={4} key={loc.id}>
                        <Paper sx={{ p: 2, borderRadius: 2, borderLeft: loc.is_hq ? '5px solid gold' : '5px solid blue' }}>
                            <Typography variant="h6">{loc.name} {loc.is_hq && '⭐'}</Typography>
                            <Typography variant="body2" color="text.secondary">Code: {loc.location_code}</Typography>
                            <Typography variant="caption" display="block" color="text.secondary">{loc.address}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
      )}

      {/* TAB 2: MODALITIES */}
      {tabValue === 2 && (
        <Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('add_modality')} sx={{ mb: 3 }}>
                Add New Modality
            </Button>
            <Grid container spacing={2}>
                {modalities.map(mod => (
                    <Grid item xs={12} sm={3} key={mod.id}>
                        <Paper sx={{ p: 2, borderRadius: 2, textAlign: 'center', border: '1px solid #eee' }}>
                            <Typography variant="h6" color="primary">{mod.modality_name}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
      )}

      {/* DYNAMIC DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>
            {dialogAction === 'delete' ? 'Delete User?' : 
             dialogAction === 'add_location' ? 'Add New Location' :
             dialogAction === 'add_modality' ? 'Add New Modality' :
             dialogAction === 'edit_permissions' ? `Manage Permissions: ${selectedStaff?.full_name}` :
             'Update Staff Profile'}
        </DialogTitle>
        <DialogContent dividers>
            {/* 1. DELETE CONFIRMATION */}
            {dialogAction === 'delete' && (
                <DialogContentText color="error">
                    Are you sure you want to permanently delete <b>{selectedStaff?.full_name}</b>? This cannot be undone.
                </DialogContentText>
            )}

            {/* 2. EDIT STAFF FORM */}
            {dialogAction === 'edit_staff' && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel>Assign to Location</InputLabel>
                        <Select value={newLocationId} label="Assign to Location" onChange={(e) => setNewLocationId(e.target.value)}>
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name} {l.is_hq ? '(HQ)' : ''}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel>User Role</InputLabel>
                        <Select value={newRole} label="User Role" onChange={(e) => setNewRole(e.target.value)}>
                            <MenuItem value="medical_staff">Medical Staff</MenuItem>
                            <MenuItem value="doctor">Doctor</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="hq_staff">HQ Staff</MenuItem>
                            <MenuItem value="hq_financial_admin">HQ Financial Admin</MenuItem>
                            <MenuItem value="financial_admin">Financial Admin</MenuItem>
                            <MenuItem value="inventory_manager">Inventory Manager</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            )}

            {/* ✅ 3. EDIT PERMISSIONS FORM */}
            {dialogAction === 'edit_permissions' && (
                <Stack spacing={3}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>Patient Records</Typography>
                        <Grid container spacing={1}>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_add_patients} onChange={handlePermissionChange} name="perm_add_patients" />} label="Register Patients" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_edit_patients} onChange={handlePermissionChange} name="perm_edit_patients" />} label="Edit Details" />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_delete_patients} onChange={handlePermissionChange} name="perm_delete_patients" sx={{ color: 'error.main', '&.Mui-checked': { color: 'error.main' } }} />} label={<Typography color="error">Delete Patients (Danger)</Typography>} />
                            </Grid>
                        </Grid>
                    </Box>

                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>Billing & Finance</Typography>
                        <Grid container spacing={1}>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_view_financials} onChange={handlePermissionChange} name="perm_view_financials" />} label="View Prices/Totals" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_manage_payments} onChange={handlePermissionChange} name="perm_manage_payments" />} label="Approve Payments" />
                            </Grid>
                        </Grid>
                    </Box>

                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>Clinical Reports & Results</Typography>
                        <Grid container spacing={1}>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_upload_results} onChange={handlePermissionChange} name="perm_upload_results" />} label="Upload Reports" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_download_results} onChange={handlePermissionChange} name="perm_download_results" />} label="Download/View Results" />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel control={<Checkbox checked={permissions.perm_delete_results} onChange={handlePermissionChange} name="perm_delete_results" sx={{ color: 'error.main', '&.Mui-checked': { color: 'error.main' } }} />} label={<Typography color="error">Delete Results (Danger)</Typography>} />
                            </Grid>
                        </Grid>
                    </Box>
                </Stack>
            )}

            {/* 4. ADD LOCATION FORM */}
            {dialogAction === 'add_location' && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Branch Name" fullWidth value={locForm.name} onChange={(e) => setLocForm({...locForm, name: e.target.value})} />
                    <TextField label="Location Code (e.g. PH)" fullWidth value={locForm.location_code} onChange={(e) => setLocForm({...locForm, location_code: e.target.value.toUpperCase()})} />
                    <TextField label="Address" fullWidth multiline rows={2} value={locForm.address} onChange={(e) => setLocForm({...locForm, address: e.target.value})} />
                    <FormControlLabel control={<Checkbox checked={locForm.is_hq} onChange={(e) => setLocForm({...locForm, is_hq: e.target.checked})} />} label="Is this Headquarters?" />
                </Stack>
            )}

            {/* 5. ADD MODALITY FORM */}
            {dialogAction === 'add_modality' && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Modality Name (e.g. MRI, CT Scan)" fullWidth value={modForm.modality_name} onChange={(e) => setModForm({...modForm, modality_name: e.target.value})} />
                </Stack>
            )}

        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color={dialogAction === 'delete' ? 'error' : 'primary'}
            onClick={handleConfirmAction} 
            disabled={isActionLoading}
          >
            {isActionLoading ? <CircularProgress size={24} /> : (dialogAction === 'delete' ? 'Delete' : 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminPanelPage;