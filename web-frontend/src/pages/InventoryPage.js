// web-frontend/src/pages/InventoryPage.js
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Tabs, Tab, Alert, Card, CardContent
} from '@mui/material';
import { Plus as AddIcon, Trash2 as DeleteIcon, ArrowLeftRight as TransferIcon, BarChart3 as StatsIcon, Calendar as CalendarIcon, Package as InventoryIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../services/api';

const InventoryPage = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openTransactionDialog, setOpenTransactionDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states for new item (matching backend columns)
  const [newItem, setNewItem] = useState({ item_name: '', category: '', sku: '', unit_of_measurement: '', reorder_level: 5, unit_price: '' });

  // Form states for stock movement
  const [txnData, setTxnData] = useState({
    itemId: '', action_type: 'RESTOCK', quantity: 1, notes: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin' || user?.role === 'inventory_manager';

  useEffect(() => {
      fetchInventoryData();
    }, []);

    const fetchInventoryData = async () => {
      try {
        const res = await api.get('/api/inventory');
        setInventory(res.data || []);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setError('Failed to load inventory from server.');
      }
    };

    const handleCreateItem = async (e) => {
      e.preventDefault();
      try {
        await api.post('/api/inventory', newItem);
        setSuccess('Item added successfully');
        setOpenAddDialog(false);
        setNewItem({ item_name: '', category: '', sku: '', unit_of_measurement: '', reorder_level: 5, unit_price: '' });
        fetchInventoryData();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to add item');
      }
    };

    const handleDeleteItem = async (id) => {
      if (!isAdmin) {
        alert('Unauthorized: Only administrators or inventory managers can delete items.');
        return;
      }
      if (window.confirm('Are you sure you want to delete this inventory item?')) {
        try {
          // ✅ FIXED: Added back the /api prefix to match all other routes
          await api.delete(`/api/inventory/${id}`);
          setSuccess('Item deleted successfully.');
          fetchInventoryData();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete item');
        }
      }
    };

    const handleRecordTransaction = async (e) => {
      e.preventDefault();
      try {
        await api.post(`/api/inventory/${txnData.itemId}/transaction`, {
          action_type: txnData.action_type,
          quantity: txnData.quantity,
          notes: txnData.notes
        });
        setSuccess('Stock transaction recorded successfully');
        setOpenTransactionDialog(false);
        setTxnData({ itemId: '', action_type: 'RESTOCK', quantity: 1, notes: '' });
        fetchInventoryData();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to process transaction');
      }
    };

  // Chart data calculation using PostgreSQL property names
  const chartData = inventory.map(item => ({
    name: item.item_name,
    Quantity: Number(item.quantity_in_stock || 0),
    MinRequired: Number(item.reorder_level || 5)
  }));

  const totalValue = inventory.reduce((acc, curr) => acc + (Number(curr.quantity_in_stock || 0) * Number(curr.unit_price || 0)), 0);
  const lowStockCount = inventory.filter(i => Number(i.quantity_in_stock || 0) <= Number(i.reorder_level || 5)).length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">📦 G2G Medical Inventory & Logistics</Typography>
        <Box>
          <Button variant="contained" color="primary" onClick={() => setOpenTransactionDialog(true)} sx={{ mr: 2 }}>
            Log Movement / Restock
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
              <Typography color="textSecondary">Total Catalog Items</Typography>
              <Typography variant="h4" fontWeight="bold">{inventory.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #d32f2f' }}>
            <CardContent>
              <Typography color="textSecondary">Low Stock Alerts</Typography>
              <Typography variant="h4" fontWeight="bold" color="error">
                {lowStockCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={3} sx={{ borderLeft: '6px solid #2e7d32' }}>
            <CardContent>
              <Typography color="textSecondary">Estimated Stock Value</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                ₦{totalValue.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Layout */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} indicatorColor="primary" textColor="primary" centered>
          <Tab icon={<InventoryIcon size={20} />} label="Store Stock List" />
          <Tab icon={<StatsIcon size={20} />} label="Stock Analytics" />
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
                <TableCell><b>Branch</b></TableCell>
                <TableCell><b>In Stock</b></TableCell>
                <TableCell><b>Min Level</b></TableCell>
                <TableCell><b>Unit Price (₦)</b></TableCell>
                <TableCell align="right"><b>Actions</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.id} sx={Number(item.quantity_in_stock) <= Number(item.reorder_level) ? { backgroundColor: 'rgba(211, 47, 47, 0.04)' } : {}}>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.branch_name || 'HQ / General'}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.quantity_in_stock}</TableCell>
                  <TableCell>{item.reorder_level}</TableCell>
                  <TableCell>₦{Number(item.unit_price || 0).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {isAdmin && (
                      <IconButton color="error" onClick={() => handleDeleteItem(item.id)} title="Delete Item">
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

      {/* Dialog: Add New Item */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add New Inventory Item</DialogTitle>
        <form onSubmit={handleCreateItem}>
          <DialogContent>
            <TextField fullWidth label="Item Name" margin="normal" required value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} />
            <TextField fullWidth label="Category" margin="normal" required value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
            <TextField fullWidth label="SKU / Code" margin="normal" value={newItem.sku} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} />
            <TextField fullWidth label="Unit of Measurement (e.g. pcs, litres)" margin="normal" value={newItem.unit_of_measurement} onChange={(e) => setNewItem({ ...newItem, unit_of_measurement: e.target.value })} />
            <TextField fullWidth label="Unit Price (₦)" type="number" margin="normal" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
            <TextField fullWidth label="Min Safety Stock Level" type="number" margin="normal" value={newItem.reorder_level} onChange={(e) => setNewItem({ ...newItem, reorder_level: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save Item</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Log Inbound / Outbound Transaction */}
      <Dialog open={openTransactionDialog} onClose={() => setOpenTransactionDialog(false)}>
        <DialogTitle>Process Stock Movement</DialogTitle>
        <form onSubmit={handleRecordTransaction}>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Item</InputLabel>
              <Select value={txnData.itemId} label="Select Item" required onChange={(e) => setTxnData({ ...txnData, itemId: e.target.value })}>
                {inventory.map(i => (<MenuItem key={i.id} value={i.id}>{i.item_name} (Avail: {i.quantity_in_stock})</MenuItem>))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Action Type</InputLabel>
              <Select value={txnData.action_type} label="Action Type" onChange={(e) => setTxnData({ ...txnData, action_type: e.target.value })}>
                <MenuItem value="RESTOCK">Inbound Restock</MenuItem>
                <MenuItem value="DISPENSE">Outbound Dispense / Usage</MenuItem>
              </Select>
            </FormControl>

            <TextField fullWidth label="Quantity Change" type="number" margin="normal" required value={txnData.quantity} onChange={(e) => setTxnData({ ...txnData, quantity: e.target.value })} />
            <TextField fullWidth label="Notes / Reason" margin="normal" value={txnData.notes} onChange={(e) => setTxnData({ ...txnData, notes: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTransactionDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Confirm Movement</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default InventoryPage;