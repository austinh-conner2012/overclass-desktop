// The app moved from xgameshq.com to overclasshq.com. Everything the game keeps on this computer
// (your sign-in, settings, keybinds, story progress, Warpath unlocks, bests...) is stored per
// website, so on the first start after the move it's copied across once, before the game opens.
//
// It never needs the old site to be reachable: both addresses are answered here, inside the app, with
// an empty page, just long enough to read the old storage and write the new one. Anything already
// saved under the new address is kept (it's newer).
const { BrowserWindow, net, session } = require('electron');

const PAGE = '/__overclass-move__';
const EMPTY = '<!doctype html><meta charset="utf-8"><title>Overclass</title>';

// Copies localStorage from `from` to `to` (both origins, like 'https://xgameshq.com').
// Resolves to { copied, kept } or null if it couldn't run; it never rejects and gives up after 8 s.
function copyStorage(from, to) {
  const ses = session.defaultSession;
  const hosts = new Set([new URL(from).host, new URL(to).host]);
  let win = null;
  const run = (async () => {
    // Answer the two move pages ourselves; every other https request goes out as normal.
    ses.protocol.handle('https', req => {
      const u = new URL(req.url);
      if (hosts.has(u.host) && u.pathname === PAGE) return new Response(EMPTY, { headers: { 'content-type': 'text/html' } });
      return net.fetch(req, { bypassCustomProtocolHandlers: true });
    });
    win = new BrowserWindow({ show: false, webPreferences: { session: ses, contextIsolation: true, sandbox: true } });
    await win.loadURL(from + PAGE);
    const old = await win.webContents.executeJavaScript(
      'JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))');
    await win.loadURL(to + PAGE);
    return win.webContents.executeJavaScript(`(() => {
      const old = ${old}; let copied = 0, kept = 0;
      for (const k in old) { if (localStorage.getItem(k) === null) { localStorage.setItem(k, old[k]); copied++; } else kept++; }
      return { copied, kept };
    })()`);
  })();
  const timeout = new Promise(ok => setTimeout(() => ok(null), 8000));
  return Promise.race([run.catch(() => null), timeout]).finally(() => {
    try { ses.protocol.unhandle('https'); } catch (e) {}
    try { if (win && !win.isDestroyed()) win.destroy(); } catch (e) {}
  });
}

module.exports = { copyStorage };
