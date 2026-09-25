import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const nep = vi.hoisted(() => {
  const appHandlers = new Map<string, Handler>();
  const vensters: NepVenster[] = [];
  class NepContents {
    handlers = new Map<string, Handler>();
    openHandler: (() => unknown) | undefined;
    setWindowOpenHandler(fn: () => unknown): void {
      this.openHandler = fn;
    }
    on(naam: string, fn: Handler): this {
      this.handlers.set(naam, fn);
      return this;
    }
  }
  class NepVenster {
    opties: unknown;
    webContents = new NepContents();
    handlers = new Map<string, Handler>();
    geladen: string[] = [];
    maximize = vi.fn();
    show = vi.fn();
    restore = vi.fn();
    focus = vi.fn();
    isMinimized = vi.fn(() => true);
    constructor(opties: unknown) {
      this.opties = opties;
      vensters.push(this);
    }
    once(naam: string, fn: Handler): this {
      this.handlers.set(naam, fn);
      return this;
    }
    on(naam: string, fn: Handler): this {
      this.handlers.set(naam, fn);
      return this;
    }
    loadURL(url: string): Promise<void> {
      this.geladen.push(url);
      return Promise.resolve();
    }
    loadFile(pad: string): Promise<void> {
      this.geladen.push(pad);
      return Promise.resolve();
    }
  }
  const headerCallbacks: Handler[] = [];
  return {
    appHandlers,
    vensters,
    NepContents,
    headerCallbacks,
    app: {
      isPackaged: false,
      requestSingleInstanceLock: vi.fn(() => true),
      on: vi.fn((naam: string, fn: Handler) => appHandlers.set(naam, fn)),
    },
    BrowserWindow: NepVenster,
    session: {
      defaultSession: {
        webRequest: { onHeadersReceived: vi.fn((fn: Handler) => headerCallbacks.push(fn)) },
      },
    },
  };
});

vi.mock('electron', () => ({ app: nep.app, BrowserWindow: nep.BrowserWindow, session: nep.session }));

const venster = await import('./venster');
const { CSP, beveiligWebContents, claimEnkeleInstantie, cspVoor, devServerUrl, huidigVenster, isEigenAdres } =
  venster;

beforeEach(() => {
  nep.vensters.length = 0;
  nep.app.isPackaged = false;
  delete process.env['ELECTRON_RENDERER_URL'];
});

describe('CSP', () => {
  it('is letterlijk de CSP uit §14.1', () => {
    expect(CSP).toBe(
      "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
        "script-src 'self'; connect-src 'self'; frame-src 'self' about:; object-src 'none'",
    );
    expect(cspVoor(undefined)).toBe(CSP);
  });

  it('krijgt in dev de dev-server-origin en ws: erbij', () => {
    const csp = cspVoor('http://localhost:5173/');
    expect(csp).toContain("default-src 'self' http://localhost:5173;");
    expect(csp).toContain("connect-src 'self' http://localhost:5173 ws:;");
    expect(csp).toContain("script-src 'self' http://localhost:5173 'unsafe-inline';");
    expect(csp).toContain("object-src 'none'");
  });

  it('zet de CSP in de responseheader', () => {
    venster.stelCspIn(CSP);
    const callback = vi.fn();
    const handler = nep.headerCallbacks.at(-1);
    handler?.({ responseHeaders: { 'X-Iets': ['1'] } }, callback);
    expect(callback).toHaveBeenCalledWith({
      responseHeaders: { 'X-Iets': ['1'], 'Content-Security-Policy': [CSP] },
    });
  });
});

describe('devServerUrl', () => {
  it('alleen buiten de verpakte app', () => {
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173';
    expect(devServerUrl()).toBe('http://localhost:5173');
    nep.app.isPackaged = true;
    expect(devServerUrl()).toBeUndefined();
  });
});

