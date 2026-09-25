import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

const { ClaudeCodeProvider, bouwArgumenten, classificeer, verwerkUitvoer } =
  await import('./claudeCodeProvider');
const { haalInstelling } = await import('../db/repo/instellingen');
const { schoneOmgeving } = await import('./proces');
const { TEST_SCHEMA } = await import('./koppeling');
import type { AgentVerzoek } from './provider';

const offerte = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../test/fake-claude/fixtures/offerte-ok.json'), 'utf8'),
) as Record<string, unknown>;
const templateTeksten = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../test/fake-claude/fixtures/template-teksten-ok.json'),
    'utf8',
  ),
) as Record<string, unknown>;
const OFFERTE_SCHEMA = {
  type: 'object',
  properties: { titel: { type: 'string' }, regels: { type: 'array' } },
};
const TEMPLATE_SCHEMA = {
  type: 'object',
  properties: { inleiding: { type: 'string' }, garantie10: { type: 'string' } },
};

let db: TestDatabase;
let claude: NepClaude;
beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm-agent-'));
});
afterEach(() => {
  claude?.opruimen();
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

function verzoek(deel: Partial<AgentVerzoek> = {}): AgentVerzoek {
  return {
    soort: 'maken',
    systeemprompt: 'Systeemprompt',
    opdracht: 'Opdracht met é en ë',
    schema: OFFERTE_SCHEMA,
    signal: new AbortController().signal,
    timeoutMs: 20_000,
    ...deel,
  };
}

describe('classificeer (§10.4, §15.4)', () => {
  it.each([
    ['Not logged in · Please run /login', 'CLAUDE_NIET_INGELOGD'],
    ['Invalid API key', 'CLAUDE_NIET_INGELOGD'],
    ['HTTP 401', 'CLAUDE_NIET_INGELOGD'],
    ['OAuth token has expired', 'CLAUDE_NIET_INGELOGD'],
    ['Claude usage limit reached', 'LIMIET_BEREIKT'],
    ['Error 429 Too Many Requests', 'LIMIET_BEREIKT'],
    ['Your credit balance is too low', 'LIMIET_BEREIKT'],
    ['getaddrinfo ENOTFOUND api.anthropic.com', 'GEEN_INTERNET'],
    ['connect ECONNREFUSED', 'GEEN_INTERNET'],
    ['Unable to connect to API', 'GEEN_INTERNET'],
    ['API Error: Overloaded', 'AGENT_ONBRUIKBAAR'],
    ['Error 503', 'AGENT_ONBRUIKBAAR'],
    ['Error: boom', 'AGENT_ONBRUIKBAAR'],
    ['', 'AGENT_ONBRUIKBAAR'],
  ])('%j → %s', (tekst, code) => {
    expect(classificeer(tekst)).toBe(code);
  });

  it('eerste treffer wint en ONBEKEND komt nooit voor', () => {
    expect(classificeer('Not logged in; rate limit; network')).toBe('CLAUDE_NIET_INGELOGD');
  });
});

describe('verwerkUitvoer (§10.4 stap 1–3)', () => {
  const envelop = (deel: object) =>
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...deel });

  it('structured_output heeft voorrang', () => {
    expect(verwerkUitvoer(envelop({ structured_output: { a: 1 }, result: '{"b":2}' }), '')).toMatchObject({
      ok: true,
      json: { a: 1 },
    });
  });

  it('anders JSON tussen eerste { en laatste } uit result', () => {
    expect(verwerkUitvoer(envelop({ result: 'Hier: {"b":{"c":2}} klaar' }), '')).toMatchObject({
      ok: true,
      json: { b: { c: 2 } },
    });
    expect(verwerkUitvoer(envelop({ result: 'geen json' }), '')).toMatchObject({
      ok: false,
      code: 'AGENT_ONBRUIKBAAR',
    });
    expect(verwerkUitvoer(envelop({ result: '{kapot}' }), '')).toMatchObject({
      ok: false,
      code: 'AGENT_ONBRUIKBAAR',
    });
  });

  it('is_error of ander subtype → classificatie van result + stderr', () => {
    expect(verwerkUitvoer(envelop({ is_error: true, result: 'usage limit' }), '')).toMatchObject({
      code: 'LIMIET_BEREIKT',
    });
    expect(verwerkUitvoer(envelop({ subtype: 'error_max_turns' }), 'ETIMEDOUT')).toMatchObject({
      code: 'GEEN_INTERNET',
    });
  });

  it('geen JSON op stdout → classificatie van stdout + stderr', () => {
    expect(verwerkUitvoer('', 'getaddrinfo ENOTFOUND')).toMatchObject({ ok: false, code: 'GEEN_INTERNET' });
    expect(verwerkUitvoer('[1,2]', '')).toMatchObject({ ok: false, code: 'AGENT_ONBRUIKBAAR' });
  });
});

