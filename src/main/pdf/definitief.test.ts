import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resultaat } from '@shared/fouten';
import type { Klant, OfferteInhoud } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

const nep = vi.hoisted(() => ({
  tmp: '',
  docs: '',
  shell: { openPath: vi.fn(() => Promise.resolve('')), showItemInFolder: vi.fn() },
  vensters: [] as { opties: unknown; print: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[],
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: vi.fn() },
  shell: nep.shell,
  BrowserWindow: class {
    webContents: { print: ReturnType<typeof vi.fn> };
    destroy = vi.fn();
    constructor(opties: unknown) {
      this.webContents = {
        print: vi.fn((_o: unknown, cb: (ok: boolean, reden: string) => void) => cb(false, 'cancelled')),
      };
      nep.vensters.push({ opties, print: this.webContents.print, destroy: this.destroy });
    }
    loadFile = vi.fn(() => Promise.resolve());
    isDestroyed = () => false;
  },
}));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../venster', () => ({ huidigVenster: () => null }));
vi.mock('../paden', () => ({
  paden: {
    get tmpMap() {
      return nep.tmp;
    },
    get agentMap() {
      return nep.tmp;
    },
    pdfMap: (jaar: number) => join(nep.docs, String(jaar)),
  },
}));

const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { bewaarNieuweVersie, bewaarHandmatigeInhoud } = await import('../db/repo/offertesInhoud');
const { haalOfferte } = await import('../db/repo/offertesInvoer');
const { zoekOffertes } = await import('../db/repo/offertesLezen');
const { maakDefinitief } = await import('./definitief');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { maakIpcHandler } = await import('../ipc/registreer');
const { offerteDefinitiefHandlers } = await import('../ipc/offerteDefinitief');
const { VERBORGEN_VENSTER } = await import('./maakPdf');

let db: TestDatabase;
beforeEach(async () => {
  db = await maakTestDatabase();
  nep.tmp = mkdtempSync(join(tmpdir(), 'ofm-def-tmp-'));
  nep.docs = mkdtempSync(join(tmpdir(), 'ofm-def-docs-'));
  nep.vensters.length = 0;
  nep.shell.openPath.mockClear();
  nep.shell.showItemInFolder.mockClear();
  zetVandaag('2026-09-25');
});
afterEach(() => {
  db.opruimen();
  rmSync(nep.tmp, { recursive: true, force: true });
  rmSync(nep.docs, { recursive: true, force: true });
});

/** OFM-033: het nummer draagt de datum van definitief maken; die komt uit `vandaag()` (testhaak). */
function zetVandaag(datum: string, pdfBezet = false): void {
  const haken = new Map<'vandaag' | 'pdf-bezet', string | true>([['vandaag', datum]]);
  if (pdfBezet) haken.set('pdf-bezet', true);
  zetTesthakenVoorTest(haken);
}

const renders: string[] = [];
const nepRenderer = (html: string) => {
  renders.push(html);
  return Promise.resolve(Buffer.from(`%PDF-nep ${renders.length}`));
};
const traagRenderer = (html: string) =>
  new Promise<Buffer>((klaar) => setTimeout(() => klaar(Buffer.from(`%PDF ${html.length}`)), 30));

const jansen: Klant = maakKlant({
  voornaam: '',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
});

