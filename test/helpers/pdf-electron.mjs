// Echte PDF-weergave voor tests (OFM-015, NFE-021). Vitest draait als Electron-als-Node en heeft geen
// BrowserWindow; deze kleine Electron-app doet §12.3 stap 3 met precies de opties die de test uit
// `printOpties()` en `VERBORGEN_VENSTER` (src/main/pdf/maakPdf.ts) meegeeft.
// Gebruik: electron pdf-electron.mjs <html-bestand> <pdf-uit> <json-met-{venster,opties}>
import { readFileSync, writeFileSync } from 'node:fs';
import { app, BrowserWindow } from 'electron';

const [htmlPad, uitPad, jsonPad] = process.argv.slice(-3);
const { venster: vensterOpties, opties } = JSON.parse(readFileSync(jsonPad, 'utf8'));

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const venster = new BrowserWindow(vensterOpties);
    await venster.loadFile(htmlPad);
    writeFileSync(uitPad, await venster.webContents.printToPDF(opties));
    venster.destroy();
    app.exit(0);
  } catch (fout) {
    console.error(fout);
    app.exit(1);
  }
});
