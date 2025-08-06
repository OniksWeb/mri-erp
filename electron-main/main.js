// electron-main/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

// Define the URL for your live frontend on Render
const LIVE_FRONTEND_URL = 'https://mri-erp-frontend.onrender.com'; // <-- REPLACE THIS WITH YOUR ACTUAL LIVE URL

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the appropriate URL based on the environment
    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000'
            : LIVE_FRONTEND_URL
    );

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('notify', (event, message) => {
    console.log('Received notification from renderer:', message);
});