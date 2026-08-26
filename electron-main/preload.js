// electron-main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose Electron APIs to the renderer process (your React app)
contextBridge.exposeInMainWorld('electronAPI', {
    // Example: Sending a message from renderer to main process
    sendNotification: (message) => ipcRenderer.send('notify', message),

    // Example: Invoking a main process method and getting a response (for future use)
    // invokeSomeMethod: (args) => ipcRenderer.invoke('some-sync-operation', args),

    // You can add more specific APIs here as needed for your app's interactions
    // e.g., for showing native dialogs, accessing local file system (carefully!)
});

// You can also expose Node.js versions for debugging/information (optional)
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});