import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { bepaalClaudeStatus, isTeOud, legeStatusCache, parseVersie, registreerClaudeFout } =
  await import('./claudeStatus');
const { haalInstelling, wijzigInstelling } = await import('../db/repo/instellingen');

let db: TestDatabase;
let claude: NepClaude | undefined;
beforeEach(async () => {
  db = await maakTestDatabase();
  legeStatusCache();
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  db.opruimen();
});

describe('versie (NFE-020)', () => {
  it('parseVersie en minimum 2.1.259', () => {
    expect(parseVersie('2.1.270 (Claude Code)')).toEqual([2, 1, 270]);
    expect(parseVersie('Claude Code')).toBeNull();
    expect(isTeOud([2, 1, 258])).toBe(true);
    expect(isTeOud([2, 1, 259])).toBe(false);
    expect(isTeOud([2, 2, 0])).toBe(false);
    expect(isTeOud([1, 9, 999])).toBe(true);
    expect(isTeOud([3, 0, 0])).toBe(false);
  });
});

describe('bepaalClaudeStatus met de nep-CLI (§10.2, FE-090)', () => {
  it('ok → gekoppeld via account, versie 2.1.270', async () => {
    claude = gebruikNepClaude('ok');
    expect(await bepaalClaudeStatus()).toEqual({ toestand: 'gekoppeld', versie: '2.1.270', via: 'account' });
  });

  it('oud → CLAUDE_TE_OUD met versie 2.1.100', async () => {
    claude = gebruikNepClaude('oud');
    expect(await bepaalClaudeStatus()).toEqual({
      toestand: 'fout',
      code: 'CLAUDE_TE_OUD',
      versie: '2.1.100',
    });
  });

  it('niet-ingelogd → CLAUDE_NIET_INGELOGD', async () => {
    claude = gebruikNepClaude('niet-ingelogd');
    expect(await bepaalClaudeStatus()).toEqual({
      toestand: 'fout',
      code: 'CLAUDE_NIET_INGELOGD',
      versie: '2.1.270',
    });
  });

  it('OFFERTE_MAKER_CLAUDE_CMD naar een niet-bestaand bestand → CLAUDE_NIET_GEINSTALLEERD', async () => {
    claude = gebruikNepClaude('ok');
    process.env['OFFERTE_MAKER_CLAUDE_CMD'] = 'C:\\bestaat\\niet\\nep.mjs';
    expect(await bepaalClaudeStatus()).toEqual({
      toestand: 'fout',
      code: 'CLAUDE_NIET_GEINSTALLEERD',
      versie: null,
    });
  });

  it('--version zonder versienummer → CLAUDE_NIET_GEINSTALLEERD (§10.4)', async () => {
    claude = gebruikNepClaude('geen-versie');
    expect(await bepaalClaudeStatus()).toMatchObject({ code: 'CLAUDE_NIET_GEINSTALLEERD' });
  });

  it('recente GEEN_INTERNET → GEEN_INTERNET; ouder dan 10 minuten → gekoppeld', async () => {
    claude = gebruikNepClaude('ok');
    const nu = Date.now();
    registreerClaudeFout('GEEN_INTERNET', new Date(nu - 60_000));
    expect(await bepaalClaudeStatus(nu)).toEqual({
      toestand: 'fout',
      code: 'GEEN_INTERNET',
      versie: '2.1.270',
    });
    legeStatusCache();
    registreerClaudeFout('GEEN_INTERNET', new Date(nu - 11 * 60_000));
    expect(await bepaalClaudeStatus(nu)).toMatchObject({ toestand: 'gekoppeld' });
  });

  it('API-sleutel ingevuld → gekoppeld via api-sleutel, zonder de CLI aan te roepen', async () => {
    claude = gebruikNepClaude('niet-ingelogd');
    wijzigInstelling('claude', { apiSleutelVersleuteld: 'dmVyc2xldXRlbGQ=' });
    expect(await bepaalClaudeStatus()).toEqual({ toestand: 'gekoppeld', versie: '', via: 'api-sleutel' });
    expect(claude.aanroepen()).toHaveLength(0);
  });

  it('60 s cache; leeg na legeStatusCache', async () => {
    claude = gebruikNepClaude('ok');
    const nu = Date.now();
    await bepaalClaudeStatus(nu);
    await bepaalClaudeStatus(nu + 59_000);
    expect(claude.aanroepen()).toHaveLength(2); // --version + auth status, één keer
    await bepaalClaudeStatus(nu + 61_000);
    expect(claude.aanroepen()).toHaveLength(4);
    legeStatusCache();
    await bepaalClaudeStatus(nu + 62_000);
    expect(claude.aanroepen()).toHaveLength(6);
  });
});

describe('registreerClaudeFout', () => {
  it('zet laatsteClaudeFout alleen bij GEEN_INTERNET en CLAUDE_NIET_INGELOGD', () => {
    registreerClaudeFout('LIMIET_BEREIKT');
    expect(haalInstelling('app').laatsteClaudeFout).toBeNull();
    registreerClaudeFout('CLAUDE_NIET_INGELOGD', new Date('2026-09-25T10:00:00.000Z'));
    expect(haalInstelling('app').laatsteClaudeFout).toEqual({
      code: 'CLAUDE_NIET_INGELOGD',
      tijdstip: '2026-09-25T10:00:00.000Z',
    });
  });
});
