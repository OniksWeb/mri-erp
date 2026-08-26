import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CountUp from 'react-countup';
import { useTheme } from '@mui/material/styles';

// Material-UI components
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress, Alert,
  Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions,
  FormControl, List, ListItem, ListItemIcon, ListItemText, Divider, 
  InputLabel, Select, MenuItem, Chip, Stack, Avatar
} from '@mui/material';

// Icons
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EventIcon from '@mui/icons-material/Event';
import BusinessIcon from '@mui/icons-material/Business';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

// Calendar
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Recharts (Interactive Charts)
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, Tooltip as RechartsTooltip,
  BarChart, Bar
} from 'recharts';

import Layout from '../components/Layout';

// --- Configuration ---
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

function DashboardPage() {
  const { user, token } = useAuth();
  const theme = useTheme();

  // --- States ---
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Analytics Data
  const [summary, setSummary] = useState({ total_patients: 0, pending_reviews: 0, total_revenue: 0 });
  const [recentPatients, setRecentPatients] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [modalityData, setModalityData] = useState([]);
  const [branchData, setBranchData] = useState([]);

  // Calendar State
  const [events, setEvents] = useState([]);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', start_time: null, end_time: null, all_day: false });
  const [selectedEvent, setSelectedEvent] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;

  // --- 🛡️ PERMISSIONS ENGINE ---
  const perms = user?.permissions || {};
  const canViewFinancials = perms.can_view_financials ?? (user?.role !== 'doctor');

  // --- Dynamic Styles for Dark Mode ---
  const calendarStyle = {
    height: 600,
    color: theme.palette.text.primary, 
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'inherit',
    borderRadius: '8px'
  };

  // 1. Fetch Locations (for dropdown)
  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLocations(await res.json());
    } catch (err) { console.error("Error fetching locations", err); }
  }, [token, API_URL]);

  // 2. Fetch All Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    const headers = { 'Authorization': `Bearer ${token}` };
    const locParam = selectedLocation !== 'all' ? `?location_id=${selectedLocation}` : '';

    try {
      // ✅ OPTIMIZATION: Only fetch revenue data if the user is allowed to see it!
      const fetchPromises = [
        fetch(`${API_URL}/api/analytics/summary${locParam}`, { headers }),
        fetch(`${API_URL}/api/analytics/recent-results`, { headers }),
        fetch(`${API_URL}/api/analytics/modality-stats${locParam}`, { headers }),
        fetch(`${API_URL}/api/events/my`, { headers }),
      ];

      // Add financial calls only if permitted
      if (canViewFinancials) {
        fetchPromises.push(fetch(`${API_URL}/api/analytics/revenue-trend${locParam}`, { headers }));
        fetchPromises.push(fetch(`${API_URL}/api/analytics/branch-performance`, { headers }));
      }

      const results = await Promise.all(fetchPromises);
      
      if (results[0].ok) setSummary(await results[0].json());
      if (results[1].ok) setRecentPatients(await results[1].json());
      if (results[2].ok) setModalityData(await results[2].json());
      
      if (results[3].ok) {
        const evData = await results[3].json();
        setEvents(evData.map(e => ({
          ...e, start: new Date(e.start_time), end: new Date(e.end_time), allDay: e.all_day
        })));
      }

      if (canViewFinancials) {
        if (results[4].ok) setRevenueData(await results[4].json());
        if (results[5].ok) setBranchData(await results[5].json());
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data. Check connection.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedLocation, API_URL, canViewFinancials]);

  useEffect(() => {
    fetchLocations();
    fetchDashboardData();
  }, [fetchDashboardData, fetchLocations]);

  // --- Handlers ---
  const handleOpenEventDialog = (data) => {
    if (data.id) {
      setSelectedEvent(data);
      setNewEvent({ ...data, start_time: data.start, end_time: data.end });
    } else {
      setSelectedEvent(null);
      setNewEvent({ title: '', start_time: data.start, end_time: data.end, all_day: false });
    }
    setOpenEventDialog(true);
  };

  const handleSaveEvent = async () => {
    try {
      const endpoint = selectedEvent ? `/api/events/${selectedEvent.id}` : '/api/events';
      const method = selectedEvent ? 'PUT' : 'POST';
      
      await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newEvent)
      });
      setOpenEventDialog(false);
      fetchDashboardData(); 
    } catch (e) { alert("Failed to save event"); }
  };

  // --- Components ---
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
        
        {/* HEADER & LOCATION SWITCHER */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" color="primary">Dashboard</Typography>
            <Typography variant="body1" color="text.secondary">
              Overview for {selectedLocation === 'all' ? 'All Locations' : locations.find(l=>l.id === selectedLocation)?.name}
            </Typography>
          </Box>

          {(user?.role === 'admin' || user?.is_hq) ? (
            <FormControl sx={{ minWidth: 220, bgcolor: 'background.paper', borderRadius: 2 }}>
              <InputLabel>View Location</InputLabel>
              <Select value={selectedLocation} label="View Location" onChange={(e) => setSelectedLocation(e.target.value)}>
                <MenuItem value="all">Global View (HQ)</MenuItem>
                {locations.map(loc => <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>)}
              </Select>
            </FormControl>
          ) : (
            <Chip icon={<BusinessIcon />} label={user?.location_name || 'Branch View'} color="secondary" variant="outlined" />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* 1. STATS CARDS */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* ✅ DYNAMIC GRID SIZING: If they can't see revenue, the other two cards stretch to fill the row */}
          <Grid item xs={12} sm={canViewFinancials ? 4 : 6} md={canViewFinancials ? 4 : 6}>
            <StatCard title="Total Patients" value={summary.total_patients} icon={<PeopleIcon fontSize="large"/>} color="#5e35b1" subColor="#ede7f6" />
          </Grid>
          
          {canViewFinancials && (
            <Grid item xs={12} sm={4} md={4}>
              <StatCard title="Total Revenue" value={`₦${Number(summary.total_revenue).toLocaleString()}`} icon={<AttachMoneyIcon fontSize="large"/>} color="#2e7d32" subColor="#e8f5e9" />
            </Grid>
          )}

          <Grid item xs={12} sm={canViewFinancials ? 4 : 6} md={canViewFinancials ? 4 : 6}>
            <StatCard title="Pending Reviews" value={summary.pending_reviews} icon={<AssignmentIcon fontSize="large"/>} color="#ed6c02" subColor="#fff3e0" />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* 2. REVENUE TREND (Area Chart) - 🛡️ CLOAKED */}
          {canViewFinancials && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 4, height: 400, bgcolor: 'background.paper', boxShadow: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">Revenue Trends (7 Days)</Typography>
                </Stack>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} />
                    <YAxis axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} tickFormatter={(val) => `₦${val/1000}k`} />
                    <RechartsTooltip 
                      formatter={(val) => `₦${Number(val).toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: theme.palette.background.paper, 
                        color: theme.palette.text.primary,
                        borderRadius: 12, border: 'none', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' 
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {/* 3. MODALITY DISTRIBUTION (Donut Chart) */}
          {/* ✅ DYNAMIC GRID SIZING: Stretches wider if Revenue Chart is hidden */}
          <Grid item xs={12} md={canViewFinancials ? 6 : 6}>
            <Paper sx={{ p: 3, borderRadius: 4, height: 400, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Scan Breakdown</Typography>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie 
                    data={modalityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} 
                    paddingAngle={5} dataKey="value"
                  >
                    {modalityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 12, border: 'none' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* 4. BRANCH PERFORMANCE (Bar Chart - HQ Only) - 🛡️ CLOAKED */}
          {(user.is_hq && canViewFinancials) && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 4, height: 400, bgcolor: 'background.paper', boxShadow: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Branch Performance</Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={branchData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} />
                    <YAxis axisLine={false} tickLine={false} stroke={theme.palette.text.secondary} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#00C49F" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {/* 5. RECENT ACTIVITY LIST */}
          <Grid item xs={12} md={canViewFinancials ? (user.is_hq ? 6 : 12) : 6}>
             <Paper sx={{ p: 3, borderRadius: 4, height: 400, overflowY: 'auto', bgcolor: 'background.paper', boxShadow: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Recent Activities</Typography>
                <List>
                  {recentPatients.length > 0 ? recentPatients.map((p, i) => (
                    <React.Fragment key={p.file_id || i}>
                      <ListItem>
                        <ListItemIcon><LocalHospitalIcon color="primary" /></ListItemIcon>
                        <ListItemText 
                          primary={<Typography fontWeight="bold" color="text.primary">{p.patient_name}</Typography>}
                          secondary={<Typography variant="caption" color="text.secondary">{`Uploaded by ${p.uploaded_by_name} • ${new Date(p.created_at).toLocaleDateString()}`}</Typography>}
                        />
                        <Chip 
                            label={p.result_status} 
                            color={p.result_status === 'Pending' ? 'warning' : 'success'} 
                            size="small" 
                        />
                      </ListItem>
                      {i < recentPatients.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  )) : (
                    <Typography variant="body2" color="text.secondary">No recent activities.</Typography>
                  )}
                </List>
             </Paper>
          </Grid>

          {/* 6. CALENDAR (Full Width) */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Schedule</Typography>
                <Button variant="contained" startIcon={<EventIcon />} onClick={() => handleOpenEventDialog({ start: new Date(), end: new Date() })}>
                  Add Event
                </Button>
              </Box>
              
              <div style={calendarStyle}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  selectable
                  onSelectSlot={handleOpenEventDialog}
                  onSelectEvent={handleOpenEventDialog}
                  style={{ height: '100%' }}
                />
              </div>
            </Paper>
          </Grid>

        </Grid>

        {/* DIALOG: ADD/EDIT EVENT */}
        <Dialog open={openEventDialog} onClose={() => setOpenEventDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>{selectedEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField autoFocus fullWidth label="Title" sx={{ mb: 2, mt: 1 }} value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} />
            <TextField fullWidth multiline rows={3} label="Description" value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEventDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEvent}>Save</Button>
          </DialogActions>
        </Dialog>

      </Box>
    </Layout>
  );
}

export default DashboardPage;