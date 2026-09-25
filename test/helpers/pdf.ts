import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

// Echte PDF-weergave in tests (OFM-015): start `pdf-electron.mjs` als gewone Electron-app.
const HARNAS = resolve(import.meta.dirname, 'pdf-electron.mjs');
// `require('electron')` in gewone Node geeft het pad naar de Electron-executable; langs vi.mock heen.
const electronPad = createRequire(import.meta.url)('electron') as unknown as string;

export async function echtePdf(html: string, venster: unknown, opties: unknown): Promise<Buffer> {
  const map = mkdtempSync(join(tmpdir(), 'ofm-echtepdf-'));
  try {
    const htmlPad = join(map, 'offerte.html');
    const uitPad = join(map, 'offerte.pdf');
    const jsonPad = join(map, 'opties.json');
    writeFileSync(htmlPad, html, 'utf8');
    writeFileSync(jsonPad, JSON.stringify({ venster, opties }), 'utf8');
    const env = { ...process.env };
    delete env['ELECTRON_RUN_AS_NODE'];
    await promisify(execFile)(electronPad, [HARNAS, htmlPad, uitPad, jsonPad], { env, timeout: 60_000 });
    return readFileSync(uitPad);
  } finally {
    rmSync(map, { recursive: true, force: true });
  }
}