describe('isEigenAdres', () => {
  const html = join('C:\\app', 'out', 'renderer', 'index.html');

  it('staat in dev alleen de dev-server toe', () => {
    expect(isEigenAdres('http://localhost:5173/iets', 'http://localhost:5173', html)).toBe(true);
    expect(isEigenAdres('https://example.com/', 'http://localhost:5173', html)).toBe(false);
  });

  it('staat in de build alleen het eigen index.html toe', () => {
    expect(isEigenAdres(pathToFileURL(html).href, undefined, html)).toBe(true);
    expect(isEigenAdres(pathToFileURL(html).href + '#/detail', undefined, html)).toBe(true);
    expect(isEigenAdres('file:///C:/Windows/win.ini', undefined, html)).toBe(false);
    expect(isEigenAdres('https://example.com/', undefined, html)).toBe(false);
    expect(isEigenAdres('geen url', undefined, html)).toBe(false);
  });
});

describe('beveiligWebContents', () => {
  it('weigert nieuwe vensters, externe navigatie en webviews', () => {
    const contents = new nep.NepContents();
    beveiligWebContents(contents as never, 'http://localhost:5173', 'x');
    expect(contents.openHandler?.()).toEqual({ action: 'deny' });

    const naarBuiten = { preventDefault: vi.fn() };
    contents.handlers.get('will-navigate')?.(naarBuiten, 'https://example.com/');
    expect(naarBuiten.preventDefault).toHaveBeenCalled();

    const binnen = { preventDefault: vi.fn() };
    contents.handlers.get('will-navigate')?.(binnen, 'http://localhost:5173/');
    expect(binnen.preventDefault).not.toHaveBeenCalled();

    const webview = { preventDefault: vi.fn() };
    contents.handlers.get('will-attach-webview')?.(webview);
    expect(webview.preventDefault).toHaveBeenCalled();
  });
});

describe('maakHoofdvenster', () => {
  it('maakt een verborgen venster met de vaste webPreferences en toont het gemaximaliseerd', () => {
    const v = venster.maakHoofdvenster() as unknown as InstanceType<typeof nep.BrowserWindow>;
    const opties = v.opties as { show: boolean; webPreferences: Record<string, unknown> };
    expect(opties.show).toBe(false);
    expect(Object.keys(opties.webPreferences).sort()).toEqual(
      ['contextIsolation', 'nodeIntegration', 'preload', 'sandbox'].sort(),
    );
    expect(opties.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
    expect(String(opties.webPreferences['preload'])).toMatch(/preload[\\/]index\.cjs$/);
    expect(v.geladen[0]).toMatch(/renderer[\\/]index\.html$/);

    v.handlers.get('ready-to-show')?.();
    expect(v.maximize).toHaveBeenCalled();
    expect(v.show).toHaveBeenCalled();
    expect(huidigVenster()).toBe(v);

    v.handlers.get('closed')?.();
    expect(huidigVenster()).toBeNull();
  });

  it('laadt in dev de dev-server', () => {
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173';
    const v = venster.maakHoofdvenster() as unknown as InstanceType<typeof nep.BrowserWindow>;
    expect(v.geladen[0]).toBe('http://localhost:5173');
  });
});

describe('claimEnkeleInstantie', () => {
  it('geeft false zonder lock', () => {
    nep.app.requestSingleInstanceLock.mockReturnValueOnce(false);
    expect(claimEnkeleInstantie()).toBe(false);
  });

  it('zet bij een tweede start het venster terug en geeft het focus', () => {
    expect(claimEnkeleInstantie()).toBe(true);
    const tweede = nep.appHandlers.get('second-instance');
    const v = venster.maakHoofdvenster() as unknown as InstanceType<typeof nep.BrowserWindow>;
    tweede?.();
    expect(v.restore).toHaveBeenCalled();
    expect(v.focus).toHaveBeenCalled();

    v.handlers.get('closed')?.();
    expect(() => tweede?.()).not.toThrow();
  });
});
