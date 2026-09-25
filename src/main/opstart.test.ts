import { beforeEach, describe, expect, it, vi } from 'vitest';

const volgorde: string[] = [];
const nep = vi.hoisted(() => ({
  lock: true,
  app: {
    isPackaged: false,
    setPath: vi.fn(),
    quit: vi.fn(),
    getVersion: () => '0.1.0',
    whenReady: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('electron', () => ({ app: nep.app, ipcMain: { handle: vi.fn() } }));
vi.mock('./ipc/registreer', () => ({ registreerIpc: vi.fn(() => volgorde.push('ipc')) }));
vi.mock('./db/verbinding', () => ({
  openAppDatabase: vi.fn(() => {
    volgorde.push('database');
    return {};
  }),
  database: () => ({}),
}));
vi.mock('./db/migraties', () => ({
  migreer: vi.fn(() => {
    volgorde.push('migreer');
    return Promise.resolve();
  }),
}));
vi.mock('./db/opschonen', () => ({
  schoonOp: vi.fn(() => {
    volgorde.push('opschonen');
    return { offertes: 0, privacylog: 0 };
  }),
}));
vi.mock('./paden', () => ({
  paden: { dataMap: 'C:\\data', logMap: 'C:\\data\\logs' },
  maakMappenAan: vi.fn(() => {
    volgorde.push('mappen');
    return Promise.resolve();
  }),
}));
vi.mock('./log', () => ({
  initLogging: vi.fn(() => volgorde.push('logging')),
  log: { info: vi.fn() },
}));
vi.mock('./venster', () => ({
  claimEnkeleInstantie: vi.fn(() => {
    volgorde.push('lock');
    return nep.lock;
  }),
  devServerUrl: () => undefined,
  cspVoor: () => 'csp',
  stelCspIn: vi.fn(() => volgorde.push('csp')),
  maakHoofdvenster: vi.fn(() => volgorde.push('venster')),
}));

const { opstart } = await import('./opstart');

beforeEach(() => {
  volgorde.length = 0;
  nep.lock = true;
  vi.clearAllMocks();
});

describe('opstart', () => {
  it('voert de stappen van §14.1 in volgorde uit', async () => {
    await opstart();
    expect(nep.app.setPath).toHaveBeenCalledWith('userData', 'C:\\data');
    expect(volgorde).toEqual([
      'lock',
      'logging',
      'mappen',
      'database',
      'migreer',
      'opschonen',
      'ipc',
      'csp',
      'venster',
    ]);
    expect(nep.app.quit).not.toHaveBeenCalled();
  });

  it('stopt zonder single-instance-lock', async () => {
    nep.lock = false;
    await opstart();
    expect(nep.app.quit).toHaveBeenCalled();
    expect(volgorde).toEqual(['lock']);
  });
});
