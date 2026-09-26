import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoutCode } from '@shared/fouten';
import type { Klant, KlusInvoer, Voortgang } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

const nep = vi.hoisted(() => ({ agentMap: '' }));
const logSpy = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: logSpy }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
  },
}));

const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { maakOfferte, stopTaak, isBezig, MELDING_AL_BEZIG, agentTimeoutMs } = await import('./taken');
const { legeStatusCache } = await import('./claudeStatus');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { bouwSysteemprompt } = await import('./prompts');
const { maakIpcHandler } = await import('../ipc/registreer');
const { offerteAgentHandlers } = await import('../ipc/offerteAgent');

let db: TestDatabase;
let claude: NepClaude | undefined;

beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm-taken-'));
  legeStatusCache();
  zetTesthakenVoorTest(new Map());
  logSpy.warn.mockClear();
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

const jansen: Klant = maakKlant({
  voornaam: 'Piet',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
  email: 'jansen@mail.nl',
});

function offerteMet(
  klant: Klant = jansen,
  invoer: KlusInvoer = maakInvoer({ overig: 'Graag voor de winter' }),
) {
  const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer({ id, klant, invoer, wizardStap: 4 }, 30);
  return id;
}

const rij = (id: string) =>
  db.db
    .prepare(
      'SELECT status, inhoud_json, totaal_incl_cent, omschrijving_kort, wizard_stap FROM offertes WHERE id = ?',
    )
    .get(id) as {
    status: string;
    inhoud_json: string | null;
    totaal_incl_cent: number | null;
    omschrijving_kort: string;
    wizard_stap: number;
  };
const versies = (id: string) =>
  db.db
    .prepare('SELECT versie_nr, bron FROM offerte_versies WHERE offerte_id = ? ORDER BY versie_nr')
    .all(id);
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
const pAanroepen = () => (claude?.aanroepen() ?? []).filter((a) => a.args.includes('-p'));

async function foutcode(belofte: Promise<unknown>): Promise<FoutCode | 'geen fout'> {
  try {
    await belofte;
    return 'geen fout';
  } catch (e) {
    return (e as { code: FoutCode }).code;
  }
}

