import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoutCode } from '@shared/fouten';
import { standaardInstelling } from '@shared/schemas';
import type { Bedrijf } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

// OFM-019: voorbeelden toevoegen, redigeren, goedkeuren, template, verwijderen, met de agentwerkmap
// (FE-080 t/m 083, FE-085; TDO §6.2, §10.3, §11.5, V-16). Echte extractie (unpdf/mammoth), echte
// redactie, echte werkmap in een tijdelijke map.

const nep = vi.hoisted(() => ({
  agentMap: '',
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  dialoog: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: nep.dialoog },
}));
vi.mock('../log', () => ({ log: nep.log }));
vi.mock('../venster', () => ({ huidigVenster: () => null }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
  },
}));

const beheer = await import('./beheer');
const { bewaarInstelling } = await import('../db/repo/instellingen');
const { maakIpcHandler } = await import('../ipc/registreer');
const { voorbeeldenHandlers } = await import('../ipc/voorbeelden');
const { herRedigeerVoorbeelden } = await import('./herRedigeer');
const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { maakOfferte } = await import('../agent/taken');
const { legeStatusCache } = await import('../agent/claudeStatus');
const { bouwSysteemprompt } = await import('../agent/prompts');
const { zetTesthakenVoorTest } = await import('../testhaken');

const FIXTURES = resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'voorbeelden');
const nepEvent = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];

let t: TestDatabase;
let tmp: string;
let claude: NepClaude | undefined;
beforeEach(async () => {
  t = await maakTestDatabase();
  tmp = mkdtempSync(join(tmpdir(), 'ofm019-'));
  nep.agentMap = join(tmp, 'agent');
  vi.clearAllMocks();
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  t.opruimen();
  rmSync(tmp, { recursive: true, force: true });
});

const EIGEN: Bedrijf = {
  ...standaardInstelling('bedrijf'),
  naam: 'Dakwerken Zuid',
  adres: 'Industrieweg 10',
  postcode: '5555 AA',
  plaats: 'Eindhoven',
  telefoon: '040-1234567',
  kvk: '12345678',
  btwNummer: 'NL001234567B01',
  iban: 'NL20INGB0001234567',
};

/** Een `.docx` met deze regels in de tijdelijke map. */
async function docx(naam: string, regels: string[]): Promise<string> {
  const pad = join(tmp, naam);
  const document = new Document({ sections: [{ children: regels.map((r) => new Paragraph(r)) }] });
  writeFileSync(pad, await Packer.toBuffer(document));
  return pad;
}

/** Kopie van een testbestand onder een andere naam (bijv. met een klantnaam erin). */
function fixture(bron: string, naam = bron): string {
  const pad = join(tmp, naam);
  copyFileSync(join(FIXTURES, bron), pad);
  return pad;
}

async function voegToe(...paden: string[]): Promise<string[]> {
  const uit = await beheer.voegVoorbeeldenToe(paden);
  expect(uit.fouten).toEqual([]);
  return uit.toegevoegd;
}

/** Alle tekst in de agentwerkmap (template.md en voorbeelden\), met relatieve paden. */
function werkmap(): Record<string, string> {
  const uit: Record<string, string> = {};
  if (existsSync(join(nep.agentMap, 'template.md'))) {
    uit['template.md'] = readFileSync(join(nep.agentMap, 'template.md'), 'utf8');
  }
  const map = join(nep.agentMap, 'voorbeelden');
  if (existsSync(map)) {
    for (const naam of readdirSync(map)) uit[`voorbeelden/${naam}`] = readFileSync(join(map, naam), 'utf8');
  }
  return uit;
}

const aantal = (tabel: 'voorbeelden' | 'bestanden') =>
  (t.db.prepare(`SELECT COUNT(*) AS n FROM ${tabel}`).get() as { n: number }).n;

async function foutcode(belofte: Promise<unknown> | (() => unknown)): Promise<FoutCode | 'geen fout'> {
  try {
    await (typeof belofte === 'function' ? belofte() : belofte);
    return 'geen fout';
  } catch (e) {
    return (e as { code: FoutCode }).code;
  }
}

