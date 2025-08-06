// web-frontend/src/pages/UserProfilePage.js
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Container, // Ensure Container is imported
} from '@mui/material';

// Icons
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LockIcon from '@mui/icons-material/Lock'; // For role
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // For verified status
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'; // For created_at
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { Stack, IconButton } from '@mui/material'; // Import Stack and IconButton
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Import the icon
function UserProfilePage() {
  const { user } = useAuth(); // Get the logged-in user details from AuthContext
  const navigate = useNavigate(); // Initialize useNavigate for navigation
  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Please log in to view your profile.</Typography>
      </Box>
    );
  }

  return (
    <Container component="main" maxWidth="md" sx={{ p: 3 }}> {/* ADD p:3 here for page-level padding */}
      <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ width: 100, height: 100, bgcolor: 'primary.main', mb: 2 }}>
            <PersonIcon sx={{ fontSize: 60 }} />
          </Avatar>
          <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
                    <IconButton onClick={() => navigate(-1)}>
                        <ArrowBackIcon />
                    </IconButton>
                   <Typography variant="h4" component="h1" gutterBottom>
            {user.full_name || user.username} Profile
          </Typography>
                </Stack>
          <Typography variant="subtitle1" color="text.secondary">
            {user.role.replace('_', ' ').toUpperCase()}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <List>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary="Username" secondary={user.username} />
              </ListItem>
              <Divider component="li" variant="inset" />
              <ListItem>
                <ListItemIcon>
                  <EmailIcon />
                </ListItemIcon>
                <ListItemText primary="Email" secondary={user.email} />
              </ListItem>
              {user.phone_number && (
                <>
                  <Divider component="li" variant="inset" />
                  <ListItem>
                    <ListItemIcon>
                      <PhoneIcon />
                    </ListItemIcon>
                    <ListItemText primary="Phone Number" secondary={user.phone_number} />
                  </ListItem>
                </>
              )}
            </List>
          </Grid>
          <Grid item xs={12} md={6}>
            <List>
              <ListItem>
                <ListItemIcon>
                  <LockIcon />
                </ListItemIcon>
                <ListItemText primary="Role" secondary={user.role.replace('_', ' ').toUpperCase()} />
              </ListItem>
              <Divider component="li" variant="inset" />
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color={user.is_verified ? "success" : "warning"} />
                </ListItemIcon>
                <ListItemText primary="Status" secondary={user.is_verified ? "Verified" : "Unverified / Suspended"} />
              </ListItem>
              <Divider component="li" variant="inset" />
              <ListItem>
                <ListItemIcon>
                  <CalendarMonthIcon />
                </ListItemIcon>
                <ListItemText primary="Member Since" secondary={new Date(user.created_at).toLocaleDateString()} />
              </ListItem>
            </List>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            (Edit profile options will be added here.)
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default UserProfilePage;