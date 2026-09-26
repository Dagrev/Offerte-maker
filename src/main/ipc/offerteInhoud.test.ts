import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { berekenTotalen } from '@shared/calc/bedragen';
import { formatEuro } from '@shared/formatteer';
import { KEUZE_STARTSET } from '@shared/keuzelijsten';
import { gelePunten } from '@shared/offerteBewerken';
import type { Resultaat } from '@shared/fouten';
import type { Klant, KlusInvoer, OfferteDetail, OfferteInhoud } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

const nep = vi.hoisted(() => ({ agentMap: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../venster', () => ({ huidigVenster: () => null }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
  },
}));

const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { bewaarNieuweVersie } = await import('../db/repo/offertesInhoud');
const { maakOfferte } = await import('../agent/taken');
const { legeStatusCache } = await import('../agent/claudeStatus');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { maakIpcHandler } = await import('./registreer');
const { offerteInvoerHandlers } = await import('./offerteInvoer');
const { offerteInhoudHandlers } = await import('./offerteInhoud');
const { garantieTekst, stelPdfModelSamen } = await import('../pdf/pdfModel');
const { haalInstelling, bewaarInstelling } = await import('../db/repo/instellingen');

let db: TestDatabase;
let claude: NepClaude | undefined;

beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm-inhoud-'));
  legeStatusCache();
  zetTesthakenVoorTest(new Map());
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

const evt = {} as IpcMainInvokeEvent;
const haalIpc = maakIpcHandler('offerte:haal', offerteInvoerHandlers['offerte:haal']);
const bewaarIpc = maakIpcHandler('offerte:bewaarInhoud', offerteInhoudHandlers['offerte:bewaarInhoud']);
const voorbeeldIpc = maakIpcHandler('offerte:voorbeeldHtml', offerteInhoudHandlers['offerte:voorbeeldHtml']);

function data<T>(r: Resultaat<T>): T {
  if (!r.ok) throw new Error(`${r.fout.code}: ${r.fout.melding}`);
  return r.data;
}
const haal = async (id: string): Promise<OfferteDetail> => data(await haalIpc(evt, { id }));
const bewaar = async (id: string, inhoud: OfferteInhoud) => data(await bewaarIpc(evt, { id, inhoud }));
const schatting = (o: string, p: string, e: string) => `Geschatte prijs: ${o} (${p} per ${e}).`;

const jansen: Klant = maakKlant({
  voornaam: '',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
  email: 'jansen@mail.nl',
});
const metWerkadres: Klant = {
  ...jansen,
  heeftWerkadres: true,
  werkadres: { straatHuisnummer: 'Kerkweg 3', postcode: '5611 CD', plaats: 'Eindhoven' },
};
const PII = [
  'Jansen',
  'Dorpsstraat',
  'Veldhoven',
  '5501',
  '12345678',
  'jansen@mail.nl',
  'Kerkweg',
  'Eindhoven',
];

function offerteMet(klant: Klant, invoer: KlusInvoer = maakInvoer()): string {
  const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer({ id, klant, invoer, wizardStap: 4 }, 30);
  return id;
}

/** Inhoud zoals de agent hem na §10.7 opslaat: alleen plaatshouders. */
function agentInhoud(): OfferteInhoud {
  return {
    titel: 'Offerte dak [WERK_ADRES]',
    inleiding: 'Beste [KLANT_NAAM], hierbij de offerte voor het dak aan de [WERK_ADRES] in [WERK_PLAATS].',
    werkomschrijving: ['Oude bedekking verwijderen', 'EPDM aanbrengen in [WERK_PLAATS]'],
    regels: [
      {
        id: 'r1',
        omschrijving: 'EPDM 1,1 mm',
        aantalHonderdsten: 1000,
        eenheid: 'm²',
        prijsCent: 500,
        btwTarief: 21,
        prijsbron: 'prijslijst',
        prijspostId: 'start-epdm_11',
      },
      {
        id: 'r2',
        omschrijving: 'Daktrim',
        aantalHonderdsten: 200,
        eenheid: 'm¹',
        prijsCent: 2750,
        btwTarief: 21,
        prijsbron: 'schatting',
        prijspostId: null,
      },
    ],
    uitvoering: 'Uitvoering in overleg.',
    opmerkingen: '',
    afsluiting: 'Met vriendelijke groet.',
    controlepunten: ['Controleer de ondergrond.'],
  };
}