const REGELS_10_PII = [
  'Dakwerken Zuid',
  'Industrieweg 10',
  '5555 AA Eindhoven',
  'Tel. 040 123 45 67',
  'KvK 1234 5678',
  'Btw NL 0012.34.567.B01',
  'IBAN NL20 INGB 0001 2345 67',
  '',
  'Dhr. P. Bakker',
  'Kerkstraat 5',
  '1234 AB Utrecht',
  '',
  'Offerte 2023-014',
  'Geachte heer Bakker,',
  'Hierbij ontvangt u onze offerte voor het vervangen van de dakbedekking van uw platte dak.',
  'Wij deden eerder hetzelfde werk aan de Molenlaan 22a.',
  'Neem contact op via 06-98765432 of p.bakker@example.nl.',
  'Uw aanbetaling kwam binnen vanaf NL91 ABNA 0417 1643 00.',
  'Uw buurvrouw is bereikbaar via j.devries@mail.nl.',
  'Met vriendelijke groet,',
  'Dakwerken Zuid',
];
/** De 10 bekende persoonsgegevens van anderen in REGELS_10_PII. */
const PII_10 = [
  'Bakker',
  'Kerkstraat 5',
  '1234 AB',
  'Utrecht',
  'Molenlaan 22a',
  '06-98765432',
  'p.bakker@example.nl',
  'NL91 ABNA 0417 1643 00',
  'j.devries@mail.nl',
  'P. Bakker',
];

