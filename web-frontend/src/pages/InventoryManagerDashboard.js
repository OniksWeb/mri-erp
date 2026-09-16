import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CountUp from 'react-countup';
import { useTheme } from '@mui/material/styles';
import api from '../services/api';

// Material-UI components
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress, Alert,
  Button, TextField, FormControl, List, ListItem, ListItemIcon, ListItemText, Divider, 
  InputLabel, Select, MenuItem, Chip, Stack, Avatar, Tabs, Tab
} from '@mui/material';

// Icons
import InventoryIcon from '@mui/icons-material/Inventory';
import StoreIcon from '@mui/icons-material/Store';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import SearchIcon from '@mui/icons-material/Search';

// Recharts (Interactive Charts)
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, BarChart, Bar
} from 'recharts';

import Layout from '../components/Layout';

// --- Configuration ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

export default function InventoryManagerDashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const isInventoryAdmin = user?.role === 'inventory_admin';

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = Inbound, 1 = Physical Store

  // Analytics & List Data
  const [inventoryItems, setInventoryItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);

  // Search & Filter States
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('ALL');

  // --- Fetch Dashboard Data ---
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (isInventoryAdmin) {
        const invRes = await api.get('/api/inventory');
        setInventoryItems(Array.isArray(invRes.data) ? invRes.data : (invRes.data.rows || invRes.data.data || []));
      } else {
        const [invRes, storeRes] = await Promise.all([
          api.get('/api/inventory'),
          api.get('/api/store/items')
        ]);
        setInventoryItems(Array.isArray(invRes.data) ? invRes.data : (invRes.data.rows || invRes.data.data || []));
        setStoreItems(Array.isArray(storeRes.data) ? storeRes.data : (storeRes.data.rows || storeRes.data.data || []));
      }
    } catch (err) {
      console.error('Error loading inventory dashboard data:', err);
      setError('Failed to load dashboard data. Check connection.');
    } finally {
      setLoading(false);
    }
  }, [isInventoryAdmin]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // --- Analytics Calculations for Charts ---
  const categoryChartData = Object.values(
    inventoryItems.reduce((acc, item) => {
      const cat = item.category || 'General';
      if (!acc[cat]) acc[cat] = { name: cat, count: 0 };
      acc[cat].count += Number(item.in_stock || item.available_units || 1);
      return acc;
    }, {})
  );

  const storeCategoryChartData = !isInventoryAdmin ? Object.values(
    storeItems.reduce((acc, item) => {
      const cat = item.category || 'General';
      if (!acc[cat]) acc[cat] = { name: cat, count: 0 };
      acc[cat].count += Number(item.available_units || 1);
      return acc;
    }, {})
  ) : [];

  // --- Filtering Logic ---
  const filteredInventory = inventoryItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                          item.category?.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredStore = !isInventoryAdmin ? storeItems.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
                          item.serial_number?.toLowerCase().includes(storeSearch.toLowerCase());
    const matchesCategory = storeCategoryFilter === 'ALL' || item.category === storeCategoryFilter;
    return matchesSearch && matchesCategory;
  }) : [];

  const inboundCategories = ['ALL', ...new Set(inventoryItems.map(i => i.category || 'General'))];
  const storeCategories = !isInventoryAdmin ? ['ALL', ...new Set(storeItems.map(i => i.category || 'General'))] : [];

  const lowStockCount = inventoryItems.filter(i => (i.in_stock || i.available_units || 0) <= (i.min_level || 5)).length;

  // --- Reusable Stat Card Component ---
  const StatCard = ({ title, value, icon, color, subColor }) => (
    <Card sx={{ height: '100%', borderRadius: 4, bgcolor: 'background.paper', boxShadow: 3, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
            <Typography variant="h4" fontWeight="800" sx={{ mt: 1, color: 'text.primary' }}>
               {typeof value === 'number' ? <CountUp end={value} separator="," /> : value}
            </Typography>
          </Box>
          <Avatar sx={{ 
            bgcolor: theme.palette.mode === 'dark' ? `${color}40` : subColor, 
            color: color, width: 64, height: 64, borderRadius: 3 
          }}>
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );

  if (loading) return <Layout><Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box></Layout>;

  return (
    <Layout>
      <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
        
        {/* HEADER & TABS SWITCHER */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" color="primary">
              {isInventoryAdmin ? 'Inventory Admin Control Center' : 'Inventory Manager Command Center'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isInventoryAdmin 
                ? 'Overseeing inbound logistics, stock levels, and consumable inventory items.' 
                : 'Real-time telemetry, inbound stock analytics, and physical store custody tracking.'}
            </Typography>
          </Box>

          {!isInventoryAdmin && (
            <Tabs 
              value={activeTab} 
              onChange={(e, val) => setActiveTab(val)} 
              sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 0.5, boxShadow: 1 }}
            >
              <Tab label={`Inbound Inventory (${inventoryItems.length})`} />
              <Tab label={`Physical Store (${storeItems.length})`} />
            </Tabs>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* 1. STATS CARDS */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={isInventoryAdmin ? 6 : 4} md={isInventoryAdmin ? 6 : 4}>
            <StatCard 
              title="Total Inbound Items" 
              value={inventoryItems.length} 
              icon={<InventoryIcon fontSize="large"/>} 
              color="#1976d2" 
              subColor="#e3f2fd" 
            />
          </Grid>

          {!isInventoryAdmin && (
            <Grid item xs={12} sm={4} md={4}>
              <StatCard 
                title="Tracked Store Assets" 
                value={storeItems.length} 
                icon={<StoreIcon fontSize="large"/>} 
                color="#2e7d32" 
                subColor="#e8f5e9" 
              />
            </Grid>
          )}

          <Grid item xs={12} sm={isInventoryAdmin ? 6 : 4} md={isInventoryAdmin ? 6 : 4}>
            <StatCard 
              title="Low Stock / Attention" 
              value={lowStockCount} 
              icon={<WarningAmberIcon fontSize="large"/>} 
              color="#ed6c02" 
              subColor="#fff3e0" 
            />
          </Grid>
        </Grid>

        {/* 2. CHARTS SECTION */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 4, height: 400, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <CategoryIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">Stock Distribution by Category</Typography>
              </Stack>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} />
                  <YAxis axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 12, border: 'none', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" name="Stock Count" fill="#1976d2" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 4, height: 400, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <TrendingUpIcon color="success" />
                <Typography variant="h6" fontWeight="bold">Inventory Volume Overview</Typography>
              </Stack>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={categoryChartData}>
                  <defs>
                    <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} />
                  <YAxis axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 12, border: 'none', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="count" stroke="#2e7d32" fillOpacity={1} fill="url(#colorInventory)" />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* 3. DATA TABLES SECTION (Based on Role or Active Tab) */}
        {(isInventoryAdmin || activeTab === 0) && (
          <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'background.paper', boxShadow: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" fontWeight="bold">Inbound Inventory Items</Typography>
              <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TextField 
                  size="small"
                  placeholder="Search item or category..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  InputProps={{ startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> }}
                  sx={{ minWidth: 240 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Category</InputLabel>
                  <Select value={inventoryCategoryFilter} label="Category" onChange={(e) => setInventoryCategoryFilter(e.target.value)}>
                    {inboundCategories.map((cat, idx) => <MenuItem key={idx} value={cat}>{cat.toUpperCase()}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <List sx={{ width: '100%', p: 0 }}>
                {filteredInventory.length > 0 ? filteredInventory.map((item, i) => (
                  <React.Fragment key={item.id || i}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemIcon><InventoryIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary={<Typography fontWeight="bold" color="text.primary">{item.item_name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{`Category: ${item.category || 'General'} • Location: ${item.branch || 'HQ / General'}`}</Typography>}
                      />
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                          <Typography variant="body2" color="text.secondary">Min Level: {item.min_level || 5}</Typography>
                        </Box>
                        <Chip 
                          label={`Stock: ${item.in_stock || 0}`} 
                          color={(item.in_stock || 0) <= (item.min_level || 5) ? 'warning' : 'success'} 
                          variant="outlined" 
                        />
                      </Stack>
                    </ListItem>
                    {i < filteredInventory.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                )) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No inbound inventory records match your search.</Typography>
                )}
              </List>
            </Box>
          </Paper>
        )}

        {!isInventoryAdmin && activeTab === 1 && (
          <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'background.paper', boxShadow: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" fontWeight="bold">Physical Store Assets</Typography>
              <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TextField 
                  size="small"
                  placeholder="Search equipment or serial..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  InputProps={{ startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> }}
                  sx={{ minWidth: 240 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Category</InputLabel>
                  <Select value={storeCategoryFilter} label="Category" onChange={(e) => setStoreCategoryFilter(e.target.value)}>
                    {storeCategories.map((cat, idx) => <MenuItem key={idx} value={cat}>{cat.toUpperCase()}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <List sx={{ width: '100%', p: 0 }}>
                {filteredStore.length > 0 ? filteredStore.map((item, i) => (
                  <React.Fragment key={item.id || i}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemIcon><StoreIcon color="success" /></ListItemIcon>
                      <ListItemText 
                        primary={<Typography fontWeight="bold" color="text.primary">{item.item_name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{`Category: ${item.category || 'General'} • S/N: ${item.serial_number || 'N/A'}`}</Typography>}
                      />
                      <Chip 
                        label={`${item.available_units} / ${item.total_units} Available`} 
                        color={item.available_units > 0 ? 'success' : 'error'} 
                        size="small" 
                      />
                    </ListItem>
                    {i < filteredStore.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                )) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No store equipment matches your search.</Typography>
                )}
              </List>
            </Box>
          </Paper>
        )}

      </Box>
    </Layout>
  );
}