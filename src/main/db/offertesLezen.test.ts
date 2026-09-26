import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Klant, Status } from '@shared/types';
import { formatEuroHeel } from '@shared/formatteer';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: nepLog }));

const { escapeLike, lijstOverzicht, zoekOffertes, ZOEK_LIMIET } = await import('./repo/offertesLezen');
const { maakIpcHandler } = await import('../ipc/registreer');
const { overzichtHandlers } = await import('../ipc/overzicht');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

interface NepOfferte {
  id: string;
  datum: string;
  status?: Status;
  nummer?: string | null;
  totaal?: number | null;
  klant?: Partial<Klant>;
  plaats?: string;
  omschrijving?: string;
  zoektekst?: string;
  verwijderd?: boolean;
  aangemaakt?: string;
}

/** Zet een offerterij direct in de database (V-12: omschrijving/zoektekst komen normaal uit OFM-010). */
function voegToe(o: NepOfferte): void {
  const nummer = o.nummer ?? null;
  const klant = {
    aanhef: 'fam',
    voornaam: '',
    achternaam: 'Jansen',
    bedrijfsnaam: '',
    adres: { straatHuisnummer: 'Dorpsstraat 1', postcode: '1234 AB', plaats: o.plaats ?? 'Veldhoven' },
    telefoon: '',
    email: '',
    heeftWerkadres: false,
    werkadres: { straatHuisnummer: '', postcode: '', plaats: '' },
    ...o.klant,
  };
  t.db
    .prepare(
      `INSERT INTO offertes (id, status, jaar, volgnummer, nummer, offertedatum, geldig_tot, klant_json,
         invoer_json, totaal_incl_cent, omschrijving_kort, zoektekst, verwijderd_op, aangemaakt_op, bijgewerkt_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      o.id,
      o.status ?? (nummer ? 'klaar' : 'concept'),
      nummer ? Number(nummer.slice(0, 4)) : null,
      nummer ? Number(nummer.slice(5)) : null,
      nummer,
      o.datum,
      o.datum,
      JSON.stringify(klant),
      o.totaal === undefined ? 100_00 : o.totaal,
      o.omschrijving ?? 'Dak vervangen · EPDM 1,1 mm · 34,8 m²',
      o.zoektekst ??
        `${[klant.voornaam, klant.achternaam].filter((d) => d !== '').join(' ')} ${klant.bedrijfsnaam} ${klant.adres.plaats} ${nummer ?? ''}`.toLowerCase(),
      o.verwijderd ? '2026-09-20T10:00:00.000Z' : null,
      o.aangemaakt ?? `${o.datum}T08:00:00.000Z`,
      o.aangemaakt ?? `${o.datum}T08:00:00.000Z`,
    );
}

function pdf(offerteId: string, letter: string, tijd: string): void {
  t.db
    .prepare(
      `INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(`${offerteId}-${letter || 'a'}`, offerteId, letter, `C:\\pdf\\${offerteId}${letter}.pdf`, tijd);
}

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('lijstOverzicht (§8.2)', () => {
  it('FE-012: sorteert nieuw naar oud, concepten vóór genummerde op dezelfde dag, met alle gegevens', () => {
    voegToe({ id: 'a', datum: '2026-09-03', nummer: '2026-011', totaal: 481200 });
    voegToe({ id: 'b', datum: '2026-09-18', nummer: '2026-012' });
    voegToe({ id: 'c', datum: '2026-09-18', nummer: '2026-013' });
    voegToe({
      id: 'd',
      datum: '2026-09-18',
      totaal: null,
      klant: { aanhef: 'bedrijf', bedrijfsnaam: 'Bouw BV' },
    });
    voegToe({ id: 'e', datum: '2026-09-25', nummer: '2026-014', status: 'akkoord' });

    const r = lijstOverzicht('maand', '2026-09-25');
    expect(r.periode).toEqual({ van: '2026-09-01', tot: '2026-09-30', label: 'september 2026' });
    expect(ids(r.items)).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(r.groepen).toBeNull();
    expect(r.items.at(-1)).toEqual({
      id: 'a',
      nummer: '2026-011',
      status: 'klaar',
      klantWeergave: 'Fam. Jansen',
      plaats: 'Veldhoven',
      omschrijvingKort: 'Dak vervangen · EPDM 1,1 mm · 34,8 m²',
      totaalInclCent: 481200,
      offertedatum: '2026-09-03',
    });
    expect(r.items[1]).toMatchObject({
      nummer: null,
      status: 'concept',
      klantWeergave: 'Bouw BV',
      totaalInclCent: null,
    });
  });

  it('volgt bij gelijke datum en zonder nummer het aanmaaktijdstip', () => {
    voegToe({ id: 'oud', datum: '2026-09-10', aangemaakt: '2026-09-10T08:00:00.000Z' });
    voegToe({ id: 'nieuw', datum: '2026-09-10', aangemaakt: '2026-09-10T09:00:00.000Z' });
    expect(ids(lijstOverzicht('dag', '2026-09-10').items)).toEqual(['nieuw', 'oud']);
  });

  it('toont het nummer met de versieletter van de laatste PDF', () => {
    voegToe({ id: 'a', datum: '2026-09-10', nummer: '2026-001' });
    voegToe({ id: 'b', datum: '2026-09-11', nummer: '2026-002' });
    pdf('a', '', '2026-09-10T10:00:00.000Z');
    pdf('a', 'b', '2026-09-12T10:00:00.000Z');
    pdf('a', 'c', '2026-09-13T10:00:00.000Z');
    const items = lijstOverzicht('maand', '2026-09-10').items;
    expect(items.map((i) => i.nummer)).toEqual(['2026-002', '2026-001c']);
  });

  it('FE-013: zondag hoort bij de week vanaf maandag; periodegrenzen zijn inclusief', () => {
    voegToe({ id: 'ma', datum: '2026-09-21' });
    voegToe({ id: 'zo', datum: '2026-09-27' });
    voegToe({ id: 'volgende-ma', datum: '2026-09-28' });
    voegToe({ id: 'vorige-zo', datum: '2026-09-20' });
    const week = lijstOverzicht('week', '2026-09-25');
    expect(week.periode.label).toBe('week 39 · 21 – 27 sep 2026');
    expect(ids(week.items)).toEqual(['zo', 'ma']);
    expect(ids(lijstOverzicht('week', '2026-09-28').items)).toEqual(['volgende-ma']);
  });

  it('laat verwijderde offertes nooit zien, ook niet bij zoeken', () => {
    voegToe({ id: 'weg', datum: '2026-09-10', verwijderd: true });
    voegToe({ id: 'blijft', datum: '2026-09-11' });
    expect(ids(lijstOverzicht('jaar', '2026-01-01').items)).toEqual(['blijft']);
    expect(ids(zoekOffertes('jansen'))).toEqual(['blijft']);
  });

  it('FE-014: samenvatting telt concepten wel in het aantal, niet in het totaal', () => {
    voegToe({ id: 'k1', datum: '2026-09-01', nummer: '2026-001', totaal: 100_00 });
    voegToe({ id: 'k2', datum: '2026-09-02', nummer: '2026-002', totaal: 200_00 });
    voegToe({ id: 'ak', datum: '2026-09-03', nummer: '2026-003', status: 'akkoord', totaal: 300_00 });
    voegToe({ id: 'co', datum: '2026-09-04', totaal: 999_00 });
    const { samenvatting } = lijstOverzicht('maand', '2026-09-15');
    expect(samenvatting).toEqual({ aantal: 4, totaalCent: 600_00, aantalAkkoord: 1 });
    expect(formatEuroHeel(samenvatting.totaalCent)).toBe('€ 600');
  });

  it('FE-015: jaar groepeert per maand, nieuwste eerst, subtotaal zonder concepten, lege maanden weg', () => {
    voegToe({ id: 'mrt1', datum: '2026-03-05', nummer: '2026-001', totaal: 100_00 });
    voegToe({ id: 'mrt2', datum: '2026-03-20', totaal: 500_00 });
    voegToe({ id: 'mei1', datum: '2026-05-02', nummer: '2026-002', totaal: 250_00 });
    voegToe({ id: 'ander-jaar', datum: '2025-05-02', nummer: '2025-009' });
    const r = lijstOverzicht('jaar', '2026-09-25');
    expect(r.periode.label).toBe('2026');
    expect(r.groepen?.map((g) => [g.maand, g.label, ids(g.items), g.subtotaalCent])).toEqual([
      [5, 'mei 2026', ['mei1'], 250_00],
      [3, 'maart 2026', ['mrt2', 'mrt1'], 100_00],
    ]);
  });

  it('FE-016: een lege periode geeft een lege lijst en nulsamenvatting', () => {
    const r = lijstOverzicht('maand', '2026-02-10');
    expect(r.items).toEqual([]);
    expect(r.samenvatting).toEqual({ aantal: 0, totaalCent: 0, aantalAkkoord: 0 });
    expect(lijstOverzicht('jaar', '2026-02-10').groepen).toEqual([]);
  });

  it('verdraagt onleesbare of onvolledige klantgegevens', () => {
    voegToe({ id: 'a', datum: '2026-09-10' });
    t.db.prepare(`UPDATE offertes SET klant_json = 'kapot' WHERE id = 'a'`).run();
    voegToe({ id: 'b', datum: '2026-09-11' });
    t.db
      .prepare(`UPDATE offertes SET klant_json = '{"naam":" Pietersen ","aanhef":"?"}' WHERE id = 'b'`)
      .run();
    const items = lijstOverzicht('maand', '2026-09-10').items;
    expect(items.map((i) => [i.klantWeergave, i.plaats])).toEqual([
      ['Pietersen', ''],
      ['', ''],
    ]);
  });

  it('OFM-046: toont het tussenvoegsel; zonder het veld (oude offerte) als vroeger', () => {
    voegToe({
      id: 'a',
      datum: '2026-09-10',
      klant: { aanhef: 'dhr', voornaam: 'Jan', achternaam: 'Jansen' },
    });
    voegToe({
      id: 'b',
      datum: '2026-09-11',
      klant: { aanhef: 'dhr', voornaam: 'Jan', tussenvoegsel: 'van der', achternaam: 'Berg' },
    });
    voegToe({
      id: 'c',
      datum: '2026-09-12',
      klant: { aanhef: 'fam', voornaam: 'Jan', tussenvoegsel: 'van der', achternaam: 'Berg' },
    });
    const items = lijstOverzicht('maand', '2026-09-10').items;
    expect(items.map((i) => i.klantWeergave)).toEqual([
      'Fam. Van der Berg',
      'Dhr. J. van der Berg',
      'Dhr. J. Jansen',
    ]);
  });
});

describe('zoekOffertes (§8.2, FE-017)', () => {
  it('vindt hoofdletterongevoelig uit alle periodes', () => {
    voegToe({ id: 'oud', datum: '2024-04-01', nummer: '2024-003' });
    voegToe({ id: 'ander', datum: '2026-09-01', klant: { achternaam: 'de Vries' }, plaats: 'Best' });
    expect(ids(zoekOffertes('JANS'))).toEqual(['oud']);
    expect(ids(zoekOffertes('best'))).toEqual(['ander']);
  });

  it('"2026-01" vindt 2026-010 t/m 2026-019, niet 2026-001 of 2026-020', () => {
    for (const n of [1, 10, 14, 19, 20]) {
      voegToe({ id: `n${n}`, datum: '2026-05-01', nummer: `2026-${String(n).padStart(3, '0')}` });
    }
    expect(ids(zoekOffertes('2026-01'))).toEqual(['n19', 'n14', 'n10']);
  });

  it('zoekt % en _ letterlijk', () => {
    voegToe({ id: 'procent', datum: '2026-05-01', zoektekst: 'actie 50% korting' });
    voegToe({ id: 'streep', datum: '2026-05-02', zoektekst: 'a_b' });
    voegToe({ id: 'gewoon', datum: '2026-05-03', zoektekst: 'axb 50 procent' });
    expect(ids(zoekOffertes('50%'))).toEqual(['procent']);
    expect(ids(zoekOffertes('a_b'))).toEqual(['streep']);
    expect(ids(zoekOffertes('%'))).toEqual(['procent']);
    expect(escapeLike('a\\b%c_d')).toBe('a\\\\b\\%c\\_d');
  });

  it(`geeft maximaal ${ZOEK_LIMIET} treffers`, () => {
    const invoegen = t.db.transaction(() => {
      for (let i = 0; i < ZOEK_LIMIET + 5; i++) voegToe({ id: `o${i}`, datum: '2026-01-01' });
    });
    invoegen();
    expect(zoekOffertes('jansen')).toHaveLength(ZOEK_LIMIET);
  });
});

describe('ipc/overzicht.ts', () => {
  const nepEvent = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];

  it('geeft echte resultaten voor geldige invoer', async () => {
    voegToe({ id: 'a', datum: '2026-09-25', nummer: '2026-001' });
    const lijst = maakIpcHandler('overzicht:lijst', overzichtHandlers['overzicht:lijst']);
    const zoek = maakIpcHandler('overzicht:zoek', overzichtHandlers['overzicht:zoek']);

    const r1 = await lijst(nepEvent, { weergave: 'maand', datum: '2026-09-01' });
    expect(r1.ok && ids(r1.data.items)).toEqual(['a']);
    const r2 = await zoek(nepEvent, { tekst: 'Jansen' });
    expect(r2.ok && ids(r2.data)).toEqual(['a']);
  });
});

