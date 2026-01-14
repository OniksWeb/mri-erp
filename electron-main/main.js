const { app, BrowserWindow, Menu, globalShortcut } = require("electron");
const path = require("path");

// 1. Disable Hardware Acceleration (Crucial for preventing input lag/freezing on Windows)
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "G2G Medical MRI ERP", // Good practice to set a title
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 2. Prevent the app from "napping" in the background (Fixes input requiring minimize/maximize)
      backgroundThrottling: false, 
    },
    // Ensure this path matches exactly where your icon lives relative to this file
    icon: path.join(__dirname, "../web-frontend/gg2g1_fixed.ico"), 
  });

  // ✅ FIX: Point directly to the root 'build' folder. 
  // We use ".." to go up from "electron-main" to root, then into "build".
  const startUrl = `file://${path.join(__dirname, "../build/index.html")}`;
  console.log("👉 Loading URL:", startUrl);

  mainWindow.loadURL(startUrl);

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Register shortcut for DevTools (Ctrl+Shift+I / Cmd+Opt+I)
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Force focus when ready (Double insurance against freezing)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});