describe('maakOfferte (§10.7)', { timeout: 30_000 }, () => {
  it('ok: slaat de inhoud op in één versie en legt precies één privacylogregel vast (FE-040)', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet();
    const voortgang: Voortgang[] = [];
    const uit = await maakOfferte(id, { stuur: (v) => voortgang.push(v) });

    expect(uit).toEqual({ controlepunten: 2 });
    const r = rij(id);
    expect(r.status).toBe('concept');
    expect(r.wizard_stap).toBe(4);
    expect(r.totaal_incl_cent).toBeGreaterThan(0);
    expect(r.omschrijving_kort).toBe('Dak vervangen · 22,5 m²');
    expect(r.inhoud_json).toContain('[KLANT_NAAM]');
    for (const w of ['Jansen', 'Dorpsstraat', 'Veldhoven', '12345678', 'jansen@mail.nl']) {
      expect(r.inhoud_json).not.toContain(w);
    }
    const inhoud = JSON.parse(r.inhoud_json ?? '{}') as { regels: object[]; controlepunten: string[] };
    expect(inhoud.regels[0]).not.toHaveProperty('ref');
    expect(inhoud.controlepunten).toHaveLength(2);
    expect(versies(id)).toEqual([{ versie_nr: 1, bron: 'agent' }]);

    const [aanroep] = pAanroepen();
    expect(pAanroepen()).toHaveLength(1);
    const log = privacylog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ soort: 'maken', offerte_id: id, resultaat: 'ok', foutcode: null });
    expect(log[0]?.opdracht).toBe(`${bouwSysteemprompt({ template: false })}\n\n---\n\n${aanroep?.stdin}`);
    expect(log[0]?.antwoord).toContain('"structured_output"');
    expect(aanroep?.stdin).toContain(
      'Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl.',
    );
    expect(aanroep?.stdin).not.toMatch(/Jansen|Dorpsstraat|Veldhoven|12345678/);

    const fasen = [...new Set(voortgang.map((v) => v.fase))];
    expect(fasen[0]).toBe('controleren');
    expect(fasen).toContain('versturen');
    expect(fasen.at(-2)).toBe('verwerken');
    expect(fasen.at(-1)).toBe('klaar');
    expect(voortgang.every((v) => v.id === id && v.verstrekenS >= 0)).toBe(true);
    expect(isBezig(id)).toBe(false);
  });

  it('opnieuw maken geeft een tweede versie; sinds OFM-047 met bron wizard (Maak opnieuw)', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet();
    await maakOfferte(id);
    await maakOfferte(id);
    expect(versies(id)).toEqual([
      { versie_nr: 1, bron: 'agent' },
      { versie_nr: 2, bron: 'wizard' },
    ]);
  });

  it('FE-030: koppeling werkt niet → melding, niets verstuurd, geen privacylog, blijft concept', async () => {
    claude = gebruikNepClaude('ok');
    process.env['OFFERTE_MAKER_CLAUDE_CMD'] = join(nep.agentMap, 'bestaat-niet.mjs');
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe('CLAUDE_NIET_GEINSTALLEERD');
    expect(pAanroepen()).toHaveLength(0);
    expect(privacylog()).toHaveLength(0);
    expect(rij(id).status).toBe('concept');
    expect(rij(id).inhoud_json).toBeNull();
  });

  it('niet ingelogd bij de statuscontrole → CLAUDE_NIET_INGELOGD, geen -p-aanroep', async () => {
    claude = gebruikNepClaude('niet-ingelogd');
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe('CLAUDE_NIET_INGELOGD');
    expect(pAanroepen()).toHaveLength(0);
    expect(privacylog()).toHaveLength(0);
  });

  it('FE-033: met privacyfilter-uit en een klantnaam in Overig → PRIVACY_GEBLOKKEERD, alleen het aantal gelogd', async () => {
    claude = gebruikNepClaude('ok');
    zetTesthakenVoorTest(new Map([['privacyfilter-uit', true]]));
    const id = offerteMet(jansen, maakInvoer({ overig: 'Bel Jansen, Dorpsstraat 12' }));
    expect(await foutcode(maakOfferte(id))).toBe('PRIVACY_GEBLOKKEERD');
    expect(pAanroepen()).toHaveLength(0);
    expect(privacylog()).toHaveLength(0);
    const gelogd = logSpy.warn.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(gelogd).toMatch(/eindcontrole blokkeert \(3 treffers\)/);
    expect(gelogd).not.toMatch(/Jansen|Dorpsstraat/);
  });

  it('zonder testhaak filtert het filter en gaat dezelfde offerte gewoon door', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet(jansen, maakInvoer({ overig: 'Bel Jansen, Dorpsstraat 12' }));
    await maakOfferte(id);
    expect(pAanroepen()[0]?.stdin).toContain('"overig": "Bel [KLANT_NAAM], [KLANT_ADRES]"');
  });

  it('§11.3: achternaam Hout met ondergrond Hout wordt niet geblokkeerd', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet(
      maakKlant({ aanhef: 'mevr', achternaam: 'Anna Hout' }),
      maakInvoer({ ondergrond: 'hout' }),
    );
    await maakOfferte(id);
    expect(pAanroepen()[0]?.stdin).toContain('"ondergrond": "Hout"');
  });

  it('FE-036: ongeldig → precies 2 aanroepen, AGENT_ONBRUIKBAAR, 2 privacylogregels, blijft concept', async () => {
    claude = gebruikNepClaude('ongeldig');
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe('AGENT_ONBRUIKBAAR');
    expect(pAanroepen()).toHaveLength(2);
    expect(privacylog().map((r) => [r.resultaat, r.foutcode])).toEqual([
      ['fout', 'AGENT_ONBRUIKBAAR'],
      ['fout', 'AGENT_ONBRUIKBAAR'],
    ]);
    expect(rij(id)).toMatchObject({ status: 'concept', inhoud_json: null });
  });

  it('FE-036: ongeldig-dan-ok → na 2 aanroepen een gemaakte offerte', async () => {
    claude = gebruikNepClaude('ongeldig-dan-ok');
    const id = offerteMet();
    expect(await maakOfferte(id)).toEqual({ controlepunten: 2 });
    expect(pAanroepen()).toHaveLength(2);
    expect(privacylog().map((r) => r.resultaat)).toEqual(['fout', 'ok']);
  });

  it.each(['leeg', 'crash'])('NFE-016: %s → AGENT_ONBRUIKBAAR na één nieuwe poging', async (modus) => {
    claude = gebruikNepClaude(modus);
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe('AGENT_ONBRUIKBAAR');
    expect(pAanroepen()).toHaveLength(2);
    expect(rij(id).status).toBe('concept');
  });

  it.each([
    ['limiet', 'LIMIET_BEREIKT'],
    ['geen-internet', 'GEEN_INTERNET'],
  ])('%s → %s zonder nieuwe poging', async (modus, code) => {
    claude = gebruikNepClaude(modus);
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe(code);
    expect(pAanroepen()).toHaveLength(1);
    expect(privacylog()).toEqual([expect.objectContaining({ resultaat: 'fout', foutcode: code })]);
  });

  it('timeout (testhaak agent-timeout) → AGENT_TIMEOUT zonder nieuwe poging', async () => {
    claude = gebruikNepClaude('traag');
    zetTesthakenVoorTest(new Map([['agent-timeout', '1500']]));
    expect(agentTimeoutMs()).toBe(1500);
    const id = offerteMet();
    expect(await foutcode(maakOfferte(id))).toBe('AGENT_TIMEOUT');
    expect(pAanroepen()).toHaveLength(1);
    expect(rij(id).status).toBe('concept');
  });

  it('Stoppen → subproces binnen 2 s weg, AGENT_AFGEBROKEN, blijft concept', async () => {
    claude = gebruikNepClaude('traag');
    const id = offerteMet();
    const voortgang: Voortgang[] = [];
    const taak = foutcode(maakOfferte(id, { stuur: (v) => voortgang.push(v) }));
    await vi.waitFor(() => expect(pAanroepen()).toHaveLength(1), { timeout: 10_000, interval: 50 });
    const gestopt = Date.now();
    expect(stopTaak(id)).toBe(true);
    expect(await taak).toBe('AGENT_AFGEBROKEN');
    expect(Date.now() - gestopt).toBeLessThan(2_000);
    expect(privacylog()).toEqual([
      expect.objectContaining({ resultaat: 'afgebroken', foutcode: 'AGENT_AFGEBROKEN' }),
    ]);
    expect(rij(id)).toMatchObject({ status: 'concept', inhoud_json: null });
    expect(voortgang.at(-1)?.fase).toBe('fout');
    expect(stopTaak(id)).toBe(false);
  });

  it('een tweede aanroep tijdens een lopende taak → VALIDATIE "Er wordt al aan deze offerte gewerkt."', async () => {
    claude = gebruikNepClaude('traag');
    const id = offerteMet();
    const eerste = foutcode(maakOfferte(id));
    await expect(maakOfferte(id)).rejects.toMatchObject({ code: 'VALIDATIE', melding: MELDING_AL_BEZIG });
    stopTaak(id);
    expect(await eerste).toBe('AGENT_AFGEBROKEN');
  });

  it.each<FoutCode>([
    'CLAUDE_NIET_INGELOGD',
    'LIMIET_BEREIKT',
    'GEEN_INTERNET',
    'AGENT_TIMEOUT',
    'AGENT_AFGEBROKEN',
  ])('geen nieuwe poging bij %s (provider)', async (code) => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet();
    const voerUit = vi.fn().mockResolvedValue({ ok: false, code, ruw: '' });
    expect(await foutcode(maakOfferte(id, { provider: { voerUit } }))).toBe(code);
    expect(voerUit).toHaveBeenCalledTimes(1);
    expect(privacylog()[0]?.resultaat).toBe(code === 'AGENT_AFGEBROKEN' ? 'afgebroken' : 'fout');
  });
});

