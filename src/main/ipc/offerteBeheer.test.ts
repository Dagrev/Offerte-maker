import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resultaat } from '@shared/fouten';
import type { Klant, OfferteDetail, OfferteInhoud } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
}));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { bewaarNieuweVersie } = await import('../db/repo/offertesInhoud');
const { lijstOverzicht, zoekOffertes } = await import('../db/repo/offertesLezen');
const { openDatabase, gebruikDatabase } = await import('../db/verbinding');
const { schoonOp } = await import('../db/opschonen');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { maakIpcHandler } = await import('./registreer');
const { offerteBeheerHandlers } = await import('./offerteBeheer');
const { offerteInvoerHandlers } = await import('./offerteInvoer');

let db: TestDatabase;
let pdfMap: string;
beforeEach(async () => {
  db = await maakTestDatabase();
  pdfMap = mkdtempSync(join(tmpdir(), 'ofm-beheer-'));
  zetTesthakenVoorTest(new Map([['vandaag', '2026-09-25']]));
});
afterEach(() => {
  db.opruimen();
  rmSync(pdfMap, { recursive: true, force: true });
});

const evt = {} as IpcMainInvokeEvent;
type Aanroep = (e: IpcMainInvokeEvent, i: unknown) => Promise<Resultaat<unknown>>;
const handlers: Record<string, unknown> = { ...offerteBeheerHandlers, ...offerteInvoerHandlers };
const h = (k: keyof typeof offerteBeheerHandlers | keyof typeof offerteInvoerHandlers): Aanroep =>
  maakIpcHandler(k, handlers[k] as never);
async function data<T>(p: Promise<Resultaat<unknown>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`${r.fout.code}: ${r.fout.melding}`);
  return r.data as T;
}
const haal = (id: string) => data<OfferteDetail>(h('offerte:haal')(evt, { id }));
const nieuw = (invoer: unknown = {}) => data<{ id: string }>(h('offerte:nieuw')(evt, invoer));

const klant: Klant = maakKlant({
  naam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  heeftWerkadres: true,
  werkadres: { straatHuisnummer: 'Kerkweg 3', postcode: '5611 CD', plaats: 'Eindhoven' },
});
const inhoud: OfferteInhoud = {
  titel: 'Offerte',
  inleiding: 'Beste [KLANT_NAAM],',
  werkomschrijving: [],
  regels: [],
  uitvoering: '',
  opmerkingen: '',
  afsluiting: '',
  controlepunten: [],
};

/** Definitieve offerte: inhoud, nummer en een PDF-regel (met een echt bestand). */
async function definitieveOfferte(): Promise<{ id: string; pdf: string }> {
  const { id } = await nieuw();
  bewaarInvoer({ id, klant, invoer: maakInvoer(), wizardStap: 4 }, 30);
  bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  const pdf = join(pdfMap, '2026-001 Jansen.pdf');
  writeFileSync(pdf, '%PDF');
  db.db
    .prepare(
      "UPDATE offertes SET jaar = 2026, volgnummer = 1, nummer = '2026-001', status = 'klaar' WHERE id = ?",
    )
    .run(id);
  db.db
    .prepare(
      "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES ('p1', ?, '', ?, ?)",
    )
    .run(id, pdf, new Date().toISOString());
  return { id, pdf };
}

describe('offerte:zetStatus (FE-060, V-11)', () => {
  it('concept: VALIDATIE "Maak de offerte eerst definitief."', async () => {
    const { id } = await nieuw();
    expect(await h('offerte:zetStatus')(evt, { id, status: 'klaar' })).toEqual({
      ok: false,
      fout: { code: 'VALIDATIE', melding: 'Maak de offerte eerst definitief.' },
    });
  });

  it('akkoord blijft na herstart bewaard en staat in de lijst', async () => {
    const { id } = await definitieveOfferte();
    expect(await h('offerte:zetStatus')(evt, { id, status: 'akkoord' })).toEqual({ ok: true, data: null });
    // "Herstart": verbinding dicht en opnieuw open.
    db.db.close();
    const opnieuw = openDatabase(db.pad);
    gebruikDatabase(opnieuw);
    try {
      expect((await haal(id)).status).toBe('akkoord');
      expect(lijstOverzicht('maand', '2026-09-25').items[0]?.status).toBe('akkoord');
    } finally {
      opnieuw.close();
    }
  });

  it('weigert ongeldige invoer, concept als status en een verwijderde offerte', async () => {
    const { id } = await definitieveOfferte();
    for (const invoer of [
      { id, status: 'concept' },
      { id, status: 'x' },
      { id },
      { status: 'klaar' },
      null,
    ]) {
      expect(await h('offerte:zetStatus')(evt, invoer)).toMatchObject({
        ok: false,
        fout: { code: 'VALIDATIE' },
      });
    }
    await h('offerte:verwijder')(evt, { id });
    expect(await h('offerte:zetStatus')(evt, { id, status: 'verstuurd' })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE', melding: 'Ongeldige invoer.' },
    });
  });
});

