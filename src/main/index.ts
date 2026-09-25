import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

// Minimaal skelet (OFM-001). Single instance, maximaliseren, CSP en paden volgen in OFM-002
// (venster.ts, opstart.ts, paden.ts).
function maakVenster(): void {
  const venster = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  venster.once('ready-to-show', () => venster.show());

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) {
    void venster.loadURL(devUrl);
  } else {
    void venster.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  maakVenster();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) maakVenster();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