describe('bouwArgumenten en omgeving', () => {
  it('precies de vlaggen uit §10.4, max-turns 1 bij test', () => {
    const args = bouwArgumenten(
      { soort: 'maken', schema: { a: 1 } },
      { agentMap: 'C:\\agent', model: 'opus', effort: 'medium' },
    );
    expect(args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      '{"a":1}',
      '--system-prompt-file',
      join('C:\\agent', 'systeemprompt.md'),
      '--tools',
      'Read,Glob,Grep',
      '--permission-mode',
      'dontAsk',
      '--strict-mcp-config',
      '--mcp-config',
      join('C:\\agent', 'mcp-leeg.json'),
      '--no-session-persistence',
      '--max-turns',
      '15',
      '--model',
      'opus',
      '--effort',
      'medium',
    ]);
    const test = bouwArgumenten(
      { soort: 'test', schema: {} },
      { agentMap: 'C:\\agent', model: 'x', effort: 'low' },
    );
    expect(test[test.indexOf('--max-turns') + 1]).toBe('1');
  });

  it('haalt ANTHROPIC_API_KEY en CLAUDE_CODE_* weg, laat de rest staan', () => {
    const env = schoneOmgeving(
      { ANTHROPIC_API_KEY: 'x', CLAUDE_CODE_ENTRYPOINT: 'y', FAKE_CLAUDE_MODE: 'ok', PATH: 'p' },
      { ELECTRON_RUN_AS_NODE: '1' },
    );
    expect(env).toEqual({ FAKE_CLAUDE_MODE: 'ok', PATH: 'p', ELECTRON_RUN_AS_NODE: '1' });
  });
});

