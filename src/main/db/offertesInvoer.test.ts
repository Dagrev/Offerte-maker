import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { legeKlant, legeKlusInvoer } from '@shared/nieuweOfferte';
import type { Klant, KlusInvoer, OfferteInhoud } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const haken = vi.hoisted(() => ({ waarden: new Map<string, string | true>() }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: nepLog }));
vi.mock('../testhaken', () => ({
  vandaag: () => '2026-09-25',
  testhaak: (naam: string) => haken.waarden.get(naam) ?? false,
}));

const { bewaarInvoer, haalOfferte, maakOfferte, MELDING_AL_DEFINITIEF } =
  await import('./repo/offertesInvoer');
const { wijzigInstelling } = await import('./repo/instellingen');
const { offerteInvoerHandlers } = await import('../ipc/offerteInvoer');
const { maakIpcHandler } = await import('../ipc/registreer');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
  haken.waarden.clear();
});
afterEach(() => t.opruimen());

const NU = new Date('2026-09-25T10:00:00.000Z');

function rij(id: string) {
  return t.db.prepare('SELECT * FROM offertes WHERE id = ?').get(id) as Record<string, unknown>;
}

const klant: Klant = {
  ...legeKlant(),
  aanhef: 'bedrijf',
  voornaam: '',
  achternaam: 'P. Jansen',
  bedrijfsnaam: 'Jansen Bouw B.V.',
  adres: { straatHuisnummer: 'Kerkstraat 1', postcode: '5611 AB', plaats: 'Eindhoven' },
  telefoon: '+31401234567', // al genormaliseerd (OFM-030)
};

function invoerMetVlakken(): KlusInvoer {
  const invoer = legeKlusInvoer();
  return {
    ...invoer,
    soortWerk: 'dak_vervangen',
    dakvlakken: [
      { id: 'a', naam: 'Voor', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null },
      { id: 'b', naam: 'Achter', modus: 'm2', lengteM: null, breedteM: null, m2: 12.3 },
    ],
  };
}

describe('maakOfferte (offerte:nieuw zonder bron)', () => {
  it('maakt een leeg concept met datums volgens V-10/V-12', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const r = rij(id);
    expect(r).toMatchObject({
      status: 'concept',
      offertedatum: '2026-09-25',
      geldig_tot: '2026-10-25',
      wizard_stap: 1,
      inhoud_json: null,
      totaal_incl_cent: null,
      nummer: null,
      omschrijving_kort: '',
      zoektekst: '   ',
      aangemaakt_op: NU.toISOString(),
      bijgewerkt_op: NU.toISOString(),
    });
    expect(JSON.parse(r['klant_json'] as string)).toEqual(legeKlant());
    const invoer = JSON.parse(r['invoer_json'] as string) as KlusInvoer;
    expect({ ...invoer, dakvlakken: [] }).toEqual({ ...legeKlusInvoer(), dakvlakken: [] });
    expect(invoer.dakvlakken).toEqual([
      {
        id: expect.any(String) as string,
        naam: 'Dakvlak 1',
        modus: 'lxb',
        lengteM: null,
        breedteM: null,
        m2: null,
      },
    ]);
  });
});