describe('voorbeelden:voegToe (FE-080, FE-081)', () => {
  it('tekst-PDF en .docx: leesbare tekst, status te_controleren, origineel in bestanden', async () => {
    const [pdf, word] = await voegToe(fixture('offerte.pdf'), fixture('offerte.docx'));
    for (const id of [pdf!, word!]) {
      const v = beheer.haalVoorbeeld(id);
      expect(v.status).toBe('te_controleren');
      expect(v.isTemplate).toBe(false);
      expect(v.tekst).toContain('vervangen van de dakbedekking');
      expect(v.tekst).toContain('[VERWIJDERD]');
      expect(v.tekst).not.toMatch(/Bakker|Kerkstraat|06-98765432/);
    }
    expect(beheer.haalVoorbeeld(pdf!).bestandsnaam).toBe('offerte.pdf');
    const bestand = t.db
      .prepare(
        'SELECT b.naam, b.mime, length(b.inhoud) AS n FROM bestanden b JOIN voorbeelden v ON v.bestand_id = b.id WHERE v.id = ?',
      )
      .get(word!) as { naam: string; mime: string; n: number };
    expect(bestand.naam).toBe('offerte.docx');
    expect(bestand.mime).toContain('wordprocessingml');
    expect(bestand.n).toBe(readFileSync(join(FIXTURES, 'offerte.docx')).byteLength);
    // Nog niet goedgekeurd → niet in de werkmap (FE-082).
    expect(werkmap()).toEqual({});
  });

  it('fouten per bestand; een fout houdt de andere niet tegen', async () => {
    const groot = join(tmp, 'groot.pdf');
    writeFileSync(groot, '');
    truncateSync(groot, 20 * 1024 * 1024 + 1);
    const precies = await docx('precies50.docx', ['a'.repeat(25), 'b '.repeat(25)]);
    const te_weinig = await docx('weinig.docx', ['a'.repeat(49)]);
    const map = join(tmp, 'map.pdf');
    mkdirSync(map);

    const uit = await beheer.voegVoorbeeldenToe([
      fixture('foto.jpg'),
      groot,
      fixture('scan.pdf'),
      fixture('kapot.pdf'),
      te_weinig,
      join(tmp, 'bestaat-niet.docx'),
      map,
      join(tmp, 'Offertes'),
      'relatief.pdf',
      fixture('offerte.pdf'),
      precies,
    ]);
    expect(uit.toegevoegd).toHaveLength(2);
    expect(uit.fouten).toEqual([
      { bestandsnaam: 'foto.jpg', code: 'BESTAND_TYPE_ONBEKEND' },
      { bestandsnaam: 'groot.pdf', code: 'BESTAND_TE_GROOT' },
      { bestandsnaam: 'scan.pdf', code: 'BESTAND_GEEN_TEKST' },
      { bestandsnaam: 'kapot.pdf', code: 'BESTAND_ONLEESBAAR' },
      { bestandsnaam: 'weinig.docx', code: 'BESTAND_GEEN_TEKST' },
      { bestandsnaam: 'bestaat-niet.docx', code: 'BESTAND_ONLEESBAAR' },
      { bestandsnaam: 'map.pdf', code: 'BESTAND_ONLEESBAAR' },
      { bestandsnaam: 'Offertes', code: 'BESTAND_TYPE_ONBEKEND' },
      { bestandsnaam: 'relatief.pdf', code: 'VALIDATIE' },
    ]);
    expect(aantal('voorbeelden')).toBe(2);
    expect(aantal('bestanden')).toBe(2);
  });

  it('hetzelfde bestand twee keer: twee voorbeelden, nummering op volgorde van toevoegen', async () => {
    const pad = fixture('offerte.docx');
    const [a, b] = await voegToe(pad, pad);
    expect(a).not.toBe(b);
    const lijst = beheer.lijstVoorbeelden();
    expect(lijst.map((v) => v.id)).toEqual([a, b]);
    expect(lijst[0]!.aangemaaktOp < lijst[1]!.aangemaaktOp).toBe(true);
  });

  it('FE-081: 10 persoonsgegevens vervangen; eigen bedrijf met andere spatiëring wordt [BEDRIJF]', async () => {
    bewaarInstelling('bedrijf', EIGEN);
    const [id] = await voegToe(await docx('Offerte Bakker.docx', REGELS_10_PII));
    const { tekst } = beheer.haalVoorbeeld(id!);
    for (const pii of PII_10) expect(tekst).not.toContain(pii);
    for (const eigen of ['Dakwerken Zuid', '040 123 45 67', '1234 5678', 'NL 0012.34.567.B01', 'NL20 INGB']) {
      expect(tekst).not.toContain(eigen);
    }
    expect(tekst).toContain('KvK [BEDRIJF]');
    expect(tekst).toContain('IBAN [BEDRIJF]');
    expect(tekst).toContain('Btw [BEDRIJF]');
    expect(tekst).toContain('Tel. [BEDRIJF]');
    expect(tekst).toContain('vervangen van de dakbedekking');
  });

  it('opnieuw redigeren na bedrijf bewaren (OFM-018) houdt de handmatige redacties', async () => {
    const [id] = await voegToe(await docx('a.docx', REGELS_10_PII));
    await beheer.maakOnleesbaar(id!, 'platte dak');
    bewaarInstelling('bedrijf', EIGEN);
    expect(await herRedigeerVoorbeelden(EIGEN)).toBe(1);
    const { tekst } = beheer.haalVoorbeeld(id!);
    expect(tekst).toContain('IBAN [BEDRIJF]');
    expect(tekst).not.toContain('platte dak');
  });
});

