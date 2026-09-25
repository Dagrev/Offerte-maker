import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';

const nep = vi.hoisted(() => ({ agentMap: '' }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
  },
}));

const { loginClaude, testClaude, TEST_SYSTEEMPROMPT } = await import('./koppeling');
const { legeStatusCache } = await import('./claudeStatus');
const { maakIpcHandler } = await import('../ipc/registreer');
const { claudeHandlers } = await import('../ipc/claude');

let db: TestDatabase;
let claude: NepClaude;
beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm-koppeling-'));
  legeStatusCache();
});
afterEach(() => {
  claude?.opruimen();
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

const privacylog = () =>
  db.db
    .prepare('SELECT soort, offerte_id, opdracht, antwoord, resultaat, foutcode FROM privacylog')
    .all() as {
    soort: string;
    offerte_id: string | null;
    opdracht: string;
    antwoord: string | null;
    resultaat: string;
    foutcode: string | null;
  }[];

describe('claude:test (FE-092, V-17)', () => {
  it('ok: slaagt, met --max-turns 1, testsysteemprompt en een privacylogregel test', async () => {
    claude = gebruikNepClaude('ok');
    const { duurMs } = await testClaude();
    expect(duurMs).toBeLessThan(60_000);
    const [aanroep] = claude.aanroepen();
    expect(aanroep?.args[aanroep.args.indexOf('--max-turns') + 1]).toBe('1');
    expect(aanroep?.stdin).toBe('Antwoord met {"ok": true}.');
    expect(TEST_SYSTEEMPROMPT).toBe(
      'Je bent een testassistent. Antwoord uitsluitend met JSON volgens het schema.',
    );
    expect(privacylog()).toEqual([
      expect.objectContaining({
        soort: 'test',
        offerte_id: null,
        opdracht: `${TEST_SYSTEEMPROMPT}\n\n---\n\nAntwoord met {"ok": true}.`,
        resultaat: 'ok',
        foutcode: null,
      }),
    ]);
  });

  it('via IPC: fout als Resultaat met code en een privacylogregel fout', async () => {
    claude = gebruikNepClaude('limiet');
    const resultaat = await maakIpcHandler('claude:test', claudeHandlers['claude:test'])(
      {} as never,
      undefined,
    );
    expect(resultaat).toMatchObject({ ok: false, fout: { code: 'LIMIET_BEREIKT' } });
    expect(privacylog()[0]).toMatchObject({ resultaat: 'fout', foutcode: 'LIMIET_BEREIKT' });
  });
});

describe('claude:login (FE-091)', () => {
  it('start auth login, wacht op afsluiten en geeft binnen 3 s de nieuwe status', async () => {
    claude = gebruikNepClaude('ok');
    const t0 = Date.now();
    const status = await loginClaude();
    expect(status).toEqual({ toestand: 'gekoppeld', versie: '2.1.270', via: 'account' });
    expect(Date.now() - t0).toBeLessThan(3500);
    expect(claude.aanroepen().map((a) => a.args.join(' '))).toEqual([
      'auth login',
      '--version',
      'auth status',
    ]);
  });

  it('zonder Claude Code: meteen de status niet geïnstalleerd', async () => {
    claude = gebruikNepClaude('ok');
    process.env['OFFERTE_MAKER_CLAUDE_CMD'] = join(nep.agentMap, 'bestaat-niet.mjs');
    expect(await loginClaude()).toMatchObject({ code: 'CLAUDE_NIET_GEINSTALLEERD' });
  });
});

describe('claude:status via IPC', () => {
  it('geeft een Resultaat met de status', async () => {
    claude = gebruikNepClaude('oud');
    const resultaat = await maakIpcHandler('claude:status', claudeHandlers['claude:status'])(
      {} as never,
      undefined,
    );
    expect(resultaat).toEqual({
      ok: true,
      data: { toestand: 'fout', code: 'CLAUDE_TE_OUD', versie: '2.1.100' },
    });
  });
});
