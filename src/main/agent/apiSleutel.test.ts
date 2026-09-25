import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// API-sleutel bewaren (§10.8, NFE-015, V-17) en de provider-keuze (§10.1, FE-094).

const nep = vi.hoisted(() => ({
  beschikbaar: true,
  // Nep-versleuteling: omkeren + prefix, zodat de klare tekst niet in de database mag staan.
  encrypt: (s: string) => Buffer.from(`ENC:${[...s].reverse().join('')}`, 'utf8'),
  decrypt: (b: Buffer) => [...b.toString('utf8').slice(4)].reverse().join(''),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  legeStatusCache: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false },
  safeStorage: {
    isEncryptionAvailable: () => nep.beschikbaar,
    encryptString: nep.encrypt,
    decryptString: nep.decrypt,
  },
}));
vi.mock('../log', () => ({ log: nep.log }));
vi.mock('./claudeStatus', () => ({ legeStatusCache: nep.legeStatusCache, registreerClaudeFout: vi.fn() }));

const { bewaarApiSleutel, MELDING_GEEN_VERSLEUTELING } = await import('./apiSleutel');
const { haalInstelling } = await import('../db/repo/instellingen');
const { isApiModus, kiesProvider } = await import('./provider');
const { ApiProvider } = await import('./apiProvider');
const { ClaudeCodeProvider } = await import('./claudeCodeProvider');

const SLEUTEL = 'sk-ant-api03-NEPSLEUTEL-voor-de-zoektest';

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
  nep.beschikbaar = true;
  vi.clearAllMocks();
});
afterEach(() => t.opruimen());

describe('bewaarApiSleutel', () => {
  it('versleutelt als base64, legt de statuscache leeg en kiest daarna de ApiProvider', () => {
    expect(isApiModus()).toBe(false);
    expect(kiesProvider()).toBeInstanceOf(ClaudeCodeProvider);

    bewaarApiSleutel(`  ${SLEUTEL}  `);
    const opgeslagen = haalInstelling('claude').apiSleutelVersleuteld;
    expect(opgeslagen).not.toBeNull();
    expect(nep.decrypt(Buffer.from(opgeslagen ?? '', 'base64'))).toBe(SLEUTEL);
    expect(nep.legeStatusCache).toHaveBeenCalledOnce();
    expect(isApiModus()).toBe(true);
    expect(kiesProvider()).toBeInstanceOf(ApiProvider);
  });

  it('null verwijdert de sleutel; daarna weer de ClaudeCodeProvider', () => {
    bewaarApiSleutel(SLEUTEL);
    bewaarApiSleutel(null);
    expect(haalInstelling('claude').apiSleutelVersleuteld).toBeNull();
    expect(kiesProvider()).toBeInstanceOf(ClaudeCodeProvider);
    expect(nep.legeStatusCache).toHaveBeenCalledTimes(2);
  });

  it('zonder versleuteling: VALIDATIE en niets bewaard', () => {
    nep.beschikbaar = false;
    expect(() => bewaarApiSleutel(SLEUTEL)).toThrow(AppFout);
    expect(() => bewaarApiSleutel(SLEUTEL)).toThrow(MELDING_GEEN_VERSLEUTELING);
    expect(haalInstelling('claude').apiSleutelVersleuteld).toBeNull();
    expect(nep.legeStatusCache).not.toHaveBeenCalled();
  });

  it('NFE-015: de sleutel staat niet leesbaar in de database (ook niet in -wal) of in logregels', () => {
    bewaarApiSleutel(SLEUTEL);
    for (const bestand of readdirSync(t.map).filter((n) => n.startsWith('offerte-maker.sqlite'))) {
      expect(readFileSync(join(t.map, bestand)).includes(Buffer.from(SLEUTEL, 'utf8'))).toBe(false);
    }
    const gelogd = JSON.stringify([
      nep.log.info.mock.calls,
      nep.log.warn.mock.calls,
      nep.log.error.mock.calls,
    ]);
    expect(gelogd).not.toContain(SLEUTEL);
  });
});
