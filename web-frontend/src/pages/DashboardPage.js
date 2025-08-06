// web-frontend/src/pages/DashboardPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CountUp from 'react-countup';
import { useTheme } from '@mui/material/styles';

// Material-UI components
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress, Alert,
  Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions,
  FormControl, List,Tooltip, ListItem, ListItemIcon, ListItemText, Divider, InputLabel, Select, MenuItem, Checkbox, FormControlLabel,
  useMediaQuery // For responsiveness
} from '@mui/material';

// Icons
import PeopleIcon from '@mui/icons-material/People';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import OtherHousesIcon from '@mui/icons-material/OtherHouses';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event'; // Corrected import name

// For the Calendar
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// For date time pickers
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// Recharts components
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';


// --- OUTSIDE DashboardPage component ---
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const PieChartColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
// --- END OUTSIDE ---


function DashboardPage() {
  const { user, token } = useAuth(); // Ensure 'user' and 'token' are correctly destructured
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm')); // For responsive calendar view

  const [analyticsData, setAnalyticsData] = useState({
    totalPatients: null,
    patientsByGender: [],
    mrisByDay: [],
    recentPatients: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [events, setEvents] = useState([]);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: null,
    end_time: null,
    all_day: false,
    patient_id: ''
  });
  const [patients, setPatients] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // To handle editing existing events


  // Event Handlers
  const handleOpenEventDialog = useCallback((eventData) => {

    console.log('handleOpenEventDialog triggered!'); 
  console.log('eventData received:', eventData); 


    setEventError(''); // Clear errors when opening
     if (eventData && eventData.start && eventData.end && (eventData.action === 'select' || (eventData.slots && eventData.slots.length > 0))) {
    console.log('Identified as a slot selection.'); 
    setNewEvent({
        title: '',
        description: '',
        start_time: eventData.start,
        end_time: eventData.end,
        all_day: eventData.action === 'select' && eventData.slots && eventData.slots.length === 1 && eventData.start.getTime() === eventData.end.getTime(),
        patient_id: ''
      });
      setSelectedEvent(null);
    } else if (eventData && eventData.id) { // If clicking on an existing event for editing
      setSelectedEvent(eventData);
      setNewEvent({
        title: eventData.title,
        description: eventData.description || '',
        start_time: eventData.start,
        end_time: eventData.end,
        all_day: eventData.allDay,
        patient_id: eventData.patient_id || ''
      });
    }else {
    console.log('Could not identify eventData as slot or existing event:', eventData); // ADD THIS
  }
    setOpenEventDialog(true);
  }, []);

  const handleCloseEventDialog = useCallback(() => {
    setOpenEventDialog(false);
    setNewEvent({ title: '', description: '', start_time: null, end_time: null, all_day: false, patient_id: '' });
    setSelectedEvent(null);
    setIsSavingEvent(false);
    setEventError(''); // Clear errors on close
  }, []);

  const handleEventChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setNewEvent(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleDateTimeChange = useCallback((date, name) => {
    setNewEvent(prev => ({
      ...prev,
      [name]: date
    }));
  }, []);


  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      setError('Authentication token missing. Please log in.');
      setLoading(false);
      setLoadingEvents(false);
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    try {
      setLoading(true);
      setLoadingEvents(true);

      const now = new Date();
      // Adjust this range based on what you want to display by default in the calendar.
      // For a calendar, usually fetching a window around the current view or a broader default.
      const startRange = new Date(now.getFullYear() - 1, 0, 1).toISOString();
      const endRange = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59).toISOString();


      const [
        totalPatientsRes,
        patientsByGenderRes,
        mrisByDayRes,
        recentPatientsRes,
        eventsRes,
        patientsRes
      ] = await Promise.all([
        fetch('http://localhost:5001/api/analytics/total-patients', { headers }),
        fetch('http://localhost:5001/api/analytics/patients-by-gender', { headers }),
        fetch('http://localhost:5001/api/analytics/mris-by-day', { headers }),
        fetch('http://localhost:5001/api/analytics/recent-patients', { headers }),
        fetch(`http://localhost:5001/api/events/my?start=${startRange}&end=${endRange}`, { headers }),
        fetch('http://localhost:5001/api/patients', { headers }),
      ]);

      const [
        totalPatientsData,
        patientsByGenderData,
        mrisByDayData,
        recentPatientsData,
        eventData,
        patientListData
      ] = await Promise.all([
        totalPatientsRes.json(),
        patientsByGenderRes.json(),
        mrisByDayRes.json(),
        recentPatientsRes.json(),
        eventsRes.json(),
        patientsRes.json()
      ]);

      if (!totalPatientsRes.ok || !patientsByGenderRes.ok || !mrisByDayRes.ok || !recentPatientsRes.ok) {
        throw new Error('Failed to fetch all analytics data.');
      }
      setAnalyticsData({
        totalPatients: parseInt(totalPatientsData.total_patients),
        patientsByGender: patientsByGenderData.map(item => ({ ...item, count: parseInt(item.count) })),
        mrisByDay: mrisByDayData.map(item => ({ ...item, count: parseInt(item.count), date: new Date(item.date).toLocaleDateString() })),
        recentPatients: recentPatientsData,
      });

      if (eventsRes.ok) {
        const formattedEvents = eventData.map(event => ({
          id: event.id,
          title: event.title,
          start: new Date(event.start_time),
          end: new Date(event.end_time),
          allDay: event.all_day,
          description: event.description,
          patient_id: event.patient_id,
          patient_name: event.patient_name, // Ensure your backend query for events returns patient_name
          creator_name: event.creator_name, // Ensure your backend query for events returns creator_name
          userId: event.user_id,
        }));
        setEvents(formattedEvents);
      } else {
        setEventError(eventData.message || 'Failed to fetch events.');
      }

      if (patientsRes.ok) {
        setPatients(patientListData);
      } else {
        console.error('Failed to fetch patients for event form:', patientListData.message);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Network error or server issue.');
      setEventError('Failed to load calendar events.');
    } finally {
      setLoading(false);
      setLoadingEvents(false);
    }
  }, [token]); // Dependencies: only token as user is used inside.

  const handleSaveEvent = useCallback(async () => {
    setIsSavingEvent(true);
    setEventError('');
    try {
      const method = selectedEvent ? 'PUT' : 'POST';
      const url = selectedEvent
        ? `http://localhost:5001/api/events/${selectedEvent.id}`
        : 'http://localhost:5001/api/events';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newEvent,
          start_time: newEvent.start_time ? newEvent.start_time.toISOString() : null,
          end_time: newEvent.end_time ? newEvent.end_time.toISOString() : null,
        })
      });

      const data = await response.json();
      if (response.ok) {
        handleCloseEventDialog();
        fetchDashboardData(); // Re-fetch all data to update calendar
        console.log(data.message);
      } else {
        setEventError(data.message || 'Failed to save event.');
      }
    } catch (err) {
      console.error('Error saving event:', err);
      setEventError('Network error or server unavailable.');
    } finally {
      setIsSavingEvent(false);
    }
  }, [token, selectedEvent, newEvent, handleCloseEventDialog, fetchDashboardData]); // Dependencies for useCallback

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent || !window.confirm('Are you sure you want to delete this event?')) {
      return;
    }
    setIsSavingEvent(true);
    setEventError('');
    try {
      // Check if the current user is the creator of the event OR is an admin
      // This is a client-side check for UX, but backend should enforce strictly
      if (selectedEvent.userId !== user.id && user.role !== 'admin') {
          setEventError('You do not have permission to delete this event.');
          setIsSavingEvent(false);
          return;
      }

      const response = await fetch(`http://localhost:5001/api/events/${selectedEvent.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        handleCloseEventDialog();
        setEvents(prevEvents => prevEvents.filter(event => event.id !== selectedEvent.id)); // Optimistic update
        console.log('Event deleted successfully!');
      } else {
        const data = await response.json();
        setEventError(data.message || 'Failed to delete event.');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      setEventError('Network error or server unavailable.');
    } finally {
      setIsSavingEvent(false);
    }
  }, [token, selectedEvent, user, handleCloseEventDialog]); // Dependencies for useCallback


  // Primary useEffect to run fetchDashboardData on component mount and token/user changes
  useEffect(() => {
    fetchDashboardData();
    // You can add polling here if needed, but the Save/Delete functions already trigger a re-fetch
    // const interval = setInterval(fetchDashboardData, 60000);
    // return () => clearInterval(interval);
  }, [fetchDashboardData]); // Dependency array includes the memoized fetchDashboardData


  // Custom event component for react-big-calendar to show more info
  const CustomEvent = ({ event }) => {
  const theme = useTheme(); // Access theme inside CustomEvent for more dynamic styling
  return (
    <Box sx={{
      height: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      p: 0.5, // Add some padding inside event block
      color: theme.palette.mode === 'dark' ? 'white' : 'black', // Text color might need adjustment for readability
      backgroundColor: event.allDay ? theme.palette.secondary.light : theme.palette.primary.light, // Different shades for all-day
      // More dynamic background based on event type or status if you add it later
    }}>
      <Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
        {event.title}
      </Typography>
      {event.patient_name && (
        <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2, display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <PeopleIcon sx={{ fontSize: '0.7rem', mr: 0.5 }} /> Patient: {event.patient_name}
        </Typography>
      )}
      {event.description && (
        <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
          Desc: {event.description.substring(0, 20)}{event.description.length > 20 ? '...' : ''}
        </Typography>
      )}
    </Box>
  );
};

const EventWrapper = ({ event, children }) => {
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{event.title}</Typography>
          <Typography variant="caption">{new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleString()}</Typography>
          {event.patient_name && <Typography variant="caption">Patient: {event.patient_name}</Typography>}
          {event.description && <Typography variant="caption">Description: {event.description}</Typography>}
        </Box>
      }
      arrow
      placement="top"
    >
      {children}
    </Tooltip>
  );
};


  if (loading || loadingEvents) { // Check both loading states
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard data...</Typography>
      </Box>
    );
  }

  if (error || eventError) { // Display any error
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error || eventError}
      </Alert>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, height: '100%', p: 3 }}>
      <Box sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        p: 3,
        boxShadow: 3,
      }}>
        <Typography variant="h4" gutterBottom component="h1" sx={{mb: 3}}>
          Dashboard Overview
        </Typography>

        <Grid container spacing={2}>
          {/* Total Patients Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{
              display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              p: 0,
              backgroundColor: 'info.main',
              color: 'info.contrastText',
              boxShadow: 6,
              borderRadius: 2,
            }}>
              <CardContent sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: '280px',
                p: 3,
              }}>
                <Typography variant="h2" component="div" sx={{ fontWeight: 'bold', mb: 1, lineHeight: 1 }}>
                  {analyticsData.totalPatients !== null ?
                    <CountUp start={0} end={analyticsData.totalPatients} duration={2} separator="," />
                    : 'N/A'
                  }
                </Typography>
                <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                  Total Patients
                </Typography>
                <PeopleIcon sx={{ fontSize: 60, opacity: 0.8 }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Patients by Gender Chart */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Patients by Gender</Typography>
                {analyticsData.patientsByGender.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analyticsData.patientsByGender}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="gender"
                        label={({ gender, percent }) => `${gender}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {analyticsData.patientsByGender.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PieChartColors[index % PieChartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No gender data available.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* MRIs by Day Chart */}
          <Grid item xs={12} md={4}>
            <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>MRIs in Last 30 Days</Typography>
                {analyticsData.mrisByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart
                      data={analyticsData.mrisByDay}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No MRI data for the last 30 days.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Patients Widget */}
          <Grid item xs={12} sm={6} md={6}>
            <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Recent Patient Registrations</Typography>
                {analyticsData.recentPatients.length > 0 ? (
                  <List>
                    {analyticsData.recentPatients.map((patient) => (
                      <React.Fragment key={patient.id}>
                        <ListItem>
                          <ListItemIcon>
                            <AccessTimeIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={patient.patient_name}
                            secondary={`MRI Code: ${patient.mri_code} - ${new Date(patient.mri_date_time).toLocaleString()}`}
                          />
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">No recent patient registrations.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Event Calendar Widget */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    Event Calendar
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<EventIcon />}
                    onClick={() => handleOpenEventDialog({ start: new Date(), end: new Date() })}
                  >
                    Add Event
                  </Button>
                </Box>
                {loadingEvents ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Loading calendar events...</Typography>
                  </Box>
                ) : eventError ? (
                  <Alert severity="error">{eventError}</Alert>
                ) : (
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box sx={{ height: '50vh', width: '50vh' }}> {/* Responsive height */}
                      <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        selectable
                        onSelectSlot={handleOpenEventDialog}
                        onSelectEvent={handleOpenEventDialog}
                        eventPropGetter={(event) => {
                          const style = {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            borderRadius: '0px',
                            opacity: 0.8,
                            border: '0px',
                            display: 'block',
                            borderColor: theme.palette.primary.dark,
                          };
                          if (event.allDay) {
                            style.backgroundColor = theme.palette.secondary.main;
                          }
                          if (event.id === selectedEvent?.id) {
                            style.border = `2px solid ${theme.palette.warning.main}`;
                            style.opacity = 1;
                          }
                          return { style };
                        }}
                        components={{
                          event: CustomEvent, // Use custom event component
                          eventWrapper: EventWrapper
                        }}
                        views={['month', 'week', 'day', 'agenda']} // Allow different views
                        defaultView={isSmallScreen ? 'day' : 'month'} // Default view based on screen size
                      />
                    </Box>
                  </LocalizationProvider>
                )}
              </CardContent>
            </Card>

            {/* Event Add/Edit Dialog */}
            <Dialog open={openEventDialog} onClose={handleCloseEventDialog} fullWidth maxWidth="sm">
              <DialogTitle>{selectedEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
              <DialogContent>
                {eventError && <Alert severity="error" sx={{ mb: 2 }}>{eventError}</Alert>}
                <TextField
                  autoFocus
                  margin="dense"
                  name="title"
                  label="Event Title"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={newEvent.title}
                  onChange={handleEventChange}
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="dense"
                  name="description"
                  label="Description"
                  type="text"
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  value={newEvent.description}
                  onChange={handleEventChange}
                  sx={{ mb: 2 }}
                />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <DateTimePicker
                      label="Start Time"
                      value={newEvent.start_time}
                      onChange={(date) => handleDateTimeChange(date, 'start_time')}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DateTimePicker
                      label="End Time"
                      value={newEvent.end_time}
                      onChange={(date) => handleDateTimeChange(date, 'end_time')}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </Grid>
                <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                  <InputLabel id="patient-select-label">Link to Patient (Optional)</InputLabel>
                  <Select
                    labelId="patient-select-label"
                    id="patient-select"
                    name="patient_id"
                    value={newEvent.patient_id}
                    label="Link to Patient (Optional)"
                    onChange={handleEventChange}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {patients.map((patient) => (
                      <MenuItem key={patient.id} value={patient.id}>
                        {patient.patient_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newEvent.all_day}
                      onChange={handleEventChange}
                      name="all_day"
                    />
                  }
                  label="All Day Event"
                  sx={{ mb: 2 }}
                />
              </DialogContent>
              <DialogActions>
                {selectedEvent && user && user.role === 'admin' && ( // Only admin can delete for simplicity
                  <Button onClick={handleDeleteEvent} color="error" disabled={isSavingEvent}>
                    Delete
                  </Button>
                )}
                {selectedEvent && user && user.role !== 'admin' && selectedEvent.userId !== user.id && (
                  <Typography variant="caption" color="error" sx={{ mr: 2 }}>
                    (Only creator or Admin can delete)
                  </Typography>
                )}
                <Button onClick={handleCloseEventDialog} disabled={isSavingEvent}>Cancel</Button>
                <Button onClick={handleSaveEvent} color="primary" variant="contained" disabled={isSavingEvent}>
                  {isSavingEvent ? <CircularProgress size={24} /> : (selectedEvent ? 'Update Event' : 'Add Event')}
                </Button>
              </DialogActions>
            </Dialog>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default DashboardPage;