describe('verwijderen, prullenbak en terugzetten (FE-062)', () => {
  it('verdwijnt uit lijst en zoeken, staat in de prullenbak, en komt volledig terug', async () => {
    const { id } = await definitieveOfferte();
    bewaarNieuweVersie({ id, inhoud: { ...inhoud, titel: 'Tweede' }, bron: 'handmatig' });
    const voor = await haal(id);

    expect(await h('offerte:verwijder')(evt, { id })).toEqual({ ok: true, data: null });
    expect(lijstOverzicht('maand', '2026-09-25').items).toEqual([]);
    expect(zoekOffertes('jansen')).toEqual([]);
    const bak = await data<{ id: string; nummer: string }[]>(h('prullenbak:lijst')(evt, undefined));
    expect(bak.map((i) => [i.id, i.nummer])).toEqual([[id, '2026-001']]);

    expect(await h('offerte:zetTerug')(evt, { id })).toEqual({ ok: true, data: null });
    expect(await haal(id)).toEqual(voor);
    expect(zoekOffertes('jansen').map((i) => i.id)).toEqual([id]);
    expect(await data<unknown[]>(h('prullenbak:lijst')(evt, undefined))).toEqual([]);
  });

  it('twee keer verwijderen of terugzetten, of een onbekend id: VALIDATIE', async () => {
    const { id } = await nieuw();
    expect(await h('offerte:zetTerug')(evt, { id })).toMatchObject({ ok: false });
    await h('offerte:verwijder')(evt, { id });
    expect(await h('offerte:verwijder')(evt, { id })).toMatchObject({ ok: false });
    for (const k of ['offerte:verwijder', 'offerte:zetTerug'] as const) {
      for (const invoer of [{ id: 'bestaat-niet' }, { id: '' }, {}]) {
        expect(await h(k)(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
      }
    }
  });

  it('na 91 dagen is de offerte na opschonen weg, de PDF blijft', async () => {
    const { id, pdf } = await definitieveOfferte();
    const toen = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    db.db.prepare('UPDATE offertes SET verwijderd_op = ? WHERE id = ?').run(toen, id);
    expect(schoonOp(db.db).offertes).toBe(1);
    expect(await h('offerte:haal')(evt, { id })).toMatchObject({ ok: false });
    expect(existsSync(pdf)).toBe(true);
  });
});

describe('kopie via offerte:nieuw (FE-061, V-21)', () => {
  it('andere klant: klus mee, klant leeg, geen inhoud, nummer, versies of PDF; stap 1; nieuwe dakvlak-id’s', async () => {
    const { id: bron } = await definitieveOfferte();
    zetTesthakenVoorTest(new Map([['vandaag', '2026-10-02']]));
    const { id } = await nieuw({ bronId: bron, zelfdeKlant: false });
    const [b, k] = [await haal(bron), await haal(id)];
    expect(k).toMatchObject({
      status: 'concept',
      nummer: null,
      inhoud: null,
      totalen: null,
      versies: [],
      pdfs: [],
      wizardStap: 1,
      offertedatum: '2026-10-02',
      geldigTot: '2026-11-01',
    });
    expect(k.klant.naam).toBe('');
    expect(k.klant.heeftWerkadres).toBe(false);
    expect({ ...k.invoer, dakvlakken: [] }).toEqual({ ...b.invoer, dakvlakken: [] });
    expect(k.invoer.dakvlakken.map((v) => ({ ...v, id: '' }))).toEqual(
      b.invoer.dakvlakken.map((v) => ({ ...v, id: '' })),
    );
    expect(k.invoer.dakvlakken[0]?.id).not.toBe(b.invoer.dakvlakken[0]?.id);
  });

  it('zelfde klant: klant mee (met werkadres), stap 2; kopie van een kopie kan ook', async () => {
    const { id: bron } = await definitieveOfferte();
    const { id } = await nieuw({ bronId: bron, zelfdeKlant: true });
    const k = await haal(id);
    expect(k.klant).toEqual(klant);
    expect(k.wizardStap).toBe(2);
    const { id: kk } = await nieuw({ bronId: id, zelfdeKlant: true });
    expect((await haal(kk)).klant).toEqual(klant);
  });

  it('weigert ongeldige kopie-invoer (NFE-014)', async () => {
    for (const invoer of [
      { bronId: '' },
      { bronId: 5 },
      { bronId: 'x', zelfdeKlant: 'ja' },
      { bronId: 'bestaat-niet' },
    ]) {
      expect(await h('offerte:nieuw')(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
  });
});
