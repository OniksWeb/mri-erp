// web-frontend/src/pages/InventoryPage.js
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Tabs, Tab, Alert, Card, CardContent
} from '@mui/material';
// To this:
import { Plus as AddIcon, Trash2 as DeleteIcon, ArrowLeftRight as TransferIcon, BarChart3 as StatsIcon, Calendar as CalendarIcon, Package as InventoryIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../services/api';

const InventoryPage = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, totalValue: 0 });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openTransactionDialog, setOpenTransactionDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states for new item
  const [newItem, setNewItem] = useState({ name: '', category: '', quantity: '', unitPrice: '', minStockLevel: 5 });

  // Form states for stock movement (OUT/IN)
  const [txnData, setTxnData] = useState({
    itemId: '', type: 'OUT_LAB', quantity: 1, recipientType: 'INTERNAL_LAB',
    recipientName: '', contactInfo: '', scheduledDate: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      const res = await api.get('/inventory');
      setInventory(res.data.items || []);
      setTransactions(res.data.transactions || []);
      setStats(res.data.stats || { totalItems: 0, lowStock: 0, totalValue: 0 });
    } catch (err) {
      console.error('Error fetching inventory:', err);
      // Fallback mock states if endpoint is still syncing
      setInventory([
        { id: 1, name: 'MRI Cooling Cryogen', category: 'Chemicals', quantity: 12, unitPrice: 150000, minStockLevel: 3 },
        { id: 2, name: 'RF Shielding Gasket', category: 'Hardware', quantity: 4, unitPrice: 45000, minStockLevel: 5 }
      ]);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', newItem);
      setSuccess('Item added successfully');
      setOpenAddDialog(false);
      setNewItem({ name: '', category: '', quantity: '', unitPrice: '', minStockLevel: 5 });
      fetchInventoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add item');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!isAdmin) {
      alert('Unauthorized: Only administrators can delete inventory items.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await api.delete(`/inventory/${id}`);
        setSuccess('Item deleted successfully');
        fetchInventoryData();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete item');
      }
    }
  };

  const handleRecordTransaction = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/transaction', txnData);
      setSuccess('Stock transaction recorded & scheduled successfully');
      setOpenTransactionDialog(false);
      setTxnData({ itemId: '', type: 'OUT_LAB', quantity: 1, recipientType: 'INTERNAL_LAB', recipientName: '', contactInfo: '', scheduledDate: '' });
      fetchInventoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log transaction');
    }
  };

  // Chart data calculation
  const chartData = inventory.map(item => ({
    name: item.name,
    Quantity: item.quantity,
    MinRequired: item.minStockLevel
  }));

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">📦 G2G Medical Inventory & Logistics</Typography>
        <Box>
          <Button variant="contained" color="primary" startAdd={<AddIcon />} onClick={() => setOpenTransactionDialog(true)} sx={{ mr: 2 }}>
            Log Movement / Schedule
          </Button>
          {isAdmin && (
            <Button variant="outlined" color="primary" onClick={() => setOpenAddDialog(true)}>
              + Add New Item
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Summary KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography color="textSecondary" gutterNumber>Total Catalog Items</Typography>
              <Typography variant="h4" fontWeight="bold">{inventory.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #d32f2f' }}>
            <CardContent>
              <Typography color="textSecondary" gutterNumber>Low Stock Alerts</Typography>
              <Typography variant="h4" fontWeight="bold" color="error">
                {inventory.filter(i => i.quantity <= i.minStockLevel).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #2e7d32' }}>
            <CardContent>
              <Typography color="textSecondary" gutterNumber>Estimated Stock Value</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                ₦{inventory.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Layout */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} indicatorColor="primary" textColor="primary" centered>
          <Tab icon={<InventoryIcon size={20} />} label="Store Stock List" />
          <Tab icon={<StatsIcon size={20} />} label="Movement Analytics" />
          <Tab icon={<CalendarIcon size={20} />} label="Schedule & Deliveries" />
        </Tabs>
      </Paper>

      {/* TAB 0: Stock List Table */}
      {tabIndex === 0 && (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell><b>Item Name</b></TableCell>
                <TableCell><b>Category</b></TableCell>
                <TableCell><b>In Stock</b></TableCell>
                <TableCell><b>Min Level</b></TableCell>
                <TableCell><b>Unit Price (₦)</b></TableCell>
                <TableCell align="right"><b>Actions</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.id} sx={item.quantity <= item.minStockLevel ? { backgroundColor: 'rgba(211, 47, 47, 0.04)' } : {}}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell fontWeight="bold">{item.quantity}</TableCell>
                  <TableCell>{item.minStockLevel}</TableCell>
                  <TableCell>₦{Number(item.unitPrice).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {isAdmin && (
                      <IconButton color="error" onClick={() => handleDeleteItem(item.id)} title="Delete Item (Admin Only)">
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 1: Analytics & Charts */}
      {tabIndex === 1 && (
        <Paper sx={{ p: 3 }} elevation={3}>
          <Typography variant="h6" gutterBottom>Stock Levels vs Minimum Safety Thresholds</Typography>
          <Box sx={{ width: '100%', height: 350, mt: 2 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Quantity" fill="#1976d2" />
                <Bar dataKey="MinRequired" fill="#d32f2f" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* TAB 2: Schedule & Delivery Calendar Logs */}
      {tabIndex === 2 && (
        <Paper sx={{ p: 3 }} elevation={3}>
          <Typography variant="h6" gutterBottom>📅 Scheduled Transfers & Customer Deliveries</Typography>
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell><b>Scheduled Date</b></TableCell>
                  <TableCell><b>Movement Type</b></TableCell>
                  <TableCell><b>Recipient / Customer</b></TableCell>
                  <TableCell><b>Contact Info</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.filter(t => t.scheduledDate).map((txn, index) => (
                  <TableRow key={index}>
                    <TableCell>{new Date(txn.scheduledDate).toLocaleDateString()}</TableCell>
                    <TableCell>{txn.type}</TableCell>
                    <TableCell>{txn.recipientName}</TableCell>
                    <TableCell>{txn.contactInfo || 'N/A'}</TableCell>
                    <TableCell>{txn.status || 'PENDING'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog: Add New Item */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add New Inventory Item</DialogTitle>
        <form onSubmit={handleCreateItem}>
          <DialogContent>
            <TextField fullWidth label="Item Name" margin="normal" required value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            <TextField fullWidth label="Category" margin="normal" required value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
            <TextField fullWidth label="Initial Quantity" type="number" margin="normal" required value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
            <TextField fullWidth label="Unit Price (₦)" type="number" margin="normal" required value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })} />
            <TextField fullWidth label="Min Safety Stock Level" type="number" margin="normal" value={newItem.minStockLevel} onChange={(e) => setNewItem({ ...newItem, minStockLevel: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save Item</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Log Outbound/Inbound & Schedule */}
      <Dialog open={openTransactionDialog} onClose={() => setOpenTransactionDialog(false)}>
        <DialogTitle>Log Material Movement & Delivery Schedule</DialogTitle>
        <form onSubmit={handleRecordTransaction}>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Item</InputLabel>
              <Select value={txnData.itemId} label="Select Item" required onChange={(e) => setTxnData({ ...txnData, itemId: e.target.value })}>
                {inventory.map(i => (<MenuItem key={i.id} value={i.id}>{i.name} (Avail: {i.quantity})</MenuItem>))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Movement Action</InputLabel>
              <Select value={txnData.type} label="Movement Action" onChange={(e) => setTxnData({ ...txnData, type: e.target.value })}>
                <MenuItem value="OUT_LAB">Transfer Out to Internal Lab</MenuItem>
                <MenuItem value="OUT_CUSTOMER">Dispatch to External Customer</MenuItem>
                <MenuItem value="IN">Inbound Restock</MenuItem>
              </Select>
            </FormControl>

            <TextField fullWidth label="Quantity" type="number" margin="normal" required value={txnData.quantity} onChange={(e) => setTxnData({ ...txnData, quantity: e.target.value })} />
            <TextField fullWidth label="Recipient Name (Lab Branch / Customer)" margin="normal" required value={txnData.recipientName} onChange={(e) => setTxnData({ ...txnData, recipientName: e.target.value })} />
            <TextField fullWidth label="Recipient Contact / Address" margin="normal" value={txnData.contactInfo} onChange={(e) => setTxnData({ ...txnData, contactInfo: e.target.value })} />
            
            <TextField
              fullWidth
              label="Schedule Delivery / Arrival Date"
              type="date"
              margin="normal"
              InputLabelProps={{ shrink: true }}
              value={txnData.scheduledDate}
              onChange={(e) => setTxnData({ ...txnData, scheduledDate: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTransactionDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Confirm & Schedule</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default InventoryPage;