# LifeSync Desktop (Electron wrapper)

## Run (dev)
1) Install Node.js (LTS)
2) Open a terminal in this folder
3) npm install
4) npm run start

## Build installers
- Windows: npm run dist  (NSIS installer)
- macOS:  npm run dist  (DMG)
- Linux:  npm run dist  (AppImage)

This wrapper loads the local renderer/index.html so there is **no browser UI**.
