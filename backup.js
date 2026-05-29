// Backup System — Simple file-based backup with Share API support and Google Drive

let CLIENT_ID = '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient;
let accessToken = null;

function loadGoogleScript() {
    return new Promise((resolve) => {
        if (window.google && window.google.accounts) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

async function getBackupData() {
    return {
        customers: await dbOps.getCustomers(),
        katha_entries: await db.katha_entries.toArray(),
        payments: await db.payments.toArray(),
        daily_configs: await db.daily_configs.toArray(),
        history_log: await db.history_log.toArray(),
        _meta: {
            exportedAt: new Date().toISOString(),
            version: 'sskg_v2'
        }
    };
}

async function exportLocalBackup() {
    try {
        const data = await getBackupData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `sskg_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Record backup time
        localStorage.setItem('sskg_last_backup', Date.now().toString());
        updateBackupStatus();
    } catch (e) {
        console.error("Local backup failed", e);
        alert("Failed to export backup: " + e.message);
    }
}

async function shareBackup() {
    try {
        const statusEl = document.getElementById('backup-status');
        if (statusEl) statusEl.textContent = "Preparing backup...";

        const data = await getBackupData();
        const jsonStr = JSON.stringify(data);
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `sskg_backup_${dateStr}.json`;

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const file = new File([blob], fileName, { type: 'application/json' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'SSKG Katha Backup',
                text: `Katha app backup from ${dateStr}. Save this file safely!`
            });

            // Record backup time on successful share
            localStorage.setItem('sskg_last_backup', Date.now().toString());
            if (statusEl) statusEl.textContent = `✅ Backup shared successfully: ${new Date().toLocaleString()}`;
            updateBackupReminder();
        } else {
            // Fallback: try downloading and inform user
            if (statusEl) statusEl.textContent = "Sharing not supported on this device. Downloading instead...";
            exportLocalBackup();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            // User cancelled the share
            const statusEl = document.getElementById('backup-status');
            if (statusEl) statusEl.textContent = "Share cancelled.";
            return;
        }
        console.error("Share backup failed", e);
        alert("Failed to share backup. Trying download instead...");
        exportLocalBackup();
    }
}

async function importLocalBackup(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.customers || !data.katha_entries) {
            throw new Error("Invalid backup file format. Missing customers or katha_entries.");
        }

        if (!confirm(`This will replace ALL current data with the backup.\n\nBackup contains:\n• ${data.customers.length} customers\n• ${data.katha_entries.length} katha entries\n• ${(data.payments || []).length} payments\n\nAre you sure?`)) {
            return;
        }

        await db.transaction('rw', db.customers, db.katha_entries, db.payments, db.daily_configs, db.history_log, async () => {
            await db.customers.clear();
            await db.katha_entries.clear();
            await db.payments.clear();
            await db.daily_configs.clear();
            await db.history_log.clear();

            await db.customers.bulkAdd(data.customers);
            await db.katha_entries.bulkAdd(data.katha_entries);
            if (data.payments) await db.payments.bulkAdd(data.payments);
            if (data.daily_configs) await db.daily_configs.bulkAdd(data.daily_configs);
            if (data.history_log) await db.history_log.bulkAdd(data.history_log);
        });

        alert("✅ Backup imported successfully! Reloading app...");
        window.location.reload();
    } catch (e) {
        console.error("Import failed", e);
        alert("Failed to import backup: " + e.message);
    }
}

function updateBackupStatus() {
    const statusEl = document.getElementById('backup-status');
    if (!statusEl) return;

    const lastBackup = localStorage.getItem('sskg_last_backup');
    if (lastBackup) {
        const date = new Date(parseInt(lastBackup));
        const daysAgo = Math.floor((Date.now() - parseInt(lastBackup)) / (24 * 60 * 60 * 1000));
        statusEl.textContent = `Last backup: ${date.toLocaleDateString('en-GB')} (${daysAgo === 0 ? 'today' : daysAgo + ' days ago'})`;
    } else {
        statusEl.textContent = "No backup taken yet. Please backup your data regularly!";
    }
}

function updateBackupReminder() {
    const banner = document.getElementById('backup-reminder-banner');
    if (!banner) return;

    const lastBackup = localStorage.getItem('sskg_last_backup');
    if (!lastBackup) {
        banner.style.display = 'flex';
        banner.querySelector('span').textContent = '⚠️ You have never backed up your data!';
        return;
    }

    const daysSinceBackup = Math.floor((Date.now() - parseInt(lastBackup)) / (24 * 60 * 60 * 1000));
    if (daysSinceBackup >= 7) {
        banner.style.display = 'flex';
        banner.querySelector('span').textContent = `⚠️ Last backup was ${daysSinceBackup} days ago!`;
    } else {
        banner.style.display = 'none';
    }
}

// --- Google Drive Integration ---

async function connectDrive() {
    if (!navigator.onLine) {
        alert("Internet connection required for Google Drive Backup");
        return;
    }

    const clientIdInput = document.getElementById('gdrive-client-id').value.trim();
    if (clientIdInput) {
        CLIENT_ID = clientIdInput;
        localStorage.setItem('sskg_gdrive_client_id', CLIENT_ID);
    } else {
        const storedId = localStorage.getItem('sskg_gdrive_client_id');
        if (storedId) {
            CLIENT_ID = storedId;
        } else {
            alert("Please paste your Google OAuth Client ID first.");
            return;
        }
    }
    
    await loadGoogleScript();
    
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                document.getElementById('drive-connect-btn').style.display = 'none';
                document.getElementById('drive-backup-btn').style.display = 'inline-block';
                document.getElementById('drive-restore-btn').style.display = 'inline-block';
                const statusEl = document.getElementById('backup-status');
                if(statusEl) statusEl.textContent = "Connected to Google Drive";
                
                // Save state
                localStorage.setItem('sskg_drive_connected', 'true');
            }
        },
    });
    
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function backupToDrive() {
    if (!accessToken) {
        alert("Not connected to Google Drive. Please connect first.");
        return;
    }
    
    try {
        const statusEl = document.getElementById('backup-status');
        if (statusEl) statusEl.textContent = "Compressing data...";
        
        const data = await getBackupData();
        const jsonStr = JSON.stringify(data);
        
        // Compress using LZ-String
        const compressed = LZString.compressToUTF16(jsonStr);
        
        if (statusEl) statusEl.textContent = "Uploading to Drive...";
        
        const metadata = {
            name: `sskg_backup_${new Date().toISOString().split('T')[0]}.txt`,
            mimeType: 'text/plain',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([compressed], { type: 'text/plain' }));

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            body: form
        });

        if (res.ok) {
            if (statusEl) statusEl.textContent = `✅ Google Drive Backup successful: ${new Date().toLocaleString()}`;
            localStorage.setItem('sskg_last_backup', Date.now().toString());
            updateBackupReminder();
        } else {
            throw new Error("Upload failed. Status: " + res.status);
        }
        
    } catch (e) {
        console.error("Drive backup failed", e);
        const statusEl = document.getElementById('backup-status');
        if (statusEl) statusEl.textContent = "Drive backup failed: " + e.message;
        alert("Google Drive backup failed. Try the share option instead.");
    }
}


// UI Bindings
document.getElementById('export-local-btn').addEventListener('click', exportLocalBackup);
document.getElementById('share-backup-btn').addEventListener('click', shareBackup);

document.getElementById('import-local-file').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importLocalBackup(e.target.files[0]);
    }
});

// Google Drive bindings
document.getElementById('drive-connect-btn').addEventListener('click', connectDrive);
document.getElementById('drive-backup-btn').addEventListener('click', backupToDrive);
document.getElementById('drive-restore-btn').addEventListener('click', () => {
    alert("To restore from Drive, download the backup file from your Google Drive app, then use the 'Import Backup (JSON)' option below.");
});

// Backup reminder button
const reminderBtn = document.getElementById('reminder-backup-btn');
if (reminderBtn) {
    reminderBtn.addEventListener('click', shareBackup);
}

// Show backup status and reminder on load
updateBackupStatus();
updateBackupReminder();

// Initialize Google Drive UI state if previously connected
const savedClientId = localStorage.getItem('sskg_gdrive_client_id');
if (savedClientId) {
    document.getElementById('gdrive-client-id').value = savedClientId;
}
if (localStorage.getItem('sskg_drive_connected') === 'true') {
    const statusEl = document.getElementById('backup-status');
    if(statusEl) statusEl.textContent = "Google Drive was previously connected. Click Connect to refresh session.";
}