describe('maakOfferte met bronId (kopie, FE-061)', () => {
  function bron(): string {
    const id = maakOfferte({ vandaag: '2026-01-10', geldigheidDagen: 30 }, NU);
    bewaarInvoer({ id, klant, invoer: invoerMetVlakken(), wizardStap: 4 }, 30, NU);
    t.db
      .prepare(
        "UPDATE offertes SET inhoud_json = '{}', totaal_incl_cent = 100, status = 'klaar' WHERE id = ?",
      )
      .run(id);
    return id;
  }

  it('met zelfdeKlant: klant en invoer gekopieerd, dakvlakken met nieuwe id, stap 2', () => {
    const bronId = bron();
    const id = maakOfferte({ bronId, zelfdeKlant: true, vandaag: '2026-09-25', geldigheidDagen: 14 }, NU);
    const r = rij(id);
    expect(r).toMatchObject({
      status: 'concept',
      wizard_stap: 2,
      inhoud_json: null,
      totaal_incl_cent: null,
      offertedatum: '2026-09-25',
      geldig_tot: '2026-10-09',
      omschrijving_kort: 'Dak vervangen · 34,8 m²',
      zoektekst: 'p. jansen jansen bouw b.v. eindhoven ',
    });
    expect(JSON.parse(r['klant_json'] as string)).toEqual(klant);
    const invoer = JSON.parse(r['invoer_json'] as string) as KlusInvoer;
    expect(invoer.dakvlakken.map((v) => v.naam)).toEqual(['Voor', 'Achter']);
    expect(invoer.dakvlakken.map((v) => v.id)).not.toContain('a');
    expect(invoer.dakvlakken.map((v) => v.id)).not.toContain('b');
  });

  it('zonder zelfdeKlant: lege klant, stap 1', () => {
    const id = maakOfferte({ bronId: bron(), vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    const r = rij(id);
    expect(r['wizard_stap']).toBe(1);
    expect(JSON.parse(r['klant_json'] as string)).toEqual(legeKlant());
    expect((JSON.parse(r['invoer_json'] as string) as KlusInvoer).soortWerk).toBe('dak_vervangen');
    expect(r['zoektekst']).toBe('   ');
  });

  it('onbekende bron → VALIDATIE', () => {
    expect(() => maakOfferte({ bronId: 'bestaat-niet', vandaag: '2026-09-25', geldigheidDagen: 30 })).toThrow(
      AppFout,
    );
  });
});

describe('haalOfferte (offerte:haal)', () => {
  it('concept zonder inhoud: inhoud en totalen null, geen versies of pdfs', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    expect(haalOfferte(id)).toMatchObject({
      id,
      status: 'concept',
      nummer: null,
      offertedatum: '2026-09-25',
      geldigTot: '2026-10-25',
      wizardStap: 1,
      klant: legeKlant(),
      inhoud: null,
      totalen: null,
      versies: [],
      pdfs: [],
      gewijzigdNaDefinitief: false,
    });
  });

  it('met inhoud: plaatshouders ingevuld (OFM-006) en totalen berekend', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    bewaarInvoer({ id, klant: { ...klant, aanhef: 'fam', achternaam: 'De Vries' } }, 30, NU);
    const inhoud: OfferteInhoud = {
      titel: 'Offerte voor [KLANT_NAAM]',
      inleiding: 'Beste familie [KLANT_NAAM],',
      werkomschrijving: ['Werk in [KLANT_PLAATS]'],
      regels: [
        {
          id: 'r1',
          omschrijving: 'EPDM',
          aantalHonderdsten: 1000,
          eenheid: 'm²',
          prijsCent: 5000,
          btwTarief: 21,
          prijsbron: 'prijslijst',
          prijspostId: null,
        },
      ],
      uitvoering: '',
      opmerkingen: '',
      afsluiting: '',
      controlepunten: [],
    };
    t.db.prepare('UPDATE offertes SET inhoud_json = ? WHERE id = ?').run(JSON.stringify(inhoud), id);
    t.db
      .prepare(
        "INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op) VALUES ('v1', ?, 1, 'agent', '{}', 'x'), ('v2', ?, 2, 'handmatig', '{}', 'y')",
      )
      .run(id, id);
    const detail = haalOfferte(id);
    expect(detail.inhoud?.titel).toBe('Offerte voor De Vries');
    expect(detail.inhoud?.werkomschrijving).toEqual(['Werk in Eindhoven']);
    expect(detail.totalen).toEqual({
      subtotaalCent: 50000,
      btw: [{ tarief: 21, grondslagCent: 50000, bedragCent: 10500 }],
      totaalCent: 60500,
    });
    expect(detail.versies.map((v) => v.versieNr)).toEqual([2, 1]);
  });

  it('onbekend id → VALIDATIE', () => {
    expect(() => haalOfferte('bestaat-niet')).toThrow(AppFout);
  });
});

