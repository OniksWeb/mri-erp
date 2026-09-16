const { app, BrowserWindow, Menu, globalShortcut, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { autoUpdater } = require('electron-updater');

app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
      webSecurity: false,
    },
    icon: path.join(app.getAppPath(), "web-frontend/gg2g1_fixed.ico"),
  });

  mainWindow.maximize();

  // ✅ Target the app directory inside unpacked resources first
  let indexPath = path.join(app.getAppPath(), 'build', 'index.html');

  if (app.isPackaged) {
    indexPath = path.join(process.resourcesPath, 'app', 'build', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.resourcesPath, 'build', 'index.html');
    }
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'index.html');
    }
  }

  console.log("🔍 Resolved index.html path:", indexPath);
  console.log("📂 File exists?", fs.existsSync(indexPath));

  const startUrl = pathToFileURL(indexPath).toString();
  mainWindow.loadURL(startUrl).catch(err => {
    console.error("Failed to load URL:", err);
  });

  Menu.setApplicationMenu(null);

  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (app.isPackaged) {
      // ✅ Explicitly set feed provider if auto-detection fails
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'OniksWeb',
        repo: 'mri-erp'
      });
      
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.log('Auto-update check failed:', err);
      });
    }
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

// ==========================================
// 🚀 AUTO-UPDATER EVENTS
// ==========================================

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Found',
    message: 'A new update for the G2G ERP is available. Downloading in the background...',
    buttons: ['Okay']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'question',
    title: 'Update Ready',
    message: 'The update has been downloaded. Restart the application to apply the changes.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.log('Updater Error: ', err.message);
});