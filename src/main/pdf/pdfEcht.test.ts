import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { extractText, getDocumentProxy } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatEuro } from '@shared/formatteer';
import type { Bedrijf, Klant, OfferteInhoud } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { echtePdf } from '../../../test/helpers/pdf';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

// NFE-021 en FE-050/054 op een echte PDF: de volledige `maakDefinitief`-stroom, met als renderer een
// echte Electron-app (test/helpers/pdf-electron.mjs) die dezelfde venster- en printopties gebruikt.

const nep = vi.hoisted(() => ({ tmp: '', docs: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: vi.fn() },
  shell: {},
  BrowserWindow: class {},
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
const { bewaarNieuweVersie } = await import('../db/repo/offertesInhoud');
const { haalInstelling, bewaarInstelling } = await import('../db/repo/instellingen');
const { bewaarLogoBestand } = await import('../instellingen/beheer');
const { maakDefinitief } = await import('./definitief');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { printOpties, VERBORGEN_VENSTER } = await import('./maakPdf');
const { offerteInhoudHandlers } = await import('../ipc/offerteInhoud');

/** PNG met ruis (onsamendrukbaar): 400 × 400 RGB ≈ 480 kB, net onder de 500 kB uit NFE-021. */
function ruisPng(zijde: number): Buffer {
  const stuk = (type: string, data: Buffer) => {
    const lengte = Buffer.alloc(4);
    lengte.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([lengte, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(zijde, 0);
  ihdr.writeUInt32BE(zijde, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rauw = Buffer.alloc((zijde * 3 + 1) * zijde);
  let x = 12345;
  for (let i = 0; i < rauw.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    rauw[i] = i % (zijde * 3 + 1) === 0 ? 0 : x >> 16;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stuk('IHDR', ihdr),
    stuk('IDAT', deflateSync(rauw, { level: 9 })),
    stuk('IEND', Buffer.alloc(0)),
  ]);
}

const inhoud: OfferteInhoud = {
  titel: 'Offerte vervangen dakbedekking',
  inleiding: 'Beste [KLANT_NAAM], hierbij onze offerte voor het werk aan de [WERK_ADRES].',
  werkomschrijving: ['Oude bedekking verwijderen', 'EPDM 1,5 mm aanbrengen', 'Daktrim plaatsen'],
  regels: [
    {
      id: 'r1',
      omschrijving: 'Slopen en afvoeren',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 1250,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
    {
      id: 'r2',
      omschrijving: 'EPDM dakbedekking 1,5 mm',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 4500,
      btwTarief: 21,
      prijsbron: 'schatting',
      prijspostId: null,
    },
    {
      id: 'r3',
      omschrijving: 'Isolatie',
      aantalHonderdsten: 100,
      eenheid: 'post',
      prijsCent: 15000,
      btwTarief: 9,
      prijsbron: 'handmatig',
      prijspostId: null,
    },
  ],
  uitvoering: 'Binnen vier weken na opdracht.',
  opmerkingen: 'Let op de dakkapel aan de achterzijde.',
  afsluiting: 'Wij vertrouwen erop u hiermee een passende aanbieding te doen.',
  controlepunten: [],
};

const klant: Klant = maakKlant({
  voornaam: '',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
});

let db: TestDatabase;
let pdf: Buffer;
let pad: string;
let voorbeeldHtml: string;
let logoBytes: number;

beforeAll(async () => {
  db = await maakTestDatabase();
  nep.tmp = mkdtempSync(join(tmpdir(), 'ofm-echt-tmp-'));
  nep.docs = mkdtempSync(join(tmpdir(), 'ofm-echt-docs-'));
  const bedrijf: Bedrijf = {
    ...haalInstelling('bedrijf'),
    naam: 'Dakwerken De Test',
    contactpersoon: 'Kees Test',
    adres: 'Industrieweg 1',
    postcode: '5600 AA',
    plaats: 'Eindhoven',
    kvk: '12345678',
    btwNummer: 'NL001234567B01',
    iban: 'NL00BANK0123456789',
  };
  bewaarInstelling('bedrijf', bedrijf);
  const logo = join(nep.tmp, 'logo.png');
  writeFileSync(logo, ruisPng(400));
  logoBytes = statSync(logo).size;
  bewaarLogoBestand(logo);
  rmSync(logo);

  const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer({ id, klant, invoer: maakInvoer(), wizardStap: 4 }, 30);
  bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  voorbeeldHtml = (await offerteInhoudHandlers['offerte:voorbeeldHtml']({ id }, {} as never)).html;

  zetTesthakenVoorTest(new Map([['vandaag', '2026-09-25']]));
  ({ pad } = await maakDefinitief(id, (html, b) => echtePdf(html, VERBORGEN_VENSTER, printOpties(b))));
  pdf = readFileSync(pad);
}, 90_000);

afterAll(() => {
  db.opruimen();
  rmSync(nep.tmp, { recursive: true, force: true });
  rmSync(nep.docs, { recursive: true, force: true });
});

const plat = (t: string) => t.replace(/\s+/g, ' ').trim();

describe('echte PDF (NFE-021, FE-050, FE-054)', () => {
  it('A4 (595 × 842 pt), ≤ 2 MB met een logo van ≤ 500 kB, lettertypes ingesloten', async () => {
    expect(logoBytes).toBeLessThanOrEqual(500 * 1024);
    expect(pdf.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const pagina = await doc.getPage(1);
    const { width, height } = pagina.getViewport({ scale: 1 });
    // A4 = 595,28 × 841,89 pt; Chromium rondt het papierformaat af op honderdsten van een inch.
    expect(Math.abs(width - 595.28)).toBeLessThan(1);
    expect(Math.abs(height - 841.89)).toBeLessThan(1);
    const ruw = pdf.toString('latin1');
    expect(ruw).toMatch(/\/FontFile[23]?/);
    expect(ruw).toContain('Inter');
  });

  it('marges: 20 mm links, rechts en boven, 25 mm onder met de voettekst daarin', async () => {
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const mm = 72 / 25.4;
    for (let p = 1; p <= doc.numPages; p++) {
      const pagina = await doc.getPage(p);
      const { width, height } = pagina.getViewport({ scale: 1 });
      const { items } = await pagina.getTextContent();
      const tekst = items.filter((i) => 'str' in i && i.str.trim() !== '') as {
        str: string;
        transform: number[];
        width: number;
      }[];
      const voet = tekst.filter((i) => /pagina|KvK/.test(i.str));
      const body = tekst.filter((i) => !voet.includes(i));
      expect(voet.length).toBeGreaterThan(0);
      for (const i of voet) expect(i.transform[5]).toBeLessThan(25 * mm);
      for (const i of body) {
        const [, , , , x = 0, y = 0] = i.transform;
        expect(x).toBeGreaterThanOrEqual(20 * mm - 1);
        expect(x + i.width).toBeLessThanOrEqual(width - 20 * mm + 1);
        expect(y).toBeGreaterThanOrEqual(25 * mm - 1);
        expect(y).toBeLessThanOrEqual(height - 20 * mm + 1);
      }
      if (p === 1) {
        // Links uitgelijnde tekst begint precies op de marge.
        expect(Math.min(...body.map((i) => i.transform[4] ?? 0))).toBeCloseTo(20 * mm, 0);
      }
    }
  });

  it('bevat de onderdelen uit FO §9 en dezelfde teksten en bedragen als het voorbeeld (FE-050)', async () => {
    const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
    const pdfTekst = plat(text);
    const voorbeeldTekst = plat(
      voorbeeldHtml
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&'),
    );
    const verwacht = [
      'Dakwerken De Test',
      'Dhr. Jansen',
      'Dorpsstraat 12',
      '5501 AB Veldhoven',
      'Offertenummer',
      'Geachte heer Jansen,',
      inhoud.titel,
      'Beste Jansen, hierbij onze offerte voor het werk aan de Dorpsstraat 12.',
      'Werkomschrijving',
      ...inhoud.werkomschrijving,
      'Prijsopgave',
      ...inhoud.regels.map((r) => r.omschrijving),
      formatEuro(43500),
      formatEuro(156600),
      formatEuro(15000),
      'Uitvoering en planning',
      'Garantie',
      'Opmerkingen',
      inhoud.opmerkingen,
      'Voorwaarden',
      'Voor akkoord',
      inhoud.afsluiting,
      'Met vriendelijke groet,',
      'Kees Test',
    ];
    for (const stuk of verwacht) {
      expect(pdfTekst, stuk).toContain(stuk);
      expect(voorbeeldTekst, stuk).toContain(stuk);
    }
    expect(pdfTekst).not.toMatch(/\[KLANT_|\[WERK_/);
    // Alleen het nummer verschilt: het voorbeeld is nog een concept.
    expect(pdfTekst).toContain('Offertenummer 2026-09-25-001');
    expect(pdfTekst).not.toContain('CONCEPT');
    expect(pdfTekst).toContain('KvK 12345678 · btw NL001234567B01 · IBAN NL00BANK0123456789');
    expect(pdfTekst).toMatch(/pagina 1 van \d/);
  });
});