describe('bewaarInvoer (offerte:bewaarInvoer)', () => {
  it('werkt alleen de meegegeven delen bij en zet de afgeleide velden (V-12)', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    const later = new Date('2026-09-25T10:05:00.000Z');
    bewaarInvoer({ id, klant }, 30, later);
    let r = rij(id);
    expect(r).toMatchObject({
      zoektekst: 'p. jansen jansen bouw b.v. eindhoven ',
      omschrijving_kort: '',
      wizard_stap: 1,
      bijgewerkt_op: later.toISOString(),
      aangemaakt_op: NU.toISOString(),
      geldig_tot: '2026-10-25',
    });

    bewaarInvoer({ id, invoer: invoerMetVlakken(), wizardStap: 2 }, 30, later);
    r = rij(id);
    expect(r['omschrijving_kort']).toBe('Dak vervangen · 34,8 m²');
    expect(r['wizard_stap']).toBe(2);
    expect(JSON.parse(r['klant_json'] as string)).toEqual(klant);
  });

  it('nieuwe offertedatum → geldig_tot opnieuw (FE-058)', () => {
    const id = maakOfferte({ vandaag: '2026-09-01', geldigheidDagen: 30 }, NU);
    bewaarInvoer({ id, offertedatum: '2026-09-25' }, 30, NU);
    expect(rij(id)).toMatchObject({ offertedatum: '2026-09-25', geldig_tot: '2026-10-25' });
  });

  it('maakt het werkadres leeg als er geen werkadres is (§5)', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    const werk = { straatHuisnummer: 'Laan 2', postcode: '1234 AB', plaats: 'Best' };
    bewaarInvoer({ id, klant: { ...klant, heeftWerkadres: false, werkadres: werk } }, 30, NU);
    expect(haalOfferte(id).klant.werkadres).toEqual({ straatHuisnummer: '', postcode: '', plaats: '' });
    bewaarInvoer({ id, klant: { ...klant, heeftWerkadres: true, werkadres: werk } }, 30, NU);
    expect(haalOfferte(id).klant.werkadres).toEqual(werk);
  });

  it('OFM-030: normaliseert postcode, telefoon en e-mail bij bewaren', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    bewaarInvoer(
      {
        id,
        klant: {
          ...klant,
          adres: { ...klant.adres, postcode: '5611ab' },
          telefoon: '06-12345678',
          email: 'Jan@Voorbeeld.NL',
        },
      },
      30,
      NU,
    );
    expect(haalOfferte(id).klant).toMatchObject({
      adres: { postcode: '5611 AB' },
      telefoon: '+31612345678',
      email: 'jan@voorbeeld.nl',
    });
  });

  it('OFM-030: weigert een ongeldige waarde met de veldnaam; een oude opgeslagen waarde mag blijven', () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    let fout: unknown;
    try {
      bewaarInvoer({ id, klant: { ...klant, adres: { ...klant.adres, postcode: '12345' } } }, 30, NU);
    } catch (e) {
      fout = e;
    }
    expect(fout).toBeInstanceOf(AppFout);
    expect((fout as AppFout).code).toBe('VALIDATIE');
    expect((fout as AppFout).melding).toMatch(/^Postcode van de klant: Een postcode bestaat uit/);

    // Oude offerte (van vóór OFM-030) met een ongeldige waarde: blijft te bewerken.
    const oud = { ...klant, telefoon: 'bel via kantoor' };
    t.db.prepare('UPDATE offertes SET klant_json = ? WHERE id = ?').run(JSON.stringify(oud), id);
    bewaarInvoer({ id, klant: { ...oud, achternaam: 'Anders' } }, 30, NU);
    expect(haalOfferte(id).klant).toMatchObject({ achternaam: 'Anders', telefoon: 'bel via kantoor' });
    expect(() => bewaarInvoer({ id, klant: { ...oud, telefoon: 'bel mij' } }, 30, NU)).toThrow(
      /Telefoon van de klant/,
    );
  });

  it('weigert als de offerte al definitief is (nummer of PDF)', () => {
    const metNummer = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    t.db
      .prepare(
        "UPDATE offertes SET nummer = '2026-001', jaar = 2026, volgnummer = 1, status = 'klaar' WHERE id = ?",
      )
      .run(metNummer);
    expect(() => bewaarInvoer({ id: metNummer, wizardStap: 2 }, 30, NU)).toThrow(MELDING_AL_DEFINITIEF);

    const metPdf = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    t.db
      .prepare(
        "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES ('p', ?, '', 'x.pdf', 'x')",
      )
      .run(metPdf);
    try {
      bewaarInvoer({ id: metPdf, wizardStap: 2 }, 30, NU);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppFout);
      expect((e as AppFout).code).toBe('VALIDATIE');
    }
    expect(rij(metPdf)['wizard_stap']).toBe(1);
  });
});

describe('IPC-handlers', () => {
  const event = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];

  it('nieuw gebruikt vandaag() en teksten.geldigheidDagen; haal en bewaarInvoer werken via de IPC-laag', async () => {
    wijzigInstelling('teksten', { geldigheidDagen: 14 });
    const nieuw = await maakIpcHandler('offerte:nieuw', offerteInvoerHandlers['offerte:nieuw'])(event, {});
    expect(nieuw.ok).toBe(true);
    if (!nieuw.ok) return;
    const id = nieuw.data.id;
    expect(rij(id)).toMatchObject({ offertedatum: '2026-09-25', geldig_tot: '2026-10-09' });

    const bewaar = maakIpcHandler('offerte:bewaarInvoer', offerteInvoerHandlers['offerte:bewaarInvoer']);
    expect(await bewaar(event, { id, offertedatum: '2026-10-01', wizardStap: 3 })).toEqual({
      ok: true,
      data: null,
    });
    expect(rij(id)).toMatchObject({ geldig_tot: '2026-10-15', wizard_stap: 3 });
    expect((await bewaar(event, { id, wizardStap: 5 })).ok).toBe(false);

    const haal = await maakIpcHandler('offerte:haal', offerteInvoerHandlers['offerte:haal'])(event, { id });
    expect(haal.ok && haal.data.wizardStap).toBe(3);
  });

  it('testhaak ipc-fout: offerte:haal komt als ONBEKEND aan', async () => {
    const id = maakOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 }, NU);
    haken.waarden.set('ipc-fout', true);
    const haal = await maakIpcHandler('offerte:haal', offerteInvoerHandlers['offerte:haal'])(event, { id });
    expect(haal).toMatchObject({ ok: false, fout: { code: 'ONBEKEND' } });
  });
});
