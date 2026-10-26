// What the game page can ask the desktop app for: the VSync setting (applied by restarting the app).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overclassDesktop', {
  getVsync: () => ipcRenderer.invoke('overclass:get-vsync'),
  setVsync: on => ipcRenderer.invoke('overclass:set-vsync', !!on),
});
