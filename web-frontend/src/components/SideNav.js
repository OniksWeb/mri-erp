// web-frontend/src/components/SideNav.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Material-UI components
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Avatar,
  Badge, // Keep Badge as it might be used for other things in the future, though not for notifications here
  Collapse,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';

// Material-UI styles for custom components
import { styled } from '@mui/material/styles';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu'; // For hamburger in collapsed state
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import UploadFileIcon from '@mui/icons-material/UploadFile'; // New icon for result upload
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'; // New icon for result management


// --- Constants for Drawer Width ---
const drawerWidth = 240; // Full width of the open sidebar
const closedDrawerWidth = 60; // Width when collapsed (just icons)

// --- Styled Drawer Header (for top section of sidebar) ---
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end', // Aligns close icon/toggle to the right when open
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar, // Ensures it matches AppBar height
}));

// --- Styled Drawer Component (handles width transition and glass morphism) ---
const StyledDrawer = styled(Drawer)(({ theme, open }) => ({
  // Explicitly set position to fixed and zIndex for overlaying behavior
  position: 'fixed',
  zIndex: theme.zIndex.drawer + 2, // Higher than AppBar's zIndex
  width: open ? drawerWidth : closedDrawerWidth, // Base width for transition
  flexShrink: 0, // Prevent shrinking in flex container
  whiteSpace: 'nowrap', // Prevent text wrapping
  boxSizing: 'border-box', // Include padding/border in width

  // Styles for the actual Drawer paper
  '& .MuiDrawer-paper': {
    width: open ? drawerWidth : closedDrawerWidth, // Dynamic width based on 'open'
    overflowX: 'hidden', // Hide horizontal scrollbar content (important for text overflow)
    transition: theme.transitions.create('width', { // Smooth width transition
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    // --- Glass Morphism Styles ---
    backgroundColor: 'rgba(25, 25, 50, 0.4)', // Dark blue with 40% opacity
    backdropFilter: 'blur(15px) saturate(180%)', // Blur and saturate for glass effect
    WebkitBackdropFilter: 'blur(15px) saturate(180%)', // For Safari
    borderRight: '1px solid rgba(255, 255, 255, 0.1)', // Subtle white border on right
    boxShadow: '0 8px 60px 0 rgba(0, 0, 0, 0.5)', // Deep shadow
    color: 'white', // Default text/icon color for the sidebar
  },
  // Animation for when the drawer closes
  ...(!open && {
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  }),
}));

// --- SideNav Component Definition ---
function SideNav({ open, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [openAdminMenu, setOpenAdminMenu] = useState(false);
  const [adminAnchorEl, setAdminAnchorEl] = useState(null);
  const openAdminMenuDropdown = Boolean(adminAnchorEl);

  // --- Handlers ---
  const handleNavigate = (path) => {
    navigate(path);
    // Removed automatic sidebar close on navigate.
    // This allows users to keep the sidebar open while navigating within it if they prefer.
    // If you want it to close every time, uncomment the line below:
    // if (open) { onToggle(); }
  };

  const handleAdminClick = (event) => {
    if (!open) {
      setAdminAnchorEl(event.currentTarget);
    } else {
      setOpenAdminMenu(!openAdminMenu);
    }
  };

  const handleAdminMenuClose = () => {
    setAdminAnchorEl(null);
  };

  const handleAdminMenuNavigate = (path) => {
    navigate(path);
    handleAdminMenuClose();
  };

  // --- Menu Items Configuration ---
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] },
    { text: 'Patients', icon: <PeopleIcon />, path: '/patients', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] },
    { text: 'Add Patient', icon: <AddCircleOutlineIcon />, path: '/patients/add', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] },
    { text: 'Upload Result', icon: <UploadFileIcon />, path: '/results/upload', roles: ['admin', 'doctor'] }, // NEW
    { text: 'Results Dashboard', icon: <AssignmentTurnedInIcon />, path: '/results/dashboard', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] }, // NEW: Results Dashboard
    // Consider adding a generic Patient Results/Management page link here if not tied to a specific patient ID
    // For managing specific patient results, the link will be on PatientDetailPage
    { text: 'Submit Query', icon: <SendIcon />, path: '/queries/submit', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] },
    { text: 'My Queries', icon: <FormatListNumberedIcon />, path: '/queries/my', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'] },
    { text: 'Chat', icon: <ChatIcon />, path: '/chat', roles: ['medical_staff', 'admin', 'doctor', 'financial_admin'], disabled: true },
  ];

  const adminMenuItems = [
    { text: 'Manage Staff', icon: <PeopleIcon />, path: '/admin', roles: ['admin'] },
    { text: 'All Queries', icon: <ListAltIcon />, path: '/admin/queries', roles: ['admin'] },
    { text: 'Staff Activity', icon: <AssignmentTurnedInIcon />, path: '/admin/staff-activity', roles: ['admin'] }, // Assuming a path for this
  ];

  // Helper to check if a menu item's path is currently active or is a parent of the current path
  const isPathActive = (itemPath) => {
    if (itemPath === '/') {
        return location.pathname === '/';
    }
    // Check for exact match or if current path starts with the item's path (for parent-child routes)
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  return (
    <StyledDrawer variant="permanent" open={open} anchor="left">
      {/* Top Section of Drawer: ERP Menu Title / Toggle Icon */}
      <DrawerHeader>
        {open && (
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, textAlign: 'center' }}>
            ERP Menu
          </Typography>
        )}
        <IconButton onClick={onToggle} sx={{ color: 'white' }}>
          {open ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* User Profile Section */}
      {user && (
        <Box sx={{ p: open ? 2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar sx={{ mb: open ? 1 : 0, width: open ? 60 : 40, height: open ? 60 : 40, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: open ? 40 : 24 }} />
          </Avatar>
          {open && (
            <>
              <Typography variant="h6" sx={{ color: 'white', whiteSpace: 'normal', textAlign: 'center' }}>
                {user.full_name || user.username}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>
                {user.role.replace('_', ' ')}
              </Typography>
            </>
          )}
        </Box>
      )}
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Main Menu Items */}
      <List sx={{ pt: 1 }}>
        {menuItems.map((item) => (
          (item.roles.includes(user?.role) && !item.disabled) && (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => handleNavigate(item.path)}
                selected={isPathActive(item.path)} // Use the new helper for active state
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  borderRadius: 1,
                  m: 1,
                  color: 'white',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }} />
              </ListItemButton>
            </ListItem>
          )
        ))}

        {/* Admin Menu (Collapsible when open, Floating Menu when collapsed) */}
        {user && user.role === 'admin' && (
          <>
            <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <ListItem disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={handleAdminClick}
                sx={{
                  minHeight: 40,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  borderRadius: 1,
                  m: 1,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
                aria-controls={openAdminMenuDropdown ? 'admin-menu-dropdown' : undefined}
                aria-haspopup="true"
              >
                <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center', color: 'white' }}>
                  <AdminPanelSettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Admin Tools" sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }} />
                {open && (openAdminMenu ? <ExpandLess /> : <ExpandMore />)}
              </ListItemButton>
            </ListItem>

            {/* Collapsible Admin Sub-Menu (renders only when sidebar is expanded) */}
            {open && (
              <Collapse in={openAdminMenu} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {adminMenuItems.map((item) => (
                    (item.roles.includes(user?.role)) && (
                      <ListItem key={item.text} disablePadding>
                        <ListItemButton
                          onClick={() => handleNavigate(item.path)}
                          selected={isPathActive(item.path)} // Use new helper
                          sx={{
                            pl: 4,
                            minHeight: 48,
                            justifyContent: 'initial',
                            px: 2.5,
                            borderRadius: 1,
                            m: 1,
                            color: 'white',
                            '&.Mui-selected': { backgroundColor: 'rgba(255, 255, 255, 0.2)', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' } },
                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center', color: 'white' }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText primary={item.text} />
                        </ListItemButton>
                      </ListItem>
                    )
                  ))}
                </List>
              </Collapse>
            )}

            {/* Floating Admin Dropdown Menu (renders only when sidebar is collapsed) */}
            {!open && (
              <Menu
                id="admin-menu-dropdown"
                anchorEl={adminAnchorEl}
                open={openAdminMenuDropdown}
                onClose={handleAdminMenuClose}
                MenuListProps={{
                  'aria-labelledby': 'admin-tools-button',
                }}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                sx={{
                  '& .MuiPaper-root': {
                      backgroundColor: 'rgba(25, 25, 50, 0.9)',
                      backdropFilter: 'blur(10px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                  }
                }}
              >
                {adminMenuItems.map((item) => (
                  (item.roles.includes(user?.role)) && (
                    <MenuItem key={item.text} onClick={() => handleAdminMenuNavigate(item.path)} sx={{ color: 'white' }}>
                      <ListItemIcon sx={{ color: 'white' }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </MenuItem>
                  )
                ))}
              </Menu>
            )}
          </>
        )}
      </List>

      {/* Bottom Logout Button */}
      <List sx={{ mt: 'auto', mb: 2 }}>
        {user && (
          <ListItem disablePadding sx={{ display: 'block' }}>
            <ListItemButton onClick={logout} sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}>
              <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center', color: 'white' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Log Out" sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }} />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </StyledDrawer>
  );
}

export default SideNav;