const inhoud: OfferteInhoud = {
  titel: 'Offerte dak',
  inleiding: 'Beste [KLANT_NAAM],',
  werkomschrijving: ['Stap 1'],
  regels: [
    {
      id: 'r1',
      omschrijving: 'EPDM',
      aantalHonderdsten: 1000,
      eenheid: 'm²',
      prijsCent: 500,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
  ],
  uitvoering: 'In overleg.',
  opmerkingen: '',
  afsluiting: 'Groet.',
  controlepunten: [],
};

function offerte(klant: Klant = jansen, datum = '2026-09-25', metInhoud = true): string {
  const id = nieuweOfferte({ vandaag: datum, geldigheidDagen: 30 });
  bewaarInvoer({ id, klant, invoer: maakInvoer(), wizardStap: 4 }, 30);
  if (metInhoud) bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  return id;
}

const rij = (id: string) =>
  db.db
    .prepare(
      'SELECT status, jaar, volgnummer, nummer, geldig_tot, zoektekst, gewijzigd_na_definitief FROM offertes WHERE id = ?',
    )
    .get(id) as {
    status: string;
    jaar: number | null;
    volgnummer: number | null;
    nummer: string | null;
    geldig_tot: string;
    zoektekst: string;
    gewijzigd_na_definitief: number;
  };
const pdfRegels = (id: string) =>
  db.db
    .prepare('SELECT versieletter, pad FROM pdf_bestanden WHERE offerte_id = ? ORDER BY aangemaakt_op')
    .all(id) as {
    versieletter: string;
    pad: string;
  }[];
const bestanden = (jaar: number) => {
  const map = join(nep.docs, String(jaar));
  return existsSync(map) ? readdirSync(map).sort() : [];
};

async function foutcode(belofte: Promise<unknown>): Promise<string> {
  try {
    await belofte;
    return 'geen fout';
  } catch (e) {
    return (e as { code: string }).code;
  }
}

describe('maakDefinitief (§8.1, §12.3, V-01)', () => {
  it('FE-055 (OFM-033): 2026-09-25-001, -002, versies b en c, volgend jaar weer 001', async () => {
    const a = offerte();
    const b = offerte(maakKlant({ achternaam: 'Pietersen' }));
    const c = offerte(maakKlant({ achternaam: 'Klaassen' }), '2026-12-30');

    expect((await maakDefinitief(a, nepRenderer)).nummer).toBe('2026-09-25-001');
    zetVandaag('2026-09-26');
    expect((await maakDefinitief(b, nepRenderer)).nummer).toBe('2026-09-26-002');
    // De datum van definitief maken telt, niet de offertedatum: nieuw jaar, volgnummer weer 001.
    zetVandaag('2027-01-03');
    expect((await maakDefinitief(c, nepRenderer)).nummer).toBe('2027-01-03-001');
    expect(rij(c)).toMatchObject({ jaar: 2027, volgnummer: 1 });
    expect(bestanden(2027)).toEqual(['2027-01-03-001 Klaassen.pdf']);

    bewaarHandmatigeInhoud(a, haalOfferte(a).inhoud as OfferteInhoud);
    expect(rij(a).gewijzigd_na_definitief).toBe(1);
    const tweede = await maakDefinitief(a, nepRenderer);
    // Een nieuwe versie houdt het nummer (en dus de datum) van de eerste keer definitief.
    expect(tweede.nummer).toBe('2026-09-25-001b');
    expect(basename(tweede.pad)).toBe('2026-09-25-001b Jansen.pdf');
    // Het hoofdscherm (OFM-009) toont het weergavenummer met versieletter.
    expect(zoekOffertes('jansen').map((i) => i.nummer)).toEqual(['2026-09-25-001b']);
    expect((await maakDefinitief(a, nepRenderer)).nummer).toBe('2026-09-25-001c');

    expect(bestanden(2026)).toEqual([
      '2026-09-25-001 Jansen.pdf',
      '2026-09-25-001b Jansen.pdf',
      '2026-09-25-001c Jansen.pdf',
      '2026-09-26-002 Pietersen.pdf',
    ]);
    expect(pdfRegels(a).map((p) => p.versieletter)).toEqual(['', 'b', 'c']);
    expect(rij(a)).toMatchObject({ status: 'klaar', jaar: 2026, volgnummer: 1, nummer: '2026-09-25-001' });
    expect(rij(a).gewijzigd_na_definitief).toBe(0);
    expect(rij(a).zoektekst).toContain('2026-09-25-001');
    expect(haalOfferte(a).nummer).toBe('2026-09-25-001');
    expect(readdirSync(nep.tmp)).toEqual([]);
    // Het nummer staat op de PDF, met versieletter.
    expect(renders.at(-1)).toContain('2026-09-25-001c');
    // Zoeken op datum of volgnummer vindt de offerte.
    expect(zoekOffertes('2026-09-25').map((i) => i.nummer)).toEqual(['2026-09-25-001c']);
    expect(zoekOffertes('002').map((i) => i.nummer)).toEqual(['2026-09-26-002']);
  });

  it('OFM-033: na 2026-09-26-007 geeft 2027-01-03 het nummer 2027-01-03-001', async () => {
    const zeven = offerte(maakKlant({ achternaam: 'Zeven' }));
    db.db
      .prepare("UPDATE offertes SET jaar = 2026, volgnummer = 7, nummer = '2026-09-26-007' WHERE id = ?")
      .run(zeven);
    const a = offerte();
    const b = offerte(maakKlant({ achternaam: 'Pietersen' }));
    zetVandaag('2026-12-31');
    expect((await maakDefinitief(a, nepRenderer)).nummer).toBe('2026-12-31-008');
    zetVandaag('2027-01-03');
    expect((await maakDefinitief(b, nepRenderer)).nummer).toBe('2027-01-03-001');
  });

  it('OFM-033: een oud nummer (2026-001) blijft staan, krijgt een volgende letter en blijft vindbaar', async () => {
    const a = offerte();
    await maakDefinitief(a, nepRenderer);
    // Zoals een offerte die vóór OFM-033 definitief werd.
    db.db
      .prepare(
        "UPDATE offertes SET nummer = '2026-001', zoektekst = 'jansen  veldhoven 2026-001' WHERE id = ?",
      )
      .run(a);
    bewaarHandmatigeInhoud(a, haalOfferte(a).inhoud as OfferteInhoud);
    const tweede = await maakDefinitief(a, nepRenderer);
    expect(tweede.nummer).toBe('2026-001b');
    expect(basename(tweede.pad)).toBe('2026-001b Jansen.pdf');
    expect(rij(a).nummer).toBe('2026-001');
    expect(zoekOffertes('2026-001').map((i) => i.nummer)).toEqual(['2026-001b']);
    // Een nieuwe offerte telt door na het oude volgnummer.
    const b = offerte(maakKlant({ achternaam: 'Pietersen' }));
    expect((await maakDefinitief(b, nepRenderer)).nummer).toBe('2026-09-25-002');
  });

  it('jaar blijft vast als de datum later verandert; status blijft als die niet concept was', async () => {
    const a = offerte();
    await maakDefinitief(a, nepRenderer);
    db.db
      .prepare("UPDATE offertes SET offertedatum = '2027-02-01', status = 'verstuurd' WHERE id = ?")
      .run(a);
    zetVandaag('2027-02-01');
    const { nummer, pad } = await maakDefinitief(a, nepRenderer);
    expect(nummer).toBe('2026-09-25-001b');
    expect(pad.startsWith(join(nep.docs, '2026'))).toBe(true);
    expect(rij(a).status).toBe('verstuurd');
    expect(rij(a).geldig_tot).toBe('2027-03-03'); // V-12: opnieuw berekend (30 dagen)
  });

  it('bestandsnaam: vreemde tekens, bedrijfsnaam, bestaand bestand krijgt -2 (FE-056)', async () => {
    const a = offerte(maakKlant({ achternaam: 'Jansen/de Vries' }));
    const b = offerte(maakKlant({ aanhef: 'bedrijf', achternaam: 'Piet', bedrijfsnaam: 'Bouw B.V.' }));
    const c = offerte(maakKlant({ achternaam: 'Oud' }));
    expect(basename((await maakDefinitief(a, nepRenderer)).pad)).toBe('2026-09-25-001 Jansen-de Vries.pdf');
    expect(basename((await maakDefinitief(b, nepRenderer)).pad)).toBe('2026-09-25-002 Bouw B.V.pdf');
    writeFileSync(join(nep.docs, '2026', '2026-09-25-003 Oud.pdf'), 'van de gebruiker');
    const pad = (await maakDefinitief(c, nepRenderer)).pad;
    expect(basename(pad)).toBe('2026-09-25-003 Oud-2.pdf');
    expect(bestanden(2026)).toContain('2026-09-25-003 Oud.pdf');
  });

  it('pdf-bezet: PDF_BESTAND_BEZET, niets vastgelegd, volgende poging krijgt hetzelfde nummer', async () => {
    const a = offerte();
    zetVandaag('2026-09-25', true);
    expect(await foutcode(maakDefinitief(a, nepRenderer))).toBe('PDF_BESTAND_BEZET');
    expect(rij(a)).toMatchObject({ status: 'concept', nummer: null, jaar: null });
    expect(pdfRegels(a)).toEqual([]);
    expect(bestanden(2026)).toEqual([]);
    expect(readdirSync(nep.tmp)).toEqual([]);

    zetVandaag('2026-09-25');
    expect((await maakDefinitief(a, nepRenderer)).nummer).toBe('2026-09-25-001');
  });

  it('fout in de transactie van stap 5: PDF weer weg en ONBEKEND', async () => {
    const a = offerte();
    await maakDefinitief(a, nepRenderer);
    // Een regel met letter 'c' naast '' → volgende versieletter is 'c' → UNIQUE-conflict in stap 5.
    db.db
      .prepare(
        "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES ('x', ?, 'c', 'x', 'x')",
      )
      .run(a);
    expect(await foutcode(maakDefinitief(a, nepRenderer))).toBe('ONBEKEND');
    expect(bestanden(2026)).toEqual(['2026-09-25-001 Jansen.pdf']);
  });

  it('gelijktijdig: twee concepten krijgen na elkaar twee opeenvolgende nummers', async () => {
    const a = offerte();
    const b = offerte(maakKlant({ achternaam: 'Pietersen' }));
    const [ra, rb] = await Promise.all([maakDefinitief(a, traagRenderer), maakDefinitief(b, traagRenderer)]);
    expect([ra.nummer, rb.nummer].sort()).toEqual(['2026-09-25-001', '2026-09-25-002']);
  });

  it('een mislukte aanroep blokkeert de volgende niet', async () => {
    const zonder = offerte(jansen, '2026-09-25', false);
    const a = offerte();
    expect(await foutcode(maakDefinitief(zonder, nepRenderer))).toBe('VALIDATIE');
    expect((await maakDefinitief(a, nepRenderer)).nummer).toBe('2026-09-25-001');
  });

  it('OFM-047: na definitief mag bewaarInvoer (aanpassen via de wizard); een wijziging vraagt een nieuwe PDF', async () => {
    const a = offerte();
    await maakDefinitief(a, nepRenderer);
    bewaarInvoer({ id: a, wizardStap: 3 }, 30);
    expect(rij(a).gewijzigd_na_definitief).toBe(0);
    bewaarInvoer({ id: a, offertedatum: '2026-09-30' }, 30);
    expect(rij(a).gewijzigd_na_definitief).toBe(1);
    expect(rij(a).status).toBe('klaar');
  });
});

describe('openen, afdrukken, map (§12.4, FE-057)', () => {
  const evt = {} as IpcMainInvokeEvent;
  const h = <K extends keyof typeof offerteDefinitiefHandlers>(k: K) =>
    maakIpcHandler(k, offerteDefinitiefHandlers[k] as never) as (
      e: IpcMainInvokeEvent,
      i: unknown,
    ) => Promise<Resultaat<unknown>>;

  it('zonder PDF: VALIDATIE "Maak de offerte eerst definitief."', async () => {
    const a = offerte();
    for (const k of ['offerte:openPdf', 'offerte:afdrukken', 'offerte:toonInMap'] as const) {
      expect(await h(k)(evt, { id: a })).toEqual({
        ok: false,
        fout: { code: 'VALIDATIE', melding: 'Maak de offerte eerst definitief.' },
      });
    }
  });

  it('met PDF: openPath, showItemInFolder en print in een verborgen venster', async () => {
    const a = offerte();
    await maakDefinitief(a, nepRenderer);
    bewaarHandmatigeInhoud(a, haalOfferte(a).inhoud as OfferteInhoud);
    const { pad } = await maakDefinitief(a, nepRenderer);

    expect(await h('offerte:openPdf')(evt, { id: a })).toEqual({ ok: true, data: null });
    expect(nep.shell.openPath).toHaveBeenCalledWith(pad);
    expect(await h('offerte:toonInMap')(evt, { id: a })).toEqual({ ok: true, data: null });
    expect(nep.shell.showItemInFolder).toHaveBeenCalledWith(pad);

    expect(await h('offerte:afdrukken')(evt, { id: a })).toEqual({ ok: true, data: null });
    expect(nep.vensters).toHaveLength(1);
    expect(nep.vensters[0]?.opties).toEqual(VERBORGEN_VENSTER);
    expect(nep.vensters[0]?.print).toHaveBeenCalledWith(
      { silent: false, printBackground: true },
      expect.any(Function),
    );
    expect(nep.vensters[0]?.destroy).toHaveBeenCalled();
    expect(readdirSync(nep.tmp)).toEqual([]);
  });

  it('PDF verdwenen of openen mislukt: ONBEKEND', async () => {
    const a = offerte();
    const { pad } = await maakDefinitief(a, nepRenderer);
    nep.shell.openPath.mockResolvedValueOnce('geen programma');
    expect(await h('offerte:openPdf')(evt, { id: a })).toMatchObject({
      ok: false,
      fout: { code: 'ONBEKEND' },
    });
    rmSync(pad);
    expect(await h('offerte:toonInMap')(evt, { id: a })).toMatchObject({
      ok: false,
      fout: { code: 'ONBEKEND' },
    });
  });

  it('weigert ongeldige invoer (NFE-014)', async () => {
    for (const k of [
      'offerte:maakDefinitief',
      'offerte:openPdf',
      'offerte:afdrukken',
      'offerte:toonInMap',
    ] as const) {
      for (const invoer of [{}, { id: '' }, { id: 7 }, null]) {
        expect(await h(k)(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
      }
    }
  });
});
