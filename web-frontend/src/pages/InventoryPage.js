// web-frontend/src/pages/InventoryPage.js
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Grid, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Tabs, Tab, Alert, Card, CardContent, Chip, Stack
} from '@mui/material';
import { Plus as AddIcon, Trash2 as DeleteIcon, Edit as EditIcon, BarChart3 as StatsIcon, Package as InventoryIcon, Clock as HistoryIcon, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../services/api';

const InventoryPage = () => {
  const [tabIndex, setTabIndex] = useState(0); // 0: Stock List, 1: Audit Movement Ledger, 2: Analytics
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  
  // Dialog States
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openTransactionDialog, setOpenTransactionDialog] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Form states for new item
  const [newItem, setNewItem] = useState({ item_name: '', category: '', sku: '', unit_of_measurement: '', reorder_level: 5, unit_price: '', quantity_in_stock: 0 });
  
  // Form state for editing item
  const [editItemData, setEditItemData] = useState({ id: '', item_name: '', category: '', sku: '', unit_of_measurement: '', reorder_level: 5, unit_price: '' });

  // Form states for stock movement / transaction
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
      const [itemsRes, movementsRes] = await Promise.all([
        api.get('/api/inventory'),
        api.get('/api/inventory/movements').catch(() => ({ data: [] })) // Fallback if movements endpoint is separate
      ]);
      setInventory(itemsRes.data || []);
      setMovements(movementsRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory data from server.');
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/inventory', newItem);
      setSuccess('Item added and initial movement logged successfully.');
      setOpenAddDialog(false);
      setNewItem({ item_name: '', category: '', sku: '', unit_of_measurement: '', reorder_level: 5, unit_price: '', quantity_in_stock: 0 });
      fetchInventoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add item');
    }
  };

  const handleOpenEdit = (item) => {
    setEditItemData(item);
    setOpenEditDialog(true);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/inventory/${editItemData.id}`, editItemData);
      setSuccess('Inventory item updated successfully.');
      setOpenEditDialog(false);
      fetchInventoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update item');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!isAdmin) {
      alert('Unauthorized: Only administrators or inventory managers can delete items.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
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
        quantity: Number(txnData.quantity),
        notes: txnData.notes
      });
      setSuccess('Stock transaction recorded and audited successfully.');
      setOpenTransactionDialog(false);
      setTxnData({ itemId: '', action_type: 'RESTOCK', quantity: 1, notes: '' });
      fetchInventoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process transaction');
    }
  };

  // Filtered Inventory Logic
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(inventory.map(i => i.category))];

  // Chart data calculation
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
          <Button variant="contained" color="secondary" onClick={() => setOpenTransactionDialog(true)} sx={{ mr: 2 }}>
            Log Movement / Restock
          </Button>
          {isAdmin && (
            <Button variant="contained" color="primary" onClick={() => setOpenAddDialog(true)}>
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
          <Tab icon={<HistoryIcon size={20} />} label={`Movement Audit Trail (${movements.length})`} />
          <Tab icon={<StatsIcon size={20} />} label="Stock Analytics" />
        </Tabs>
      </Paper>

      {/* TAB 0: Stock List Table with Search & Filters */}
      {tabIndex === 0 && (
        <>
          <Box display="flex" gap={2} mb={3} flexDirection={{ xs: 'column', sm: 'row' }}>
            <TextField
              label="Search items by name, category, or SKU..."
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

          <TableContainer component={Paper} elevation={3}>
            <Table>
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell><b>Item Name</b></TableCell>
                  <TableCell><b>Category</b></TableCell>
                  <TableCell><b>SKU / Code</b></TableCell>
                  <TableCell><b>In Stock</b></TableCell>
                  <TableCell><b>Min Level</b></TableCell>
                  <TableCell><b>Unit Price (₦)</b></TableCell>
                  <TableCell align="right"><b>Actions</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No inventory items match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item) => (
                    <TableRow key={item.id} sx={Number(item.quantity_in_stock) <= Number(item.reorder_level) ? { backgroundColor: 'rgba(211, 47, 47, 0.04)' } : {}}>
                      <TableCell sx={{ fontWeight: 'medium' }}>{item.item_name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.sku || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${item.quantity_in_stock} ${item.unit_of_measurement || 'units'}`} 
                          color={Number(item.quantity_in_stock) <= Number(item.reorder_level) ? 'error' : 'success'} 
                          size="small" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>{item.reorder_level}</TableCell>
                      <TableCell>₦{Number(item.unit_price || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <IconButton color="primary" size="small" onClick={() => handleOpenEdit(item)} title="Edit Item">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {isAdmin && (
                            <IconButton color="error" size="small" onClick={() => handleDeleteItem(item.id)} title="Delete Item">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* TAB 1: Movement Audit Trail Table */}
      {tabIndex === 1 && (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell><b>Timestamp</b></TableCell>
                <TableCell><b>Item Name</b></TableCell>
                <TableCell><b>Movement Type</b></TableCell>
                <TableCell><b>Quantity Shift</b></TableCell>
                <TableCell><b>Stock State</b></TableCell>
                <TableCell><b>Operator & Remarks</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No stock movement audit records found.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      <Typography variant="body2">{new Date(mov.created_at || mov.timestamp).toLocaleDateString()}</Typography>
                      <Typography variant="caption" color="textSecondary">{new Date(mov.created_at || mov.timestamp).toLocaleTimeString()}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{mov.item_name || 'Inventory Asset'}</TableCell>
                    <TableCell>
                      <Chip 
                        icon={mov.action_type === 'RESTOCK' || mov.movement_type === 'INBOUND_RECEIPT' ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>}
                        label={mov.action_type || mov.movement_type} 
                        color={mov.action_type === 'RESTOCK' || mov.movement_type === 'INBOUND_RECEIPT' ? 'success' : 'warning'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: (mov.action_type === 'RESTOCK' || mov.movement_type === 'INBOUND_RECEIPT') ? 'success.main' : 'error.main' }}>
                      {(mov.action_type === 'RESTOCK' || mov.movement_type === 'INBOUND_RECEIPT') ? `+${mov.quantity_changed || mov.quantity}` : `-${mov.quantity_changed || mov.quantity}`}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">Prev: {mov.previous_stock ?? 'N/A'} ➔ New: {mov.new_stock ?? 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{mov.notes || 'Routine update'}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 2: Analytics & Charts */}
      {tabIndex === 2 && (
        <Paper sx={{ p: 3 }} elevation={3}>
          <Typography variant="h6" gutterBottom>Stock Levels vs Minimum Safety Thresholds</Typography>
          <Box sx={{ width: '100%', height: 350, mt: 2 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Quantity" fill="#1976d2" name="Current Stock" />
                <Bar dataKey="MinRequired" fill="#d32f2f" name="Min Safety Level" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* Dialog: Add New Item */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Inventory Item</DialogTitle>
        <form onSubmit={handleCreateItem}>
          <DialogContent>
            <TextField fullWidth label="Item Name" margin="normal" required value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} />
            <TextField fullWidth label="Category" margin="normal" required placeholder="e.g. Consumables, Spare Parts" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
            <TextField fullWidth label="SKU / Code" margin="normal" value={newItem.sku} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} />
            <TextField fullWidth label="Unit of Measurement (e.g. pcs, litres)" margin="normal" value={newItem.unit_of_measurement} onChange={(e) => setNewItem({ ...newItem, unit_of_measurement: e.target.value })} />
            <TextField fullWidth label="Initial Stock Quantity" type="number" margin="normal" inputProps={{ min: 0 }} value={newItem.quantity_in_stock} onChange={(e) => setNewItem({ ...newItem, quantity_in_stock: Number(e.target.value) })} />
            <TextField fullWidth label="Unit Price (₦)" type="number" margin="normal" inputProps={{ min: 0, step: 0.01 }} value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
            <TextField fullWidth label="Min Safety Stock Level" type="number" margin="normal" inputProps={{ min: 0 }} value={newItem.reorder_level} onChange={(e) => setNewItem({ ...newItem, reorder_level: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save Item</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Edit Inventory Item */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Item: {editItemData.item_name}</DialogTitle>
        <form onSubmit={handleUpdateItem}>
          <DialogContent>
            <TextField fullWidth label="Item Name" margin="normal" required value={editItemData.item_name} onChange={(e) => setEditItemData({ ...editItemData, item_name: e.target.value })} />
            <TextField fullWidth label="Category" margin="normal" required value={editItemData.category} onChange={(e) => setEditItemData({ ...editItemData, category: e.target.value })} />
            <TextField fullWidth label="SKU / Code" margin="normal" value={editItemData.sku || ''} onChange={(e) => setEditItemData({ ...editItemData, sku: e.target.value })} />
            <TextField fullWidth label="Unit of Measurement" margin="normal" value={editItemData.unit_of_measurement || ''} onChange={(e) => setEditItemData({ ...editItemData, unit_of_measurement: e.target.value })} />
            <TextField fullWidth label="Unit Price (₦)" type="number" margin="normal" inputProps={{ min: 0, step: 0.01 }} value={editItemData.unit_price || ''} onChange={(e) => setEditItemData({ ...editItemData, unit_price: e.target.value })} />
            <TextField fullWidth label="Min Safety Stock Level" type="number" margin="normal" inputProps={{ min: 0 }} value={editItemData.reorder_level || 5} onChange={(e) => setEditItemData({ ...editItemData, reorder_level: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">Save Changes</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog: Log Inbound / Outbound Transaction */}
      <Dialog open={openTransactionDialog} onClose={() => setOpenTransactionDialog(false)} maxWidth="sm" fullWidth>
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
                <MenuItem value="RESTOCK">Inbound Restock (+)</MenuItem>
                <MenuItem value="DISPENSE">Outbound Dispense / Usage (-)</MenuItem>
              </Select>
            </FormControl>

            <TextField fullWidth label="Quantity Change" type="number" margin="normal" inputProps={{ min: 1 }} required value={txnData.quantity} onChange={(e) => setTxnData({ ...txnData, quantity: e.target.value })} />
            <TextField fullWidth label="Notes / Reason / PO Number" multiline rows={2} margin="normal" value={txnData.notes} onChange={(e) => setTxnData({ ...txnData, notes: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTransactionDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="secondary">Confirm Movement</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default InventoryPage;