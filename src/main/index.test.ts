import { describe, expect, it, vi } from 'vitest';

// App-lifecycle (index.ts): lopende agenttaken stoppen bij afsluiten, database sluiten bij will-quit.
const nep = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => void>(),
  stopAlleTaken: vi.fn(),
  sluitDatabase: vi.fn(),
  quit: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    on: (naam: string, f: (...args: unknown[]) => void) => nep.handlers.set(naam, f),
    quit: nep.quit,
    exit: vi.fn(),
  },
}));
vi.mock('./opstart', () => ({ opstart: () => Promise.resolve() }));
vi.mock('./log', () => ({ log: { error: vi.fn() } }));
vi.mock('./db/verbinding', () => ({ sluitDatabase: nep.sluitDatabase }));
vi.mock('./agent/taken', () => ({ stopAlleTaken: nep.stopAlleTaken }));

await import('./index');

describe('index (lifecycle)', () => {
  it('stopt alle agenttaken bij before-quit', () => {
    nep.handlers.get('before-quit')?.();
    expect(nep.stopAlleTaken).toHaveBeenCalledOnce();
    expect(nep.sluitDatabase).not.toHaveBeenCalled();
  });

  it('sluit de database bij will-quit en stopt bij window-all-closed', () => {
    nep.handlers.get('will-quit')?.();
    expect(nep.sluitDatabase).toHaveBeenCalledOnce();
    nep.handlers.get('window-all-closed')?.();
    expect(nep.quit).toHaveBeenCalledOnce();
  });
});
