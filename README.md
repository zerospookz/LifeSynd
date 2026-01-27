# LifeSync (Expo + React Native)

## Run locally
```bash
npm install
npx expo start
```
- Press `w` to open in Chrome
- Or scan the QR with Expo Go on your phone

## Run from GitHub (GitHub Pages)
This repo includes an auto-deploy workflow:
`.github/workflows/deploy-pages.yml`

Every push to `main`:
1) builds the web bundle into `dist/`
2) publishes `dist/` to the `gh-pages` branch

### One-time GitHub Pages setting
GitHub → Repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: **gh-pages**
- Folder: **/ (root)**
- Save

Your site will be live at:
`https://zerospookz.github.io/LifeSynd/`

### Important: repo name must match baseUrl
`app.json` includes:
```json
"experiments": { "baseUrl": "/LifeSynd" }
```
If your repo name changes, update that value to `"/<REPO_NAME>"`.