describe('OFM-053: filter op status en ordening', () => {
  function vulMix(): void {
    voegToe({ id: 'k1', datum: '2026-09-10', nummer: '2026-003', status: 'klaar', totaal: 100_00 });
    voegToe({ id: 'v1', datum: '2026-09-05', nummer: '2026-001', status: 'verstuurd', totaal: 200_00 });
    voegToe({ id: 'a1', datum: '2026-09-20', nummer: '2026-002', status: 'akkoord', totaal: 300_00 });
    voegToe({ id: 'c1', datum: '2026-09-12' });
    voegToe({ id: 'c2', datum: '2026-09-22' });
    // Een nummer uit een ander jaar (definitief gemaakt eind 2025, offertedatum later).
    voegToe({ id: 'o1', datum: '2026-09-01', nummer: '2025-099', status: 'afgewezen' });
  }

  it('filter op één of meer statussen; lijst en telling volgen het filter', () => {
    vulMix();
    const concept = lijstOverzicht('maand', '2026-09-01', { statussen: ['concept'] });
    expect(ids(concept.items)).toEqual(['c2', 'c1']);
    expect(concept.samenvatting).toEqual({ aantal: 2, totaalCent: 0, aantalAkkoord: 0 });
    const twee = lijstOverzicht('maand', '2026-09-01', { statussen: ['klaar', 'akkoord', 'klaar'] });
    expect(ids(twee.items)).toEqual(['a1', 'k1']);
    expect(twee.samenvatting).toEqual({ aantal: 2, totaalCent: 400_00, aantalAkkoord: 1 });
    // Leeg = alle.
    expect(lijstOverzicht('maand', '2026-09-01', { statussen: [] }).items).toHaveLength(6);
  });

  it('ordening op nummer: jaar en volgnummer, concepten onderaan op datum', () => {
    vulMix();
    const op = lijstOverzicht('maand', '2026-09-01', { ordening: 'nummer_op' });
    expect(ids(op.items)).toEqual(['o1', 'v1', 'a1', 'k1', 'c2', 'c1']);
    const af = lijstOverzicht('maand', '2026-09-01', { ordening: 'nummer_af' });
    expect(ids(af.items)).toEqual(['k1', 'a1', 'v1', 'o1', 'c2', 'c1']);
    expect(ids(lijstOverzicht('maand', '2026-09-01', { ordening: 'datum' }).items)).toEqual(
      ids(lijstOverzicht('maand', '2026-09-01').items),
    );
  });

  it('jaar: maandgroepen alleen bij datumordening', () => {
    vulMix();
    voegToe({ id: 'aug', datum: '2026-08-15', nummer: '2026-004' });
    expect(lijstOverzicht('jaar', '2026-01-01').groepen).not.toBeNull();
    const opNummer = lijstOverzicht('jaar', '2026-01-01', { ordening: 'nummer_op' });
    expect(opNummer.groepen).toBeNull();
    expect(ids(opNummer.items)).toEqual(['o1', 'v1', 'a1', 'k1', 'aug', 'c2', 'c1']);
  });

  it('zoeken met filter en ordening', () => {
    vulMix();
    expect(ids(zoekOffertes('jansen', { statussen: ['concept'] }))).toEqual(['c2', 'c1']);
    expect(ids(zoekOffertes('jansen', { ordening: 'nummer_op' }))).toEqual([
      'o1',
      'v1',
      'a1',
      'k1',
      'c2',
      'c1',
    ]);
  });

  it('via IPC: filter en ordening optioneel; onbekende status of ordening → VALIDATIE', async () => {
    vulMix();
    const nepEvent = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];
    const lijst = maakIpcHandler('overzicht:lijst', overzichtHandlers['overzicht:lijst']);
    const zoek = maakIpcHandler('overzicht:zoek', overzichtHandlers['overzicht:zoek']);
    const r = await lijst(nepEvent, {
      weergave: 'maand',
      datum: '2026-09-01',
      statussen: ['verstuurd'],
      ordening: 'nummer_af',
    });
    expect(r.ok && ids(r.data.items)).toEqual(['v1']);
    const z = await zoek(nepEvent, { tekst: 'jansen', statussen: ['akkoord'] });
    expect(z.ok && ids(z.data)).toEqual(['a1']);
    expect(
      await lijst(nepEvent, { weergave: 'maand', datum: '2026-09-01', statussen: ['weg'] }),
    ).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
    expect(await zoek(nepEvent, { tekst: 'jansen', ordening: 'naam' })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
  });
});
