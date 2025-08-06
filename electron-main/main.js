// electron-main/main.js
const { app, BrowserWindow, ipcMain } = require('electron'); // Added ipcMain for future communication
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow; // Keep a global reference of the window object

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false, // Security best practice: Renderer cannot directly access Node.js
            contextIsolation: true, // Security best practice: Isolate preload script from renderer global scope
            preload: path.join(__dirname, 'preload.js') // Path to your preload script
        }
    });

    // Load the React app.
    // In development, load from React's dev server.
    // In production, load from the built React app's index.html.
    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000' // React's default dev server port
            : `file://${path.join(__dirname, '../web-frontend/build/index.html')}` // Path to built React app
    );

    // Open DevTools in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- IPC Main Handlers (for future Electron <-> React communication) ---
ipcMain.on('notify', (event, message) => {
    // This is where you would handle notifications, e.g., using Electron's Notification API
    console.log('Received notification from renderer:', message);
    // Example: new Notification({ title: 'App Notification', body: message }).show();
});

// Example: ipcMain.handle('some-sync-operation', async (event, args) => { /* ... */ });