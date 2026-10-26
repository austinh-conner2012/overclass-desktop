// Overclass for Windows, Mac and Linux (Chromebook): the game from xgameshq.com in its own window.
// It's the same game as the website — accounts, multiplayer, the shop, leaderboards — and always
// the latest version. Once you've played online it also starts offline (solo play).
// F11 toggles full screen.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const SITE = 'https://xgameshq.com';
const GAME = SITE + '/portal-arena';

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
    webPreferences: { contextIsolation: true, sandbox: true },
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
}

// No menu bar on Windows / Linux (Alt is the game's aim key, and would pop it up); the Mac keeps its
// standard menu for Cmd+Q, full screen and so on.
if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