describe('review, onleesbaar maken, goedkeuren (FE-082)', () => {
  it('onleesbaar maken: overal [VERWIJDERD], vanaf de brontekst, status blijft', async () => {
    const [id] = await voegToe(
      await docx('x.docx', [
        'Offerte voor het dak van de familie Pietersen in Oosterhout.',
        'Wij komen graag langs in Oosterhout, zodra het weer het toelaat en de steigers staan.',
      ]),
    );
    const uit = await beheer.maakOnleesbaar(id!, '  oosterhout ');
    expect(uit.tekst).not.toMatch(/oosterhout/i);
    expect(uit.tekst.match(/\[VERWIJDERD\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(beheer.haalVoorbeeld(id!)).toMatchObject({ tekst: uit.tekst, status: 'te_controleren' });
    const redacties = t.db.prepare('SELECT handmatige_redacties AS r FROM voorbeelden').get() as {
      r: string;
    };
    expect(JSON.parse(redacties.r)).toEqual(['oosterhout']);

    // Nog een keer hetzelfde, of iets wat niet (meer) in de tekst staat: niets verandert.
    expect(await beheer.maakOnleesbaar(id!, 'Oosterhout')).toEqual({ tekst: uit.tekst });
    expect(await beheer.maakOnleesbaar(id!, 'Breda')).toEqual({ tekst: uit.tekst });
    expect(await foutcode(beheer.maakOnleesbaar(id!, ' a '))).toBe('VALIDATIE');
    expect(await foutcode(beheer.maakOnleesbaar(id!, ' [VERWIJDERD], '))).toBe('VALIDATIE');
    expect(
      JSON.parse(
        (t.db.prepare('SELECT handmatige_redacties AS r FROM voorbeelden').get() as { r: string }).r,
      ),
    ).toEqual(['oosterhout']);

    // Een selectie over een zwart balkje heen werkt ook (stap 6 werkt op het resultaat van 1–5).
    const metBalk = await beheer.maakOnleesbaar(id!, 'in [VERWIJDERD], zodra');
    expect(metBalk.tekst).toContain('langs [VERWIJDERD] het weer');
  });

  it('V-16: een goedgekeurd voorbeeld blijft goedgekeurd na onleesbaar maken, werkmap bijgewerkt', async () => {
    const [id] = await voegToe(fixture('offerte.docx'));
    beheer.keurGoed(id!);
    expect(werkmap()['voorbeelden/voorbeeld-01.md']).toContain('EPDM');
    await beheer.maakOnleesbaar(id!, 'EPDM');
    expect(beheer.haalVoorbeeld(id!).status).toBe('goedgekeurd');
    const inhoud = werkmap()['voorbeelden/voorbeeld-01.md']!;
    expect(inhoud).not.toContain('EPDM');
    expect(inhoud).toBe(`# Voorbeeldofferte 1\n\n${beheer.haalVoorbeeld(id!).tekst}`);
  });

  it('FE-082: alleen goedgekeurde voorbeelden in de werkmap, genummerd op aangemaakt_op, zonder bestandsnaam', async () => {
    const ids = await voegToe(
      fixture('offerte.pdf', 'Offerte Jansen Veldhoven.pdf'),
      fixture('offerte.docx', 'Janssen-2023.docx'),
      fixture('offerte.docx', 'Derde.docx'),
    );
    beheer.keurGoed(ids[2]!);
    beheer.keurGoed(ids[0]!);
    const map = werkmap();
    expect(Object.keys(map).sort()).toEqual(['voorbeelden/voorbeeld-01.md', 'voorbeelden/voorbeeld-02.md']);
    expect(map['voorbeelden/voorbeeld-01.md']).toBe(
      `# Voorbeeldofferte 1\n\n${beheer.haalVoorbeeld(ids[0]!).tekst}`,
    );
    expect(map['voorbeelden/voorbeeld-02.md']).toBe(
      `# Voorbeeldofferte 2\n\n${beheer.haalVoorbeeld(ids[2]!).tekst}`,
    );
    const alles = Object.entries(map).flat().join('\n');
    expect(alles).not.toMatch(/Jansen|Janssen|Derde|Veldhoven/);
    expect(beheer.lijstVoorbeelden().map((v) => v.status)).toEqual([
      'goedgekeurd',
      'te_controleren',
      'goedgekeurd',
    ]);
  });

  it('onbekend id → VALIDATIE', async () => {
    expect(await foutcode(() => beheer.haalVoorbeeld('weg'))).toBe('VALIDATIE');
    expect(await foutcode(() => beheer.keurGoed('weg'))).toBe('VALIDATIE');
    expect(await foutcode(beheer.maakOnleesbaar('weg', 'tekst'))).toBe('VALIDATIE');
    expect(await foutcode(() => beheer.zetTemplate('weg'))).toBe('VALIDATIE');
  });
});

describe('template (FE-083)', () => {
  it('alleen goedgekeurd; maximaal één; null haalt weg; template niet ook in voorbeelden\\', async () => {
    const [a, b, c] = await voegToe(
      fixture('offerte.docx'),
      fixture('offerte.pdf'),
      await docx('c.docx', ['Een derde voorbeeld met genoeg tekst om te lezen, over een schuin pannendak.']),
    );
    const handler = maakIpcHandler('voorbeelden:zetTemplate', voorbeeldenHandlers['voorbeelden:zetTemplate']);
    expect(await handler(nepEvent, { id: a })).toEqual({
      ok: false,
      fout: { code: 'VALIDATIE', melding: 'Keur dit voorbeeld eerst goed.' },
    });

    for (const id of [a!, b!, c!]) beheer.keurGoed(id);
    expect(await handler(nepEvent, { id: a })).toEqual({ ok: true, data: null });
    beheer.zetTemplate(c!);
    expect(beheer.lijstVoorbeelden().map((v) => v.isTemplate)).toEqual([false, false, true]);
    let map = werkmap();
    expect(map['template.md']).toBe(`# Template\n\n${beheer.haalVoorbeeld(c!).tekst}`);
    expect(Object.keys(map).sort()).toEqual([
      'template.md',
      'voorbeelden/voorbeeld-01.md',
      'voorbeelden/voorbeeld-02.md',
    ]);
    expect(map['voorbeelden/voorbeeld-02.md']).toContain('# Voorbeeldofferte 2');
    expect(Object.values(map).filter((v) => v.includes('schuin pannendak'))).toHaveLength(1);

    beheer.zetTemplate(null);
    expect(beheer.lijstVoorbeelden().some((v) => v.isTemplate)).toBe(false);
    map = werkmap();
    expect(map['template.md']).toBeUndefined();
    expect(Object.keys(map)).toHaveLength(3);
  });

  it(
    'FE-083: de opdracht bij maken volgt het template alleen als er een template is (echte opdrachtbouwer)',
    { timeout: 30_000 },
    async () => {
      claude = gebruikNepClaude('ok');
      legeStatusCache();
      zetTesthakenVoorTest(new Map());
      const offerte = () => {
        const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
        bewaarInvoer({ id, klant: maakKlant({ naam: 'Jansen' }), invoer: maakInvoer(), wizardStap: 4 }, 30);
        return id;
      };
      const opdrachten = () =>
        (claude?.aanroepen() ?? []).filter((a) => a.args.includes('-p')).map((a) => a.stdin);
      const log = () =>
        (
          t.db.prepare('SELECT opdracht FROM privacylog ORDER BY tijdstip, rowid').all() as {
            opdracht: string;
          }[]
        ).map((r) => r.opdracht);
      const ZIN = 'Volg de indeling en toon van template.md.';

      const [a, b] = await voegToe(fixture('offerte.docx'), fixture('offerte.pdf'));
      beheer.keurGoed(a!);
      beheer.keurGoed(b!);

      await maakOfferte(offerte());
      expect(opdrachten()[0]).toContain('Er zijn 2 goedgekeurde voorbeeldoffertes in voorbeelden/.');
      expect(opdrachten()[0]).not.toContain(ZIN);
      expect(log()[0]!.startsWith(bouwSysteemprompt({ template: false }))).toBe(true);
      expect(log()[0]).not.toContain('template.md');

      beheer.zetTemplate(b!);
      await maakOfferte(offerte());
      expect(opdrachten()[1]).toContain(`Er zijn 1 goedgekeurde voorbeeldoffertes in voorbeelden/. ${ZIN}`);
      expect(log()[1]!.startsWith(bouwSysteemprompt({ template: true }))).toBe(true);
      expect(log()[1]).toContain('het template in template.md');
      expect(existsSync(join(nep.agentMap, 'template.md'))).toBe(true);
    },
  );
});

describe('verwijderen (FE-085, V-16)', () => {
  it('uit de lijst, de werkmap en bestanden; ook het template en het enige goedgekeurde voorbeeld', async () => {
    const [a, b] = await voegToe(fixture('offerte.docx'), fixture('offerte.pdf'));
    beheer.keurGoed(a!);
    beheer.keurGoed(b!);
    beheer.zetTemplate(b!);
    expect(Object.keys(werkmap())).toHaveLength(2);

    beheer.verwijderVoorbeeld(b!);
    expect(beheer.lijstVoorbeelden().map((v) => v.id)).toEqual([a]);
    expect(Object.keys(werkmap())).toEqual(['voorbeelden/voorbeeld-01.md']);
    expect(aantal('bestanden')).toBe(1);

    beheer.verwijderVoorbeeld(a!);
    expect(beheer.lijstVoorbeelden()).toEqual([]);
    expect(werkmap()).toEqual({});
    expect(aantal('bestanden')).toBe(0);
    // Nog een keer: geen fout.
    expect(beheer.verwijderVoorbeeld(a!)).toBeNull();
  });
});

describe('IPC voorbeelden (NFE-014, V-03)', () => {
  const roep = <K extends keyof typeof voorbeeldenHandlers>(kanaal: K, invoer: unknown) =>
    maakIpcHandler(kanaal, voorbeeldenHandlers[kanaal])(nepEvent, invoer);

  it('weigert ongeldige invoer', async () => {
    const ongeldig: [keyof typeof voorbeeldenHandlers, unknown][] = [
      ['voorbeelden:voegToe', { paden: [''] }],
      ['voorbeelden:voegToe', { paden: 'C:\\a.pdf' }],
      ['voorbeelden:haal', {}],
      ['voorbeelden:maakOnleesbaar', { id: 'x', fragment: 'a' }],
      ['voorbeelden:maakOnleesbaar', { id: 'x', fragment: 'a'.repeat(201) }],
      ['voorbeelden:keurGoed', { id: 5 }],
      ['voorbeelden:zetTemplate', {}],
      ['voorbeelden:verwijder', { id: '' }],
    ];
    for (const [kanaal, invoer] of ongeldig) {
      const uit = await roep(kanaal, invoer);
      expect(uit, kanaal).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
    expect(aantal('voorbeelden')).toBe(0);
  });

  it('een pad met een niet-toegestane extensie wordt niet gelezen', async () => {
    const exe = join(tmp, 'programma.exe');
    writeFileSync(exe, 'MZ');
    expect(await roep('voorbeelden:voegToe', { paden: [exe] })).toEqual({
      ok: true,
      data: { toegevoegd: [], fouten: [{ bestandsnaam: 'programma.exe', code: 'BESTAND_TYPE_ONBEKEND' }] },
    });
  });

  it('zonder paden de bestandsdialoog; annuleren voegt niets toe', async () => {
    nep.dialoog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await roep('voorbeelden:voegToe', {})).toEqual({ ok: true, data: { toegevoegd: [], fouten: [] } });
    nep.dialoog.mockResolvedValueOnce({ canceled: false, filePaths: [fixture('offerte.docx')] });
    const uit = await roep('voorbeelden:voegToe', { paden: [] });
    expect(uit.ok && uit.data.toegevoegd).toHaveLength(1);
    expect(nep.dialoog).toHaveBeenCalledTimes(2);
    const opties = nep.dialoog.mock.calls[0]![0] as {
      properties: string[];
      filters: { extensions: string[] }[];
    };
    expect(opties.properties).toContain('multiSelections');
    expect(opties.filters[0]!.extensions).toEqual(['pdf', 'docx']);
  });

  it('lijst, haal, maakOnleesbaar, keurGoed, zetTemplate en verwijder via de handlers', async () => {
    const [id] = await voegToe(fixture('offerte.docx'));
    const lijst = await roep('voorbeelden:lijst', undefined);
    expect(lijst).toMatchObject({
      ok: true,
      data: [{ id, bestandsnaam: 'offerte.docx', status: 'te_controleren', isTemplate: false }],
    });
    expect(await roep('voorbeelden:haal', { id })).toMatchObject({ ok: true, data: { id } });
    expect(await roep('voorbeelden:maakOnleesbaar', { id, fragment: 'EPDM' })).toMatchObject({ ok: true });
    expect(await roep('voorbeelden:keurGoed', { id })).toEqual({ ok: true, data: null });
    expect(await roep('voorbeelden:zetTemplate', { id })).toEqual({ ok: true, data: null });
    expect(await roep('voorbeelden:zetTemplate', { id: null })).toEqual({ ok: true, data: null });
    expect(await roep('voorbeelden:verwijder', { id })).toEqual({ ok: true, data: null });
    expect(await roep('voorbeelden:tekstenUitTemplate', undefined)).toMatchObject({ ok: false });
  });
});
