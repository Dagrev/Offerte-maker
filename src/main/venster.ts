import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, screen, session, type WebContents } from 'electron';

// Hoofdvenster, single instance en Electron-beveiliging (TDO §14.1 stap 1 en 7, §17, NFE-014).

/** CSP letterlijk uit §14.1 stap 7; staat ook als `<meta>` in `src/renderer/index.html`. */
export const CSP =
  "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; frame-src 'self' about:; object-src 'none'";

/**
 * In ontwikkeling: CSP aangevuld met de origin van de vite-dev-server en `ws:`, plus `'unsafe-inline'`
 * voor scripts: @vitejs/plugin-react zet in dev een inline preamble voor React Refresh in de HTML.
 * De `<meta>`-CSP wordt in dev door een vite-plugin weggehaald (electron.vite.config.ts), zodat deze
 * header daar de enige policy is. De gebouwde app krijgt de CSP letterlijk.
 */
export function cspVoor(devUrl: string | undefined): string {
  if (!devUrl) return CSP;
  const origin = new URL(devUrl).origin;
  return CSP.split('; ')
    .map((regel) => {
      if (regel.startsWith('connect-src')) return `${regel} ${origin} ws:`;
      if (regel.startsWith('script-src')) return `${regel} ${origin} 'unsafe-inline'`;
      if (regel.startsWith('default-src')) return `${regel} ${origin}`;
      return regel;
    })
    .join('; ');
}

export function devServerUrl(): string | undefined {
  return app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'];
}

export function rendererHtml(): string {
  return join(import.meta.dirname, '../renderer/index.html');
}

/** Alleen navigeren binnen de eigen app: de dev-server of het eigen `index.html`. */
export function isEigenAdres(url: string, devUrl: string | undefined, htmlPad: string): boolean {
  let doel: URL;
  try {
    doel = new URL(url);
  } catch {
    return false;
  }
  if (devUrl) return doel.origin === new URL(devUrl).origin;
  return doel.protocol === 'file:' && doel.pathname === pathToFileURL(htmlPad).pathname;
}

/** Beperkt elk webContents: geen nieuwe vensters, geen navigatie naar buiten, geen webview. */
export function beveiligWebContents(
  contents: WebContents,
  devUrl: string | undefined,
  htmlPad: string,
): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!isEigenAdres(url, devUrl, htmlPad)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

export function stelCspIn(csp: string): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] },
    });
  });
}

let hoofdvenster: BrowserWindow | null = null;

export function huidigVenster(): BrowserWindow | null {
  return hoofdvenster;
}

/** FE-002: één instantie. Een tweede start zet het bestaande venster terug en geeft het focus. */
export function claimEnkeleInstantie(): boolean {
  if (!app.requestSingleInstanceLock()) return false;
  app.on('second-instance', () => {
    if (!hoofdvenster) return;
    if (hoofdvenster.isMinimized()) hoofdvenster.restore();
    hoofdvenster.focus();
  });
  return true;
}

/**
 * Testhaak: `OFFERTE_MAKER_SCHERM=<n>` (1 = eerste scherm in de volgorde van Electron) opent het
 * venster op dat scherm, zodat E2E-runs en `pnpm dev` op een tweede monitor kunnen draaien terwijl
 * de eigenaar op het eerste doorwerkt. Ongeldig of ontbrekend: geen positie (Electron kiest).
 */
export function vensterPositie(
  waarde: string | undefined,
  schermen: readonly { workArea: { x: number; y: number } }[],
): { x: number; y: number } | undefined {
  const n = Number(waarde?.trim() || Number.NaN);
  if (!Number.isInteger(n) || n < 1 || n > schermen.length) return undefined;
  const { x, y } = schermen[n - 1]!.workArea;
  return { x: x + 40, y: y + 40 };
}

export function maakHoofdvenster(): BrowserWindow {
  const devUrl = devServerUrl();
  const htmlPad = rendererHtml();
  const positie = vensterPositie(process.env['OFFERTE_MAKER_SCHERM'], screen.getAllDisplays());
  const venster = new BrowserWindow({
    show: false,
    ...positie,
    // Vensterminimum (TDO §13.2); ontworpen voor 1366 × 768 en groter.
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  hoofdvenster = venster;

  beveiligWebContents(venster.webContents, devUrl, htmlPad);
  venster.once('ready-to-show', () => {
    venster.maximize();
    venster.show();
  });
  venster.on('closed', () => {
    if (hoofdvenster === venster) hoofdvenster = null;
  });

  if (devUrl) void venster.loadURL(devUrl);
  else void venster.loadFile(htmlPad);
  return venster;
}
