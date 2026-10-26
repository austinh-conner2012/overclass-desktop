// Keeps the desktop app itself up to date. (The game inside always updates by itself — it comes
// straight from the website.) Checks GitHub for a newer release when the app starts and every few
// hours after, and whenever you press Settings → Check for updates in the game:
//   Windows: downloads the new installer in the background; restart now, or it installs when you quit.
//   Mac: downloads the new app and swaps it in when you restart (or when you quit).
//   Linux: says there's a new version and opens the download (installing a .deb needs your password).
// Check for updates doesn't ask: if there's a new version it fetches it and restarts into it.
const { app, dialog, net, shell } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'austinh-conner2012/overclass-desktop';
const RELEASES = 'https://github.com/' + REPO + '/releases/latest';
const CHECK_EVERY = 4 * 60 * 60 * 1000;

const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
function latestRelease() {
  return net.fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { 'User-Agent': 'Overclass', Accept: 'application/vnd.github+json' } })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
}
function askRestart(win, version, restart) {
  dialog.showMessageBox(win, {
    type: 'info', title: 'Update ready', message: 'Overclass ' + version + ' is ready.',
    detail: 'Restart now to update, or it updates the next time you close the app.',
    buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
  }).then(r => { if (r.response === 0) restart(); });
}
function notify(win, version) {
  dialog.showMessageBox(win, {
    type: 'info', title: 'Update available', message: 'Overclass ' + version + ' is out.',
    detail: 'Download it to update the app. (The game itself is always up to date.)',
    buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1,
  }).then(r => { if (r.response === 0) shell.openExternal(RELEASES); });
}

// ---- Windows: electron-updater does it all (the installer runs silently) ----
let winUpdater = null, winReady = null, winApplyNow = false;
function windowsUpdates(win) {
  const { autoUpdater } = require('electron-updater');
  winUpdater = autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => {
    if (winReady) return;
    winReady = info.version;
    if (winApplyNow) autoUpdater.quitAndInstall(true, true);       // Check for updates: straight in
    else askRestart(win, info.version, () => autoUpdater.quitAndInstall(true, true));
  });
  autoUpdater.on('error', () => {});
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, CHECK_EVERY);
}
async function windowsNow() {
  if (winReady) { winUpdater.quitAndInstall(true, true); return { status: 'restarting', version: winReady }; }
  const r = await winUpdater.checkForUpdates();
  const version = r && r.updateInfo && r.updateInfo.version;
  if (!version || !newer(version, app.getVersion())) return { status: 'none' };
  winApplyNow = true;                                                // installs and restarts when the download's done
  return { status: 'restarting', version };
}

// ---- Mac: fetch the new app, swap it in on restart ----
let macPending = null, macRelaunch = false, macBusy = null;
// Downloads a newer app if there is one: 'none', 'ready' (macPending set), 'download' (can't replace it here).
function macFetch() {
  if (macPending) return Promise.resolve({ status: 'ready', version: macPending.version });
  if (macBusy) return macBusy;
  macBusy = (async () => {
    const rel = await latestRelease();
    const version = rel && String(rel.tag_name || '').replace(/^v/, '');
    if (!version || !newer(version, app.getVersion())) return { status: 'none' };
    const asset = (rel.assets || []).find(a => a.name === 'Overclass-mac.zip');
    const appPath = path.resolve(path.dirname(process.execPath), '..', '..');
    if (!asset || !appPath.endsWith('.app')) return { status: 'none' };
    try { fs.accessSync(path.dirname(appPath), fs.constants.W_OK); }
    catch (e) { return { status: 'download', version }; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overclass-update-'));
    try {
      const res = await net.fetch(asset.browser_download_url);
      if (!res.ok) throw new Error('download ' + res.status);
      const zip = path.join(dir, 'update.zip');
      fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
      await new Promise((ok, no) => execFile('ditto', ['-x', '-k', zip, dir], err => (err ? no(err) : ok())));
      const fresh = path.join(dir, 'Overclass.app');
      if (!fs.existsSync(fresh)) throw new Error('no app in the download');
      macPending = { fresh, appPath, dir, version };
      return { status: 'ready', version };
    } catch (e) {
      fs.rmSync(dir, { recursive: true, force: true });
      return { status: 'error' };
    }
  })().finally(() => { macBusy = null; });
  return macBusy;
}
// After the app has quit: move the old app aside, put the new one in its place (putting the old
// one back if that fails), and reopen it if it's restarting.
function macSwap() {
  if (!macPending) return;
  const { fresh, appPath, dir } = macPending;
  macPending = null;
  const script = 'while kill -0 "$PID" 2>/dev/null; do sleep 0.2; done; ' +
    'rm -rf "$APP.old"; if mv "$APP" "$APP.old"; then if mv "$NEW" "$APP"; then rm -rf "$APP.old"; else mv "$APP.old" "$APP"; fi; fi; ' +
    'xattr -dr com.apple.quarantine "$APP" 2>/dev/null; if [ "$RELAUNCH" = 1 ]; then open "$APP"; fi; rm -rf "$DIR"';
  spawn('/bin/sh', ['-c', script], {
    detached: true, stdio: 'ignore',
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', PID: String(process.pid), APP: appPath, NEW: fresh, DIR: dir, RELAUNCH: macRelaunch ? '1' : '0' },
  }).unref();
}
const macRestart = () => { macRelaunch = true; app.quit(); };
function macUpdates(win) {
  app.on('will-quit', macSwap);
  const check = () => macFetch().then(r => {
    if (r.status === 'ready') askRestart(win, r.version, macRestart);
    else if (r.status === 'download') notify(win, r.version);
  });
  check();
  setInterval(check, CHECK_EVERY);
}
async function macNow() {
  const r = await macFetch();
  if (r.status === 'ready') { setTimeout(macRestart, 600); return { status: 'restarting', version: r.version }; }
  if (r.status === 'download') { shell.openExternal(RELEASES); return { status: 'download', version: r.version }; }
  return r;
}

// ---- Linux: tell them, and open the download ----
let linuxTold = '';
async function linuxLatest() {
  const rel = await latestRelease();
  const version = rel && String(rel.tag_name || '').replace(/^v/, '');
  return version && newer(version, app.getVersion()) ? version : null;
}
async function linuxCheck(win) {
  const version = await linuxLatest();
  if (version && linuxTold !== version) { linuxTold = version; notify(win, version); }
}

exports.startUpdates = function (win) {
  if (!app.isPackaged) return;                                        // running from source: nothing to update
  if (process.platform === 'win32') windowsUpdates(win);
  else if (process.platform === 'darwin') macUpdates(win);
  else { linuxCheck(win); setInterval(() => linuxCheck(win), CHECK_EVERY); }
};

// The game's Check for updates button. Resolves to { status: 'none' | 'restarting' | 'download' | 'error', version }.
exports.checkNow = async function () {
  if (!app.isPackaged) return { status: 'none' };
  try {
    if (process.platform === 'win32') return winUpdater ? await windowsNow() : { status: 'none' };
    if (process.platform === 'darwin') return await macNow();
    const version = await linuxLatest();
    if (!version) return { status: 'none' };
    shell.openExternal(RELEASES);
    return { status: 'download', version };
  } catch (e) {
    return { status: 'error' };
  }
};
