// Overclass for Windows, Mac and Linux (Chromebook): the game from xgameshq.com in its own window.
// It's the same game as the website — accounts, multiplayer, the shop, leaderboards — and always
// the latest version. Once you've played online it also starts offline (solo play).
// F11 toggles full screen.
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { startUpdates, checkNow } = require('./updater');

const SITE = 'https://xgameshq.com';
const GAME = SITE + '/portal-arena';

// Settings the game can change (Graphics → VSync); they need a restart, so they're read up front.
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (e) { return {}; } }
const settings = readSettings();

// Graphics: always the fast GPU on laptops that have two, and WebGL even on graphics chips Chromium
// is wary of (instead of slow software drawing). Windows: the fast Direct3D 11 path, and nothing
// forced on top of it — forced rasterization / zero-copy trip some Windows drivers, and when the GPU
// process falls over Chromium quietly draws everything in software. The Mac keeps those (fine there).
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-angle', 'd3d11');
} else if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}
// Never slow the game down for being in the background or partly covered (timers, frames, online play).
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// VSync off: no frame-rate limit (the game's FPS cap keeps it steady).
if (settings.vsync === false) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}

ipcMain.handle('overclass:get-vsync', () => settings.vsync !== false);
ipcMain.handle('overclass:version', () => app.getVersion());
ipcMain.handle('overclass:check-updates', () => checkNow());   // the game's Settings → Check for updates
ipcMain.handle('overclass:set-vsync', (e, on) => {
  settings.vsync = !!on;
  try { fs.writeFileSync(settingsFile, JSON.stringify(settings)); } catch (err) { return false; }
  app.relaunch();
  app.exit(0);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'Overclass',
    backgroundColor: '#090b10',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,                                   // keep full speed (and online play) when the window isn't focused
    },
  });
  win.loadURL(GAME);

  // xgameshq.com pages (the game, signing in) stay in the app; any other link opens in your browser.
  const onSite = url => url === SITE || url.startsWith(SITE + '/') || url.startsWith('file:');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (onSite(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!onSite(url)) { e.preventDefault(); shell.openExternal(url); }
  });

  // Can't reach the game (and it isn't saved for offline yet): a page with a Try again button.
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));   // -3: a load we cancelled ourselves
  });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  return win;
}

// No menu bar on Windows / Linux (Alt is the game's aim key, and would pop it up); the Mac keeps its
// standard menu for Cmd+Q, full screen and so on.
if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  const win = createWindow();
  startUpdates(win);                                                 // keeps this app itself up to date
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
