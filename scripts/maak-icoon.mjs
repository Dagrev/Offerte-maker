// Maakt build/icon.png (512 × 512) uit build/icon.svg (TDO V-24). electron-builder maakt daar zelf de
// .ico van. Draai dit alleen opnieuw als het pictogram verandert; icon.png wordt gecommit:
//   pnpm exec electron scripts/maak-icoon.mjs
// Eerst `nativeImage` uit de SVG-data-URL (V-24). Levert dat een leeg beeld (nativeImage decodeert op
// Windows geen SVG), dan tekent een verborgen venster de SVG op een canvas en geeft de PNG terug.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BrowserWindow, app, nativeImage } from 'electron';

const MAAT = 512;
const map = resolve(import.meta.dirname, '..', 'build');
const svg = readFileSync(resolve(map, 'icon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

async function viaCanvas() {
  const venster = new BrowserWindow({ show: false, width: MAAT, height: MAAT });
  try {
    await venster.loadURL('data:text/html;charset=utf-8,<!doctype html><title>icoon</title>');
    const png = await venster.webContents.executeJavaScript(`
      new Promise((klaar, fout) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = ${MAAT}; c.height = ${MAAT};
          c.getContext('2d').drawImage(img, 0, 0, ${MAAT}, ${MAAT});
          klaar(c.toDataURL('image/png'));
        };
        img.onerror = () => fout(new Error('SVG niet te laden'));
        img.src = ${JSON.stringify(dataUrl)};
      })`);
    return nativeImage.createFromDataURL(png);
  } finally {
    venster.destroy();
  }
}

async function maak() {
  let beeld = nativeImage.createFromDataURL(dataUrl);
  const bron = beeld.isEmpty() ? 'canvas' : 'nativeImage';
  if (beeld.isEmpty()) beeld = await viaCanvas();
  if (beeld.isEmpty()) throw new Error('Pictogram is leeg');
  const { width, height } = beeld.getSize();
  if (width !== MAAT || height !== MAAT) beeld = beeld.resize({ width: MAAT, height: MAAT, quality: 'best' });
  writeFileSync(resolve(map, 'icon.png'), beeld.toPNG());
  console.log(`build/icon.png geschreven (${MAAT} × ${MAAT}, via ${bron})`);
}

app.whenReady().then(async () => {
  try {
    await maak();
  } catch (fout) {
    console.error(fout);
    process.exitCode = 1;
  }
  app.quit();
});
