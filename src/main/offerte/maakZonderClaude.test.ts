import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { berekenTotalen } from '@shared/calc/bedragen';
import type { Klant, OfferteInhoud } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

// OFM-025: `offerte:maakZonderClaude` (§9.5, §10.7 stap 7, §11.4, V-09, FE-110).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { bewaarPrijspost, haalPrijspostOpSleutel, verwijderPrijspost } =
  await import('../db/repo/prijsposten');
const { maakIpcHandler } = await import('../ipc/registreer');
const { offerteAgentHandlers } = await import('../ipc/offerteAgent');
const { legeStatusCache } = await import('../agent/claudeStatus');

const handler = maakIpcHandler('offerte:maakZonderClaude', offerteAgentHandlers['offerte:maakZonderClaude']);

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

const jansen: Klant = maakKlant({
  naam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
  email: 'jansen@mail.nl',
});

function offerte(overig = 'Bel eerst Jansen op 06-12345678, Dorpsstraat 12 in Veldhoven') {
  const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer(
    {
      id,
      klant: jansen,
      invoer: maakInvoer({ soortWerk: 'dak_vervangen', soortDak: 'plat', steigerNodig: true, overig }),
      wizardStap: 3,
    },
    30,
  );
  return id;
}

const rij = (id: string) =>
  db.db
    .prepare(
      'SELECT status, inhoud_json, totaal_incl_cent, omschrijving_kort, wizard_stap FROM offertes WHERE id = ?',
    )
    .get(id) as {
    status: string;
    inhoud_json: string;
    totaal_incl_cent: number;
    omschrijving_kort: string;
    wizard_stap: number;
  };

describe('offerte:maakZonderClaude (FE-110)', () => {
  it('OFM-035: onvolledige offerte → VALIDATIE met de punten, er wordt niets gemaakt', async () => {
    const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    const uit = await handler({} as never, { id });
    expect(uit).toEqual({
      ok: false,
      fout: {
        code: 'VALIDATIE',
        melding:
          'De offerte kan nog niet worden gemaakt. Dit ontbreekt nog of klopt niet:\n' +
          '- Naam van de klant ontbreekt\n- Soort werk is niet gekozen\n- Geen dakvlak ingevuld',
      },
    });
    expect(rij(id).inhoud_json).toBeNull();
  });

  it('zonder koppeling: regels, controlepunten, versie zonder_claude, niets naar Claude', async () => {
    claude = gebruikNepClaude('niet-ingelogd');
    const post = haalPrijspostOpSleutel('voorrijkosten')!;
    bewaarPrijspost({ ...post, prijsCent: 4500 });
    const id = offerte();

    const uit = await handler({} as never, { id });
    expect(uit.ok).toBe(true);

    const r = rij(id);
    const inhoud = JSON.parse(r.inhoud_json) as OfferteInhoud;
    expect(r.status).toBe('concept');
    expect(r.wizard_stap).toBe(4);
    expect(inhoud.titel).toBe('Offerte dak vervangen plat dak');
    expect(inhoud.regels.at(-1)).toMatchObject({
      omschrijving: 'Voorrijkosten',
      prijsCent: 4500,
      prijsbron: 'prijslijst',
    });
    expect(inhoud.regels.some((x) => x.omschrijving === 'Steiger en valbeveiliging')).toBe(true);
    expect(uit).toEqual({ ok: true, data: { controlepunten: inhoud.controlepunten.length } });
    expect(inhoud.controlepunten.length).toBeGreaterThan(0);
    expect(r.totaal_incl_cent).toBe(berekenTotalen(inhoud.regels).totaalCent);
    expect(r.totaal_incl_cent).toBe(5445);
    expect(r.omschrijving_kort).not.toBe('');

    // Opslaginvariant (§11.4): geen klantgegevens in inhoud_json, ook niet uit `overig`.
    for (const w of ['Jansen', '06-12345678', 'Dorpsstraat', 'Veldhoven'])
      expect(r.inhoud_json).not.toContain(w);
    expect(inhoud.opmerkingen).toContain('[KLANT_NAAM]');

    expect(db.db.prepare('SELECT bron FROM offerte_versies WHERE offerte_id = ?').all(id)).toEqual([
      { bron: 'zonder_claude' },
    ]);
    expect(db.db.prepare('SELECT COUNT(*) AS n FROM privacylog').get()).toEqual({ n: 0 });
    expect(claude.aanroepen()).toEqual([]);
  });

  it('een verwijderde startpost wordt een eigen regel met prijs 0 en een controlepunt (V-27)', async () => {
    verwijderPrijspost(haalPrijspostOpSleutel('steiger')!.id);
    const id = offerte('');
    await handler({} as never, { id });
    const inhoud = JSON.parse(rij(id).inhoud_json) as OfferteInhoud;
    expect(inhoud.regels.find((x) => x.omschrijving === 'Steiger en valbeveiliging')).toMatchObject({
      prijspostId: null,
      prijsCent: 0,
      prijsbron: 'schatting',
    });
    expect(inhoud.controlepunten).toContain('Vul de prijs in voor: Steiger en valbeveiliging');
  });

  it('nog een keer maken geeft een tweede versie; ongeldige invoer en onbekend id → VALIDATIE', async () => {
    const id = offerte('');
    await handler({} as never, { id });
    await handler({} as never, { id });
    expect(db.db.prepare('SELECT COUNT(*) AS n FROM offerte_versies WHERE offerte_id = ?').get(id)).toEqual({
      n: 2,
    });
    for (const invoer of [undefined, {}, { id: '' }, { id: 5 }, { id: 'bestaat-niet' }]) {
      expect(await handler({} as never, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
  });
});
