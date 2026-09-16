// web-frontend/src/pages/StorePage.js
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Tabs, Tab, Alert, Card, CardContent, Chip
} from '@mui/material';
import { Package as StoreIcon, Clock as ClockIcon, Plus as AddIcon, ArrowUpRight as CheckoutIcon, ArrowDownLeft as ReturnIcon } from 'lucide-react';
import api from '../services/api';

const StorePage = () => {
  const [tabIndex, setTabIndex] = useState(0); // 0: Store Inventory, 1: Custody Logs
  const [storeItems, setStoreItems] = useState([]);
  const [storeLogs, setStoreLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Dialog States
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openCheckoutModal, setOpenCheckoutModal] = useState(false);
  const [openReturnModal, setOpenReturnModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);

  // Form States
  const [newItem, setNewItem] = useState({ item_name: '', category: '', serial_number: '', total_units: 1 });
  const [checkoutData, setCheckoutData] = useState({ borrower_name: '', borrower_id_or_staff: '', checkout_condition: '', notes: '' });
  const [returnData, setReturnData] = useState({ return_condition: '', notes: '' });

  useEffect(() => {
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    try {
      const [itemsRes, logsRes] = await Promise.all([
        api.get('/api/store/items'),
        api.get('/api/store/logs')
      ]);
      setStoreItems(itemsRes.data || []);
      setStoreLogs(logsRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching store data:', err);
      setError('Failed to load store inventory from server.');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/items', newItem);
      setSuccess('Store equipment added successfully.');
      setOpenAddModal(false);
      setNewItem({ item_name: '', category: '', serial_number: '', total_units: 1 });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add store item.');
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/checkout', {
        store_item_id: selectedItem.id,
        ...checkoutData
      });
      setSuccess('Item checked out / rented successfully.');
      setOpenCheckoutModal(false);
      setCheckoutData({ borrower_name: '', borrower_id_or_staff: '', checkout_condition: '', notes: '' });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed.');
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/store/return', {
        log_id: selectedLogId,
        ...returnData
      });
      setSuccess('Item returned successfully with condition review logged.');
      setOpenReturnModal(false);
      setReturnData({ return_condition: '', notes: '' });
      fetchStoreData();
    } catch (err) {
      setError(err.response?.data?.message || 'Return process failed.');
    }
  };

  // Filter and search logic
  const filteredItems = storeItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.serial_number && item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(storeItems.map(i => i.category))];
  const activeCheckoutsCount = storeLogs.filter(l => l.status === 'CHECKED_OUT').length;
  const totalStoreUnits = storeItems.reduce((acc, curr) => acc + Number(curr.total_units || 0), 0);
  const availableStoreUnits = storeItems.reduce((acc, curr) => acc + Number(curr.available_units || 0), 0);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">🏢 G2G Medical Store & Equipment Custody</Typography>
        <Box>
          <Button variant="contained" color="primary" onClick={() => setOpenAddModal(true)}>
            + Add Store Equipment
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Summary KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography color="textSecondary">Total Asset Types</Typography>
              <Typography variant="h4" fontWeight="bold">{storeItems.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #2e7d32' }}>
            <CardContent>
              <Typography color="textSecondary">Available Units / Total</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {availableStoreUnits} / {totalStoreUnits}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #ed6c02' }}>
            <CardContent>
              <Typography color="textSecondary">Active Checkouts / Loans</Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {activeCheckoutsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Layout */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} indicatorColor="primary" textColor="primary" centered>
          <Tab icon={<StoreIcon size={20} />} label="Store Equipment Inventory" />
          <Tab icon={<ClockIcon size={20} />} label={`Custody & Rental Logs (${activeCheckoutsCount} Active)`} />
        </Tabs>
      </Paper>

      {/* Common Search & Filter Toolbar */}
      {tabIndex === 0 && (
        <Box display="flex" gap={2} mb={3} flexDirection={{ xs: 'column', sm: 'row' }}>
          <TextField
            label="Search by equipment name or serial number..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1, backgroundColor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ minWidth: 200, backgroundColor: 'background.paper' }}>
            <InputLabel>Filter Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Filter Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat, idx) => (
                <MenuItem key={idx} value={cat}>{cat.toUpperCase()}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* TAB 0: Store Equipment Inventory Table */}
      {tabIndex === 0 && (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell><b>Equipment Name</b></TableCell>
                <TableCell><b>Category</b></TableCell>
                <TableCell><b>Serial Number</b></TableCell>
                <TableCell><b>Availability Status</b></TableCell>
                <TableCell align="right"><b>Actions</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No store items found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell sx={{ fontWeight: 'medium' }}>{item.item_name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.serial_number || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={`${item.available_units} / ${item.total_units} Available`} 
                        color={item.available_units > 0 ? 'success' : 'error'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        color="warning"
                        disabled={item.available_units <= 0}
                        onClick={() => { setSelectedItem(item); setOpenCheckoutModal(true); }}
                      >
                        Check Out / Rent
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 1: Custody Logs Table */}
      {tabIndex === 1 && (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell><b>Equipment</b></TableCell>
                <TableCell><b>Borrower / Staff</b></TableCell>
                <TableCell><b>Checkout Condition</b></TableCell>
                <TableCell><b>Return Condition</b></TableCell>
                <TableCell><b>Status</b></TableCell>
                <TableCell align="right"><b>Action</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {storeLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No custody history logs found.
                  </TableCell>
                </TableRow>
              ) : (
                storeLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.item_name}
                      <Typography variant="caption" display="block" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                        {log.serial_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {log.borrower_name}
                      <Typography variant="caption" display="block" color="textSecondary">
                        {log.borrower_id_or_staff}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.checkout_condition || 'No review logged'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.return_condition || 'Pending return'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.status} 
                        color={log.status === 'CHECKED_OUT' ? 'primary' : 'success'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="right">
                      {log.status === 'CHECKED_OUT' && (
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          onClick={() => { setSelectedLogId(log.id); setOpenReturnModal(true); }}
                        >
                          Process Return
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog: Add Store Equipment */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Physical Store Tool / Equipment</DialogTitle>
        <form onSubmit={handleAddItem}>
          <DialogContent>
            <TextField fullWidth label="Equipment Name" margin="normal" required value={newItem.item_name} onChange={e => setNewItem({...newItem, item_name: e.target.value})} />
            <TextField fullWidth label="Category" margin="normal" required placeholder="e.g., Radiology Tools, IT Hardware" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} />
            <TextField fullWidth label="Serial Number / Asset Tag" margin="normal" value={newItem.serial_number} onChange={e => setNewItem({...newItem, serial_number: e.target.value})} />
            <TextField fullWidth label="Total Units" type="number" margin="normal" inputProps={{ min: 1 }} required value={newItem.total_units} onChange={e => setNewItem({...newItem, total_units: parseInt(e.target.value)})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save Equipment</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Checkout / Rent Equipment */}
      <Dialog open={openCheckoutModal} onClose={() => setOpenCheckoutModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Check Out: {selectedItem?.item_name}</DialogTitle>
        <form onSubmit={handleCheckout}>
          <DialogContent>
            <TextField fullWidth label="Borrower / Staff Name" margin="normal" required value={checkoutData.borrower_name} onChange={e => setCheckoutData({...checkoutData, borrower_name: e.target.value})} />
            <TextField fullWidth label="Staff ID / Department" margin="normal" value={checkoutData.borrower_id_or_staff} onChange={e => setCheckoutData({...checkoutData, borrower_id_or_staff: e.target.value})} />
            <TextField fullWidth label="Initial Condition Review Notes" multiline rows={3} margin="normal" required placeholder="e.g., Pristine condition, includes power cable..." value={checkoutData.checkout_condition} onChange={e => setCheckoutData({...checkoutData, checkout_condition: e.target.value})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCheckoutModal(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning">Confirm Checkout</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Process Return */}
      <Dialog open={openReturnModal} onClose={() => setOpenReturnModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Process Equipment Return</DialogTitle>
        <form onSubmit={handleReturn}>
          <DialogContent>
            <TextField fullWidth label="Return Condition Review Notes" multiline rows={3} margin="normal" required placeholder="e.g., Returned fully functional, normal wear..." value={returnData.return_condition} onChange={e => setReturnData({...returnData, return_condition: e.target.value})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenReturnModal(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="success">Complete Return</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default StorePage;