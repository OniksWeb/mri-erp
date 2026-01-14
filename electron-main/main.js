const { app, BrowserWindow, Menu, globalShortcut } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "../web-frontend/gg2g1_fixed.ico"), // <- icon path
  });

  // Load React build from root build/
  const startUrl = `file://${path.join(__dirname, "../build/build/index.html")}`;
  console.log("👉 Loading URL:", startUrl);

  mainWindow.loadURL(startUrl);

  // Remove menu
  Menu.setApplicationMenu(null);

  // ✅ Register shortcut for DevTools (Ctrl+Shift+I / Cmd+Opt+I)
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
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
