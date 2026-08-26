// web-frontend/src/utils/socket.js
import { io } from 'socket.io-client';

// This creates a single Socket.IO client instance for the entire frontend application.
const socket = io('https://g2g-mri-erp-bfw57.ondigitalocean.app', { // Connects to backend on port 5001
  autoConnect: false, // Prevents auto-connection; we will connect manually when user logs in
});

export default socket;