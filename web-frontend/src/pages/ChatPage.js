// web-frontend/src/pages/ChatPage.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client'; // Import socket.io-client
import { useAuth } from '../contexts/AuthContext'; // To get the authenticated user's info
import socket from '../utils/socket'; // Import our Socket.IO client instance

// Material-UI components
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton, // For reconnect button
  useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh'; // Icon for retry/refresh button

// Socket.IO client instance (should be outside the component)
// Using autoConnect: false to gain manual control over connection attempts.

function ChatPage() {
  const { user, token } = useAuth(); // Get logged-in user and token
  const theme = useTheme(); // Get current theme for styling
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(''); // For errors fetching history (HTTP)
  const [socketError, setSocketError] = useState(''); // For errors with Socket.IO connection (WebSocket)
  const messagesEndRef = useRef(null); // Ref for auto-scrolling to bottom of chat

  // --- Manual Socket Connection Attempt ---
  const connectSocket = () => {
    if (!socket.connected) {
      console.log('Frontend: Attempting to connect socket...');
      setSocketError(''); // Clear previous socket-specific errors before retrying
      socket.connect(); // Manually attempt to connect the socket
    }
  };

  // --- Fetch Chat History ---
  // This useEffect handles fetching historical messages from the backend API.
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!user || !token) { // Ensure user is logged in
        setHistoryError('Authentication token missing. Please log in to load chat history.');
        setLoadingHistory(false);
        return;
      }
      try {
        const response = await fetch('http://localhost:5001/api/chat/history', { // Using PORT 5001
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          // Map historical messages to include current user status for styling
          setMessages(data.map(msg => ({
            ...msg,
            type: 'message', // Distinguish from system messages
            isCurrentUser: msg.sender_id === user?.id, // True if message is from current user
          })));
        } else {
          setHistoryError(data.message || 'Failed to load chat history.');
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setHistoryError('Network error loading chat history. Check backend server and network.');
      } finally {
        setLoadingHistory(false);
      }
    };

    if (user && token) { // Only fetch history and try to connect if user is authenticated
        fetchChatHistory();
        connectSocket(); // Initiate socket connection when user and token are available
    } else {
        // Handle cases where user logs out or token is missing
        setLoadingHistory(false);
        setHistoryError('Please log in to view chat.');
        if (socket.connected) { // Disconnect socket if user logs out while on chat page
            socket.disconnect();
        }
    }
  }, [user, token]); // Dependencies: Re-run when user or token changes

  // --- Socket.IO Event Listeners ---
  // This useEffect sets up and cleans up Socket.IO listeners once per component mount.
  useEffect(() => {
    let isMounted = true; // Flag for unmounted component safety (React StrictMode fix)

    const handleConnect = () => {
      console.log('Frontend: Socket.IO Connected!');
      if (isMounted) {
        setIsConnected(true);
        setSocketError(''); // Clear any socket error on successful connect
        // Add "You joined" system message, preventing duplicates (especially with StrictMode double-invocation)
        setMessages((prevMessages) => {
            if (!prevMessages.some(m => m.type === 'system' && m.text === 'You joined the chat.')) {
                return [...prevMessages, { type: 'system', text: 'You joined the chat.' }];
            }
            return prevMessages;
        });
      }
    };

    const handleDisconnect = () => {
      console.log('Frontend: Socket.IO Disconnected!');
      if (isMounted) {
        setIsConnected(false);
        setMessages((prevMessages) => [...prevMessages, { type: 'system', text: 'You left the chat.' }]);
      }
    };

    const handleChatMessage = (msg) => {
      if (isMounted) {
        const messageWithUser = {
          ...msg,
          isCurrentUser: msg.senderId === user?.id, // Determine if current user's message for styling
          type: 'message',
        };
        setMessages((prevMessages) => [...prevMessages, messageWithUser]);
      }
    };

    const handleConnectError = (err) => {
        console.error('Frontend: Socket connection error:', err.message);
        if (isMounted) {
            setIsConnected(false);
            setSocketError(`Connection failed: ${err.message}. Please retry.`); // Display specific error message
        }
    };

    // Attach listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat message', handleChatMessage);
    socket.on('connect_error', handleConnectError);

    // --- Cleanup function ---
    return () => {
      isMounted = false; // Component is unmounted, prevent further state updates
      // Remove listeners to prevent memory leaks and unexpected behavior
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat message', handleChatMessage);
      socket.off('connect_error', handleConnectError);
      // Optional: Disconnect socket when component unmounts if it's specific to this page
      // socket.disconnect(); // Consider disconnecting only if you want a fresh connection each time
    };
  }, [user]); // 'user' is the primary dependency.

  // --- Auto-scroll to bottom of messages when new messages arrive ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // Depends on 'messages' state

  // --- Send Message Handler ---
  const sendMessage = (event) => {
    event.preventDefault(); // Prevent default form submission
    // Ensure message is not empty, connected, and user is logged in
    if (message.trim() && isConnected && user) {
      const chatMessage = {
        text: message,
        senderId: user.id, // Send the current user's ID to backend
      };
      socket.emit('chat message', chatMessage); // Emit the message via Socket.IO
      setMessage(''); // Clear input field
    }
  };

  // --- Conditional Rendering for Loading/Error States ---
  if (loadingHistory) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading chat history...</Typography>
      </Box>
    );
  }

  if (historyError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {historyError}
        <Button onClick={connectSocket} startIcon={<RefreshIcon />} sx={{ ml: 2 }}>Retry Connection</Button>
      </Alert>
    );
  }

  // --- Main Chat UI Render ---
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Medical Staff Chat Room
      </Typography>

      {/* Connection Status Alert */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Connecting to chat server...
          {socketError && <Typography variant="caption" sx={{ ml: 1 }}>{socketError}</Typography>}
          <Button onClick={connectSocket} startIcon={<RefreshIcon />} sx={{ ml: 2 }}>Retry Connection</Button>
        </Alert>
      )}

      {/* Chat Messages Display Area */}
      <Paper sx={{ flexGrow: 1, overflowY: 'auto', p: 2, mb: 2, display: 'flex', flexDirection: 'column' }}>
        <List sx={{ flexGrow: 1, py: 0 }}>
          {messages.map((msg, index) => (
            <ListItem
              key={index} // Using index as key is generally discouraged, but common for chat where items are only added.
                          // For production, consider a unique message ID from backend.
              sx={{
                justifyContent: msg.type === 'system' ? 'center' : (msg.isCurrentUser ? 'flex-end' : 'flex-start'),
                px: 0, // Remove horizontal padding for list items
              }}
            >
              {msg.type === 'system' ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {msg.text}
                </Typography>
              ) : (
                <Box
                  sx={{
                    maxWidth: '70%', // Limit message bubble width
                    p: 1.5, // Padding inside bubble
                    borderRadius: '10px',
                    // Dynamic background/text color based on sender
                    backgroundColor: msg.isCurrentUser
                      ? 'primary.light' // Current user's bubble (light primary color)
                      : (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300'), // Different grey for dark/light mode
                    color: msg.isCurrentUser
                      ? 'white' // Current user's text color
                      : (theme.palette.mode === 'dark' ? 'white' : 'text.primary'), // Text color adapts to mode
                    boxShadow: 1, // Subtle shadow for bubble
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Sender Username/Full Name */}
                  <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {msg.senderFullName || msg.senderUsername || 'Unknown User'} {/* Prefer full_name from history, then username from live msg */}
                  </Typography>
                  {/* Message Text */}
                  <Typography variant="body1">{msg.text}</Typography>
                  {/* Timestamp */}
                  <Typography variant="caption" sx={{ alignSelf: 'flex-end', mt: 0.5 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              )}
            </ListItem>
          ))}
          <div ref={messagesEndRef} /> {/* Invisible element for auto-scrolling */}
        </List>
      </Paper>

      {/* Message Input and Send Button */}
      <Box component="form" onSubmit={sendMessage} sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!isConnected || !user} // Disable if not connected or not logged in
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button type="submit" endIcon={<SendIcon />} disabled={!isConnected || !user || !message.trim()}>
                  Send
                </Button>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Box>
  );
}

export default ChatPage;