describe('ClaudeCodeProvider met de nep-CLI (§15.2, NFE-022)', () => {
  it('ok: fixture als json; opdracht via stdin, argumenten en systeemprompt goed', async () => {
    claude = gebruikNepClaude('ok');
    const antwoord = await new ClaudeCodeProvider().voerUit(verzoek());
    expect(antwoord).toMatchObject({ ok: true, json: offerte });
    const [aanroep] = claude.aanroepen();
    expect(aanroep?.stdin).toBe('Opdracht met é en ë');
    const { model, effort } = haalInstelling('claude');
    expect(aanroep?.args).toEqual(
      bouwArgumenten({ soort: 'maken', schema: OFFERTE_SCHEMA }, { agentMap: nep.agentMap, model, effort }),
    );
    expect(readFileSync(join(nep.agentMap, 'systeemprompt.md'), 'utf8')).toBe('Systeemprompt');
    expect(readFileSync(join(nep.agentMap, 'mcp-leeg.json'), 'utf8')).toBe('{"mcpServers":{}}');
  });

  it('V-08: antwoord volgt het --json-schema-argument', async () => {
    claude = gebruikNepClaude('ok');
    const provider = new ClaudeCodeProvider();
    expect(await provider.voerUit(verzoek({ soort: 'test', schema: TEST_SCHEMA }))).toMatchObject({
      ok: true,
      json: { ok: true },
    });
    expect(
      await provider.voerUit(verzoek({ soort: 'template_teksten', schema: TEMPLATE_SCHEMA })),
    ).toMatchObject({
      ok: true,
      json: templateTeksten,
    });
  });

  it('ongeldig: ok met json zonder regels', async () => {
    claude = gebruikNepClaude('ongeldig');
    const antwoord = await new ClaudeCodeProvider().voerUit(verzoek());
    expect(antwoord.ok).toBe(true);
    if (antwoord.ok) expect(antwoord.json).not.toHaveProperty('regels');
  });

  it('ongeldig-dan-ok: eerst zonder regels, daarna de fixture', async () => {
    claude = gebruikNepClaude('ongeldig-dan-ok');
    const provider = new ClaudeCodeProvider();
    const eerste = await provider.voerUit(verzoek());
    const tweede = await provider.voerUit(verzoek());
    expect(eerste.ok && (eerste.json as object)).not.toHaveProperty('regels');
    expect(tweede).toMatchObject({ ok: true, json: offerte });
  });

  it.each([
    ['leeg', 'AGENT_ONBRUIKBAAR'],
    ['crash', 'AGENT_ONBRUIKBAAR'],
    ['limiet', 'LIMIET_BEREIKT'],
  ])('%s → %s', async (modus, code) => {
    claude = gebruikNepClaude(modus);
    expect(await new ClaudeCodeProvider().voerUit(verzoek())).toMatchObject({ ok: false, code });
  });

  it.each([
    ['niet-ingelogd', 'CLAUDE_NIET_INGELOGD'],
    ['geen-internet', 'GEEN_INTERNET'],
  ])('%s → %s en app.laatsteClaudeFout gezet', async (modus, code) => {
    claude = gebruikNepClaude(modus);
    expect(await new ClaudeCodeProvider().voerUit(verzoek())).toMatchObject({ ok: false, code });
    expect(haalInstelling('app').laatsteClaudeFout?.code).toBe(code);
  });

  it('traag met korte timeout → AGENT_TIMEOUT', async () => {
    claude = gebruikNepClaude('traag');
    expect(await new ClaudeCodeProvider().voerUit(verzoek({ timeoutMs: 1500 }))).toMatchObject({
      ok: false,
      code: 'AGENT_TIMEOUT',
    });
  });

  it('traag en afbreken → AGENT_AFGEBROKEN binnen 2 s', async () => {
    claude = gebruikNepClaude('traag');
    const stop = new AbortController();
    const bezig = new ClaudeCodeProvider().voerUit(verzoek({ signal: stop.signal, timeoutMs: 60_000 }));
    await new Promise((r) => setTimeout(r, 1000));
    const t0 = Date.now();
    stop.abort();
    expect(await bezig).toMatchObject({ ok: false, code: 'AGENT_AFGEBROKEN' });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('al afgebroken signaal → meteen AGENT_AFGEBROKEN', async () => {
    const stop = new AbortController();
    stop.abort();
    expect(await new ClaudeCodeProvider().voerUit(verzoek({ signal: stop.signal }))).toMatchObject({
      code: 'AGENT_AFGEBROKEN',
    });
  });

  it('niet gevonden → CLAUDE_NIET_GEINSTALLEERD; niet te starten → idem', async () => {
    claude = gebruikNepClaude('ok');
    process.env['OFFERTE_MAKER_CLAUDE_CMD'] = join(nep.agentMap, 'bestaat-niet.mjs');
    expect(await new ClaudeCodeProvider().voerUit(verzoek())).toMatchObject({
      code: 'CLAUDE_NIET_GEINSTALLEERD',
    });
    const provider = new ClaudeCodeProvider({
      zoek: () => Promise.resolve({ command: join(nep.agentMap, 'geen.exe'), prefixArgs: [], env: {} }),
    });
    expect(await provider.voerUit(verzoek())).toMatchObject({ code: 'CLAUDE_NIET_GEINSTALLEERD' });
  });
});
