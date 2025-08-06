// web-frontend/src/components/Layout.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeToggle } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button
} from '@mui/material';

// Material-UI styles for custom components
import { styled } from '@mui/material/styles';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MarkAsUnreadIcon from '@mui/icons-material/MarkAsUnread';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Not used in provided code, can remove or keep for future use

// Assuming you have your company logo at this path
import companyLogo from '../assets/company_logo.png';

// Import SideNav and socket
import SideNav from './SideNav'; // Import SideNav
import socket from '../utils/socket'; // Import the pre-initialized socket instance

// --- Constants (must match SideNav.js for consistency) ---
const drawerWidth = 240;
const closedDrawerWidth = 60;

// --- Styled AppBar Component ---
const AppBarStyled = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
}));

// --- Styled Main Content Area ---
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth - closedDrawerWidth}px`,
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
    [theme.breakpoints.up('sm')]: {
      marginLeft: open ? drawerWidth : closedDrawerWidth,
    },
    width: `calc(100% - ${closedDrawerWidth}px)`,
    ...(open && {
        width: `calc(100% - ${drawerWidth}px)`,
    }),
  }),
);

// --- Layout Component Definition ---
function Layout({ children }) {
  const { mode, toggleColorMode } = useThemeToggle();
  const { user, token } = useAuth(); // Ensure user and token are destructured
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorElNotifications, setAnchorElNotifications] = useState(null);
  const openNotificationsMenu = Boolean(anchorElNotifications);

  // --- Notification Fetching Logic (Helper Function) ---
  // This function is now passed 'currentUser' and 'currentToken' to ensure it uses the latest values
  const fetchNotifications = async (currentUser, currentToken) => {
    if (!currentUser || !currentToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const unreadResponse = await fetch('http://localhost:5001/api/notifications/my?readStatus=unread', {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });
      const unreadData = await unreadResponse.json();
      if (unreadResponse.ok) {
        setUnreadCount(unreadData.length);
      } else {
        console.error('Failed to fetch unread notifications count:', unreadData.message);
        setUnreadCount(0);
      }

      const allResponse = await fetch('http://localhost:5001/api/notifications/my', {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });
      const allData = await allResponse.json();
      if (allResponse.ok) {
        setNotifications(allData);
      } else {
        console.error('Failed to fetch all notifications:', allData.message);
        setNotifications([]);
      }
    } catch (error) {
      console.error('Network error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };


  // --- Combined useEffect for Theme, Socket.IO, and Notification Management ---
  useEffect(() => {
    // 1. Theme Mode Management
    if (mode === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // 2. Socket.IO Connection and Listeners
    // Only manage socket connection if user is authenticated
    if (user && token) {
      // Connect the socket if not already connected
      if (!socket.connected) {
        socket.connect();
      }

      // Register user ID with the backend socket
      const handleSocketConnect = () => {
        if (user && user.id) { // Ensure user.id is available
          socket.emit('register_user', user.id);
          console.log(`Layout: Emitting register_user for user ${user.id} on socket connect`);
        }
      };

      // Listen for new_notification events
      const handleNewNotification = (newNotif) => {
        console.log('Frontend: Received real-time notification:', newNotif);
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
        // Optionally, play a sound or show a transient alert here
      };

      socket.on('connect', handleSocketConnect);
      socket.on('new_notification', handleNewNotification);

      // 3. Initial Notification Fetch and Polling
      // Pass current user and token values to fetchNotifications
      fetchNotifications(user, token);
      const intervalId = setInterval(() => fetchNotifications(user, token), 30000); // Poll every 30 seconds

      // Cleanup function: runs when component unmounts or dependencies change
      return () => {
        clearInterval(intervalId); // Clear polling interval
        socket.off('connect', handleSocketConnect); // Remove connect listener
        socket.off('new_notification', handleNewNotification); // Remove real-time listener

        // Disconnect socket only if there are no other active listeners/components needing it
        // OR if the user is logging out/unauthenticated
        if (!user || !token) { // Disconnect socket if no user/token
             if (socket.connected) {
                socket.disconnect();
                console.log('Layout: Disconnected socket due to user logout/unauth.');
             }
             // Also signal backend to unregister this socket from the user ID
             socket.emit('unregister_user', null); // Or specific user.id if backend handles unregistering specific ids
        }
      };
    } else {
      // If no user or token (user logged out), ensure socket is disconnected
      if (socket.connected) {
        socket.disconnect();
        console.log('Layout: Disconnected socket as user is not authenticated.');
      }
      setNotifications([]);
      setUnreadCount(0);
      // Ensure existing listeners are removed from previous connections if any
      socket.off('connect');
      socket.off('new_notification');
    }
  }, [mode, user, token]); // Dependencies: mode for theme, user/token for authentication/socket management


  // --- Notification Menu Handlers ---
  const handleOpenNotificationsMenu = (event) => {
    setAnchorElNotifications(event.currentTarget);
  };

  const handleCloseNotificationsMenu = () => {
    setAnchorElNotifications(null);
  };

  const handleNotificationClick = async (notificationId, relatedEntityType, relatedEntityId) => {
    handleCloseNotificationsMenu();

    try {
      const response = await fetch(`http://localhost:5001/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        // Optimistically update UI
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Navigate to related page if path is defined
        if (relatedEntityType === 'patient' && relatedEntityId) {
            navigate(`/patients/${relatedEntityId}/details`);
        } else if (relatedEntityType === 'query' && relatedEntityId) {
            // This assumes an admin query detail page, adjust if it's 'my queries'
            navigate(`/admin/queries`); // Navigating to all queries for admin
            // If it's medical staff's own query, it might be: navigate(`/queries/my`);
        } else if (relatedEntityType === 'patient_result' && relatedEntityId) {
            navigate(`/patients/${relatedEntityId}/results/manage`); // Example: manage results for that patient
        } else if (relatedEntityType === 'event' && relatedEntityId) {
            navigate(`/dashboard`); // Navigate to dashboard where calendar is
        }
      } else {
        console.error('Failed to mark notification as read:', await response.text());
      }
    } catch (error) {
      console.error('Network error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    handleCloseNotificationsMenu();
    if (unreadCount === 0) return;

    try {
      const response = await fetch('http://localhost:5001/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
        setUnreadCount(0);
      } else {
        console.error('Failed to mark all notifications as read:', await response.text());
      }
    } catch (error) {
      console.error('Network error marking all notifications as read:', error);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Filter menu items based on user role (moved here for consistency)
  const menuItems = [
    { text: 'Dashboard', path: '/dashboard', roles: ['admin', 'medical_staff', 'doctor', 'financial_admin'] },
    { text: 'Log Patient', path: '/patients/log', roles: ['medical_staff', 'doctor'] },
    { text: 'Patient List', path: '/patients/list', roles: ['admin', 'medical_staff', 'doctor', 'financial_admin'] },
    { text: 'Submit Query', path: '/queries/submit', roles: ['medical_staff', 'doctor'] },
    { text: 'My Queries', path: '/queries/my', roles: ['medical_staff', 'admin', 'doctor'] },
    // Only show "All Queries" if the user is an admin
    ...(user && user.role === 'admin' ? [{ text: 'All Queries', path: '/admin/queries', roles: ['admin'] }] : []),
    // Only show "Admin Panel" if the user is an admin
    ...(user && user.role === 'admin' ? [{ text: 'Admin Panel', path: '/admin', roles: ['admin'] }] : []),
  ];

  const filteredMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* AppBar */}
      <AppBarStyled position="fixed" color="primary">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          {/* Company Logo */}
          <img
            src={companyLogo}
            alt="Company Logo"
            style={{
              height: '40px',
              marginRight: '15px',
              
            }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            G2GMedical {user ? ` - ${user.role.replace('_', ' ').toUpperCase()}` : ''}
          </Typography>

          {/* Right-aligned items: Theme Toggle, Notifications, User Profile Icon, Logout/Login */}
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={toggleColorMode}
                icon={<Brightness7Icon sx={{ color: 'white' }} />}
                checkedIcon={<Brightness4Icon sx={{ color: 'white' }} />}
                color="default"
              />
            }
            label=""
          />

          {user && ( // Notifications icon only visible when logged in
            <IconButton
              color="inherit"
              aria-label="show notifications"
              onClick={handleOpenNotificationsMenu}
              sx={{ mx: 1 }}
            >
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          {user && ( // User Profile Icon Button
            <IconButton
              color="inherit"
              aria-label="user profile"
              onClick={() => navigate('/profile')}
              sx={{ mx: 1 }}
            >
              <PersonIcon />
            </IconButton>
          )}

          {/* Login/Logout Button */}
          {user ? (
            <Button color="inherit" onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>
              Logout
            </Button>
          ) : (
            <Button color="inherit" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}
        </Toolbar>
      </AppBarStyled>

      {/* Sidebar Component */}
      <SideNav open={mobileOpen} onToggle={handleDrawerToggle} menuItems={filteredMenuItems} />

      {/* Main Content Area */}
      <Main open={mobileOpen} sx={{ mt: 8 }}> {/* mt: 8 for AppBar height offset */}
        <Toolbar /> {/* Spacer to visually offset content below the AppBar */}
        {children}
      </Main>

      {/* Notifications Dropdown Menu */}
      <Menu
        anchorEl={anchorElNotifications}
        open={openNotificationsMenu}
        onClose={handleCloseNotificationsMenu}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            width: '350px',
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: 'background.paper',
            borderRadius: '8px',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={markAllNotificationsAsRead} disabled={unreadCount === 0}>
          <ListItemIcon><MarkAsUnreadIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={`Mark all as read (${unreadCount})`} />
        </MenuItem>
        <Divider />
        {notifications.length === 0 ? (
          <MenuItem disabled sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No notifications</MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => handleNotificationClick(
                notification.id,
                notification.related_entity_type,
                notification.related_entity_id
              )}
              sx={{
                fontWeight: notification.is_read ? 'normal' : 'bold',
                backgroundColor: notification.is_read ? 'inherit' : 'action.selected',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                whiteSpace: 'normal',
                py: 1.5,
              }}
            >
              <Typography variant="body2">{notification.message}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(notification.created_at).toLocaleString()}
              </Typography>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}

export default Layout;