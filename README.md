# Overclass desktop

The desktop app for [Overclass](https://xgameshq.com/portal-arena): the same game as the website — accounts,
multiplayer, the shop and leaderboards — in its own window, always up to date. Once you've played online it
also starts offline for solo play.

## Download

Get the latest version from [Releases](../../releases/latest):

| | File |
|---|---|
| Windows | `Overclass-Setup.exe` |
| Mac (Apple Silicon and Intel) | `Overclass-mac.dmg` |
| Chromebook / Linux | `Overclass-linux-amd64.deb` (ARM Chromebooks: `Overclass-linux-arm64.deb`) |

- **Windows:** run the installer. If Windows says it "protected your PC", click **More info → Run anyway** (the app isn't signed with a paid certificate).
- **Mac:** open the .dmg and drag Overclass into Applications. The first time, right-click it and choose **Open** (or System Settings → Privacy & Security → **Open Anyway**).
- **Chromebook:** the simplest way is the **Install app** button in the game's menu at xgameshq.com/portal-arena. For the file: turn on Linux (Settings → Advanced → Developers), then open the .deb from the Files app.

F11 toggles full screen.

## Building

```
npm install
npm start          # run it
npm run dist       # build for this computer into dist/
```

Pushing a tag like `v1.0.1` builds Windows, Mac and Linux on GitHub and publishes a release.