function offerteMetInhoud(klant: Klant, inhoud: OfferteInhoud = agentInhoud(), invoer?: KlusInvoer) {
  const id = offerteMet(klant, invoer);
  bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  return id;
}

const rij = (id: string) =>
  db.db
    .prepare('SELECT inhoud_json, totaal_incl_cent, gewijzigd_na_definitief FROM offertes WHERE id = ?')
    .get(id) as { inhoud_json: string; totaal_incl_cent: number; gewijzigd_na_definitief: number };
const versies = (id: string) =>
  db.db
    .prepare(
      'SELECT versie_nr AS versieNr, bron FROM offerte_versies WHERE offerte_id = ? ORDER BY versie_nr',
    )
    .all(id) as { versieNr: number; bron: string }[];

describe('offerte:haal met inhoud (§6.3, §11.4, FE-037)', () => {
  it('vult [KLANT_NAAM] en [WERK_PLAATS] in en rekent de totalen', async () => {
    const id = offerteMetInhoud(metWerkadres);
    const detail = await haal(id);
    expect(detail.inhoud?.inleiding).toBe(
      'Beste Jansen, hierbij de offerte voor het dak aan de Kerkweg 3 in Eindhoven.',
    );
    const tekst = JSON.stringify(detail.inhoud);
    expect(tekst).not.toMatch(/\[KLANT_|\[WERK_/);
    expect(detail.totalen).toEqual(berekenTotalen(agentInhoud().regels));
  });

  it(
    'door de agent gemaakt (nep-CLI): geen plaatshouders, gele balk met 3 punten',
    { timeout: 30_000 },
    async () => {
      claude = gebruikNepClaude('ok');
      const id = offerteMet(jansen);
      await maakOfferte(id, { stuur: () => undefined });
      expect(rij(id).inhoud_json).toContain('[KLANT_NAAM]');

      const detail = await haal(id);
      const inhoud = detail.inhoud as OfferteInhoud;
      expect(inhoud.inleiding).toContain('gesprek met Jansen');
      expect(JSON.stringify(inhoud)).not.toMatch(/\[KLANT_|\[WERK_/);
      expect(detail.totalen).toEqual(berekenTotalen(inhoud.regels));

      const punten = gelePunten(inhoud, schatting);
      expect(punten).toHaveLength(3);
      expect(punten[2]).toBe(`Geschatte prijs: Aluminium daktrim (${formatEuro(2750)} per m¹).`);

      // V-05: prijs van de schattingsregel wijzigen en bewaren → handmatig, balk met 2 punten.
      const regels = inhoud.regels.map((r) => (r.prijsbron === 'schatting' ? { ...r, prijsCent: 3000 } : r));
      await bewaar(id, { ...inhoud, regels });
      const na = (await haal(id)).inhoud as OfferteInhoud;
      expect(na.regels.find((r) => r.omschrijving === 'Aluminium daktrim')?.prijsbron).toBe('handmatig');
      expect(gelePunten(na, schatting)).toHaveLength(2);
    },
  );
});

describe('offerte:bewaarInhoud (§11.4, §12.3, V-05, V-12)', () => {
  it('slaat plaatshouders op, ook als de klantnaam in een tekstvak is getypt', async () => {
    const id = offerteMetInhoud(metWerkadres);
    const ingevuld = (await haal(id)).inhoud as OfferteInhoud;
    const gewijzigd: OfferteInhoud = {
      ...ingevuld,
      opmerkingen:
        'Afspraak met meneer Jansen (06 1234 5678, JANSEN@mail.nl) op Dorpsstraat 12, 5501 AB Veldhoven.',
      werkomschrijving: [...ingevuld.werkomschrijving, 'Werk aan de Kerkweg 3 in Eindhoven'],
    };
    expect(await bewaar(id, gewijzigd)).toEqual({ versieNr: 2 });

    const json = rij(id).inhoud_json;
    for (const w of PII) expect(json.toLowerCase()).not.toContain(w.toLowerCase());
    expect(json).toContain('[KLANT_NAAM]');
    expect(versies(id)).toEqual([
      { versieNr: 1, bron: 'agent' },
      { versieNr: 2, bron: 'handmatig' },
    ]);
    // Terug in de weergave staat de echte tekst weer.
    expect((await haal(id)).inhoud?.opmerkingen).toContain('meneer Jansen');
  });

  it('nieuwe regel en gewijzigde prijs worden handmatig; verwijderd controlepunt blijft weg; totaal klopt', async () => {
    const id = offerteMetInhoud(jansen);
    const ingevuld = (await haal(id)).inhoud as OfferteInhoud;
    const [r1, r2] = ingevuld.regels as [OfferteInhoud['regels'][0], OfferteInhoud['regels'][0]];
    const nieuw = {
      id: 'nieuw-1',
      omschrijving: 'Steiger',
      aantalHonderdsten: 100,
      eenheid: 'post' as const,
      prijsCent: 25000,
      btwTarief: 21 as const,
      prijsbron: 'schatting' as const, // een nieuwe regel wordt altijd handmatig
      prijspostId: null,
    };
    await bewaar(id, {
      ...ingevuld,
      regels: [{ ...r2, aantalHonderdsten: 300 }, { ...r1, prijsCent: 600 }, nieuw],
      controlepunten: [],
    });
    const opgeslagen = JSON.parse(rij(id).inhoud_json) as OfferteInhoud;
    expect(opgeslagen.regels.map((r) => [r.id, r.prijsbron])).toEqual([
      ['r2', 'schatting'], // alleen het aantal gewijzigd
      ['r1', 'handmatig'],
      ['nieuw-1', 'handmatig'],
    ]);
    expect(opgeslagen.regels[1]?.prijspostId).toBe('start-epdm_11');
    expect(opgeslagen.controlepunten).toEqual([]);
    expect(rij(id).totaal_incl_cent).toBe(berekenTotalen(opgeslagen.regels).totaalCent);
    expect(rij(id).gewijzigd_na_definitief).toBe(0);
  });

  it('zet gewijzigd_na_definitief bij een definitieve offerte (§12.3)', async () => {
    const id = offerteMetInhoud(jansen);
    db.db.prepare("UPDATE offertes SET nummer = '2026-001', status = 'klaar' WHERE id = ?").run(id);
    await bewaar(id, (await haal(id)).inhoud as OfferteInhoud);
    expect(rij(id).gewijzigd_na_definitief).toBe(1);
    expect((await haal(id)).gewijzigdNaDefinitief).toBe(true);
  });

  it('V-02: ongewijzigd bewaren met werkadres geeft exact dezelfde inhoud_json', async () => {
    const id = offerteMetInhoud(metWerkadres);
    const voor = rij(id).inhoud_json;
    await bewaar(id, (await haal(id)).inhoud as OfferteInhoud);
    expect(rij(id).inhoud_json).toBe(voor);
    await bewaar(id, (await haal(id)).inhoud as OfferteInhoud);
    expect(rij(id).inhoud_json).toBe(voor);
  });

  it('V-02: zonder werkadres verandert twee keer bewaren niets en komt er geen plaatsnaam bij', async () => {
    const id = offerteMetInhoud(jansen);
    const weergave = (await haal(id)).inhoud as OfferteInhoud;
    const tel = (i: OfferteInhoud) => JSON.stringify(i).split('Veldhoven').length - 1;

    await bewaar(id, weergave);
    const eerste = rij(id).inhoud_json;
    const naEerste = (await haal(id)).inhoud as OfferteInhoud;
    expect(naEerste).toEqual(weergave); // weergave-invariant (V-27)
    expect(tel(naEerste)).toBe(tel(weergave));

    await bewaar(id, naEerste);
    expect(rij(id).inhoud_json).toBe(eerste);
    expect((await haal(id)).inhoud).toEqual(weergave);
  });

  it('weigert ongeldige invoer (NFE-014)', async () => {
    const id = offerteMetInhoud(jansen);
    const inhoud = (await haal(id)).inhoud as OfferteInhoud;
    const fouten = await Promise.all([
      bewaarIpc(evt, { id }),
      bewaarIpc(evt, { id: '', inhoud }),
      bewaarIpc(evt, { id, inhoud: { ...inhoud, titel: 5 } }),
      bewaarIpc(evt, {
        id,
        inhoud: { ...inhoud, regels: [{ ...inhoud.regels[0], aantalHonderdsten: 1.5 }] },
      }),
      bewaarIpc(evt, { id, inhoud: { ...inhoud, regels: [{ ...inhoud.regels[0], btwTarief: 6 }] } }),
      bewaarIpc(evt, { id: 'bestaat-niet', inhoud }),
    ]);
    for (const f of fouten) expect(f).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    expect(versies(id)).toHaveLength(1);
  });

  it('weigert een offerte zonder inhoud', async () => {
    const id = offerteMet(jansen);
    expect(await bewaarIpc(evt, { id, inhoud: agentInhoud() })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
  });
});

describe('offerte:voorbeeldHtml (§12.3 stap 1, §12.5)', () => {
  it('levert HTML in modus voorbeeld met ingevulde inhoud, aanhef, garantie en concept', async () => {
    const id = offerteMetInhoud(metWerkadres, agentInhoud(), maakInvoer({ garantieJaren: '20' }));
    bewaarInstelling('bedrijf', { ...haalInstelling('bedrijf'), naam: 'Dakwerken Test', kvk: '12345678' });
    const { html } = data(await voorbeeldIpc(evt, { id }));
    expect(html).toContain('Geachte heer Jansen,');
    expect(html).toContain('Kerkweg 3');
    expect(html).toContain('Dakwerken Test');
    expect(html).toContain(haalInstelling('teksten').garantie20);
    expect(html).toContain('CONCEPT');
    expect(html).toContain('@font-face');
    expect(html).not.toMatch(/\[KLANT_|\[WERK_/);
  });

  it('weigert ongeldige invoer en een offerte zonder inhoud', async () => {
    const id = offerteMet(jansen);
    for (const invoer of [{}, { id: '' }, { id: 5 }, { id }]) {
      expect(await voorbeeldIpc(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
  });
});

describe('stelPdfModelSamen', () => {
  it('kiest garantie 10, neemt het nummer over en kan het nummer vervangen', async () => {
    const id = offerteMetInhoud(jansen);
    db.db.prepare("UPDATE offertes SET nummer = '2026-007' WHERE id = ?").run(id);
    const detail = await haal(id);
    const bron = {
      detail,
      bedrijf: haalInstelling('bedrijf'),
      logoDataUri: null,
      opmaak: haalInstelling('opmaak'),
      teksten: haalInstelling('teksten'),
      keuzes: KEUZE_STARTSET,
      fontCss: '',
    };
    const model = stelPdfModelSamen(bron);
    expect(model.nummer).toBe('2026-007');
    expect(model.garantietekst).toBe(bron.teksten.garantie10);
    expect(model.aanhefregel).toBe('Geachte heer Jansen,');
    expect(model.geldigTot).toBe(detail.geldigTot);
    expect(model.totalen).toEqual(detail.totalen);
    expect(stelPdfModelSamen({ ...bron, nummer: '2026-007B' }).nummer).toBe('2026-007B');
    expect(stelPdfModelSamen({ ...bron, nummer: null }).nummer).toBeNull();
  });

  it('garantietekst per keuze: 10, 20 en een zelf toegevoegde garantie (OFM-034)', () => {
    const teksten = { garantie10: 'Tien', garantie20: 'Twintig' };
    const keuzes = { garantie: [{ sleutel: '15_jaar', label: '15 jaar' }] };
    expect(garantieTekst('10', teksten, keuzes)).toBe('Tien');
    expect(garantieTekst('20', teksten, keuzes)).toBe('Twintig');
    expect(garantieTekst('15_jaar', teksten, keuzes)).toBe(
      'Op de uitgevoerde werkzaamheden geven wij garantie: 15 jaar.',
    );
    // OFM-049: zonder garantiekeuze (geen standaard) geen tekst.
    expect(garantieTekst(null, teksten, keuzes)).toBe('');
  });
});