describe('ipc offerte:maak en offerte:stop', { timeout: 30_000 }, () => {
  it('maak stuurt voortgang naar het venster en geeft { controlepunten }', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet();
    const send = vi.fn();
    const handler = maakIpcHandler('offerte:maak', offerteAgentHandlers['offerte:maak']);
    const uit = await handler({ sender: { isDestroyed: () => false, send } } as never, { id });
    expect(uit).toEqual({ ok: true, data: { controlepunten: 2 } });
    expect(send).toHaveBeenCalledWith('offerte:voortgang', expect.objectContaining({ id, fase: 'klaar' }));
  });

  it('OFM-035: onvolledige offerte → VALIDATIE, niets naar Claude', async () => {
    claude = gebruikNepClaude('ok');
    const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    const handler = maakIpcHandler('offerte:maak', offerteAgentHandlers['offerte:maak']);
    const uit = await handler({ sender: { isDestroyed: () => false, send: vi.fn() } } as never, { id });
    expect(uit).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    expect(uit.ok ? '' : uit.fout.melding).toContain('Achternaam ontbreekt');
    expect(claude.aanroepen().filter((a) => a.args.includes('-p'))).toEqual([]);
  });

  it('een gesloten venster krijgt geen voortgang', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMet();
    const send = vi.fn();
    const handler = maakIpcHandler('offerte:maak', offerteAgentHandlers['offerte:maak']);
    await handler({ sender: { isDestroyed: () => true, send } } as never, { id });
    expect(send).not.toHaveBeenCalled();
  });

  it('NFE-014: ongeldige invoer wordt geweigerd', async () => {
    const maak = maakIpcHandler('offerte:maak', offerteAgentHandlers['offerte:maak']);
    const stop = maakIpcHandler('offerte:stop', offerteAgentHandlers['offerte:stop']);
    for (const invoer of [undefined, {}, { id: 5 }, { id: '' }]) {
      expect(await maak({} as never, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
      expect(await stop({} as never, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
    expect(await stop({} as never, { id: 'template_teksten' })).toEqual({ ok: true, data: null });
  });
});
