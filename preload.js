// What the game page can ask the desktop app for: the VSync setting (applied by restarting the app),
// its version, and Check for updates.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overclassDesktop', {
  getVsync: () => ipcRenderer.invoke('overclass:get-vsync'),
  setVsync: on => ipcRenderer.invoke('overclass:set-vsync', !!on),
  version: () => ipcRenderer.invoke('overclass:version'),
  checkForUpdates: () => ipcRenderer.invoke('overclass:check-updates'),
});
