// What the game page can ask the desktop app for: the VSync setting (applied by restarting the app),
// its version, Check for updates, and the window's size.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overclassDesktop', {
  getVsync: () => ipcRenderer.invoke('overclass:get-vsync'),
  setVsync: on => ipcRenderer.invoke('overclass:set-vsync', !!on),
  version: () => ipcRenderer.invoke('overclass:version'),
  checkForUpdates: () => ipcRenderer.invoke('overclass:check-updates'),
  windowSizes: () => ipcRenderer.invoke('overclass:window-sizes'),              // Settings → Graphics → Window size
  setWindowSize: size => ipcRenderer.invoke('overclass:set-window-size', String(size)),
});
