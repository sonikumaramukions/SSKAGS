# Sai Saranya Kirana & General (SSKG) - Katha Manager PWA

This is a Progressive Web App (PWA) built specifically for a small shop owner to manage customer credit accounts (Kathas). It is designed to work completely offline, handle battery death scenarios (auto-save drafts), and run on low-storage devices.

## Features
- **Offline First**: Works 100% offline via Service Workers and IndexedDB.
- **PIN Protection**: Simple PIN screen (1978) to prevent accidental edits.
- **Daily Scheduler**: Automatically adds recurring daily items (like milk) at a specific time.
- **Battery Death Protection**: Forms auto-save drafts to local storage as you type.
- **PDF Generation**: Generates daily summary reports and customer invoices entirely locally.
- **Google Drive Backup**: Export database to compressed JSON and save to Drive (free).
- **Extremely Lightweight**: Less than 3MB. No npm, no node_modules, no image files (uses emojis/SVG). 

## Setup Instructions

Since this is a vanilla HTML/JS/CSS app, you don't need `npm install`.

1. **Serve the app locally:**
   You must serve the app over HTTP/HTTPS for the Service Worker and module scripts to work. Do not just double-click `index.html`.
   - If you have Python: `python3 -m http.server 8000`
   - Or use VS Code Live Server extension.
   - Or use Node: `npx serve .`

2. **Login:**
   Open the app in your browser and enter PIN: **1978**

## How to setup Google Drive Backup

To make the Google Drive Backup feature work, you need to provide a Google OAuth Client ID.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Navigate to **APIs & Services** > **OAuth consent screen** and configure it for "External" users. Add the scope: `https://www.googleapis.com/auth/drive.file`.
4. Navigate to **Credentials** > **Create Credentials** > **OAuth client ID**.
5. Choose **Web application**. 
6. Add your authorized JavaScript origins (e.g., `http://localhost:8000` for testing, and your final deployed URL).
7. Copy the generated **Client ID**.
8. Open `backup.js` in this project folder.
9. Replace `YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com` on line 2 with your actual Client ID.

## PWA Installation (Mobile)

1. Host the files on any static hosting (Vercel, Netlify, GitHub Pages, etc.). Ensure it uses HTTPS.
2. Open the URL in Chrome on Android (or Safari on iOS).
3. Chrome will automatically prompt "Add to Home Screen" after a short time, or you can manually click the browser menu (3 dots) -> "Install App" / "Add to Home screen".
4. Once installed, it behaves like a native app and works offline.
# SSKAGS
