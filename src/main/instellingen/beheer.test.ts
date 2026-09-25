import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCENTKLEUREN, standaardInstelling } from '@shared/schemas';
import { VOORBEELD_BEDRIJF } from '@shared/pdf-template/voorbeeldData';
import type { Bedrijf, Opmaak } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

const nep = vi.hoisted(() => ({
  agentMap: '',
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  legeStatusCache: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: vi.fn() },
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
vi.mock('../agent/claudeStatus', () => ({ legeStatusCache: nep.legeStatusCache }));
// Tekstextractie is getest in OFM-007; hier telt alleen dat de brontekst opnieuw wordt geredigeerd.
vi.mock('../voorbeelden/tekstExtractie', () => ({
  haalTekstUit: (inhoud: Uint8Array, naam: string) => {
    if (naam === 'kapot.pdf') return Promise.reject(new Error('kapot'));
    return Promise.resolve(Buffer.from(inhoud).toString('utf8'));
  },
}));

const beheer = await import('./beheer');
const { haalInstelling, bewaarInstelling } = await import('../db/repo/instellingen');
const { maakIpcHandler } = await import('../ipc/registreer');
const { instellingenHandlers } = await import('../ipc/instellingen');
const { prijzenHandlers } = await import('../ipc/prijzen');
const { dialog } = await import('electron');

const nepEvent = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];

let t: TestDatabase;
let tmp: string;
beforeEach(async () => {
  t = await maakTestDatabase();
  tmp = mkdtempSync(join(tmpdir(), 'ofm018-'));
  nep.agentMap = join(tmp, 'agent');
  vi.clearAllMocks();
});
afterEach(() => {
  t.opruimen();
  rmSync(tmp, { recursive: true, force: true });
});

const bedrijf = (deel: Partial<Bedrijf> = {}): Omit<Bedrijf, 'logoBestandId'> => {
  const { logoBestandId: _, ...rest } = { ...standaardInstelling('bedrijf'), ...deel };
  void _;
  return rest;
};

function schrijf(naam: string, bytes: number | Buffer): string {
  const pad = join(tmp, naam);
  writeFileSync(pad, typeof bytes === 'number' ? Buffer.alloc(bytes, 1) : bytes);
  return pad;
}

describe('instellingen:haal (V-15)', () => {
  it('geeft standaardwaarden, zonder versleutelde API-sleutel', () => {
    const i = beheer.haalInstellingen();
    expect(i.bedrijf).toEqual({ ...standaardInstelling('bedrijf'), logoDataUri: null });
    expect(i.teksten.geldigheidDagen).toBe(30);
    expect(i.claude).toEqual({ pad: null, model: 'opus', effort: 'medium', apiSleutelIngevuld: false });
    expect(i.app).toEqual({ welkomVoltooid: false });

    bewaarInstelling('claude', { ...standaardInstelling('claude'), apiSleutelVersleuteld: 'geheim' });
    const claude = beheer.haalInstellingen().claude;
    expect(claude.apiSleutelIngevuld).toBe(true);
    expect(JSON.stringify(claude)).not.toContain('geheim');
  });

  it('V-12: een ongeldige opgeslagen waarde geeft een waarschuwing en de standaardwaarde, en blijft staan', () => {
    t.db.prepare(`INSERT INTO instellingen VALUES ('opmaak', '{"layout":"barok"}')`).run();
    expect(beheer.haalInstellingen().opmaak).toEqual(standaardInstelling('opmaak'));
    expect(nep.log.warn).toHaveBeenCalled();
    const rij = t.db.prepare(`SELECT waarde_json FROM instellingen WHERE sleutel = 'opmaak'`).get() as {
      waarde_json: string;
    };
    expect(rij.waarde_json).toBe('{"layout":"barok"}');
  });
});

describe('instellingen:bewaar', () => {
  const bewaar = maakIpcHandler('instellingen:bewaar', instellingenHandlers['instellingen:bewaar']);

  it('bewaart opmaak en teksten, en weigert ongeldige waarden (NFE-014)', async () => {
    const opmaak: Opmaak = { layout: 'modern', accentkleur: '#123abc', lettertype: 'merriweather' };
    expect(await bewaar(nepEvent, { sleutel: 'opmaak', waarde: opmaak })).toEqual({ ok: true, data: null });
    expect(haalInstelling('opmaak')).toEqual(opmaak);

    const teksten = { ...standaardInstelling('teksten'), geldigheidDagen: 45 };
    await bewaar(nepEvent, { sleutel: 'teksten', waarde: teksten });
    expect(haalInstelling('teksten').geldigheidDagen).toBe(45);

    for (const fout of [
      { sleutel: 'opmaak', waarde: { ...opmaak, accentkleur: 'rood' } },
      { sleutel: 'opmaak', waarde: { layout: 'modern' } },
      { sleutel: 'teksten', waarde: { ...teksten, geldigheidDagen: 0 } },
      { sleutel: 'bedrijf', waarde: { ...bedrijf(), iban: 123 } },
      { sleutel: 'app', waarde: { welkomVoltooid: true } },
    ]) {
      const r = await bewaar(nepEvent, fout);
      expect(r.ok ? null : r.fout.code).toBe('VALIDATIE');
    }
    expect(haalInstelling('opmaak')).toEqual(opmaak);

    // Een meegestuurd logoBestandId wordt genegeerd: het logo loopt alleen via kiesLogo (OFM-004).
    await bewaar(nepEvent, { sleutel: 'bedrijf', waarde: { ...bedrijf(), logoBestandId: 'x' } });
    expect(haalInstelling('bedrijf').logoBestandId).toBeNull();
  });

  it('claude: behoudt de API-sleutel en leegt de statuscache', async () => {
    bewaarInstelling('claude', { ...standaardInstelling('claude'), apiSleutelVersleuteld: 'geheim' });
    await bewaar(nepEvent, { sleutel: 'claude', waarde: { pad: null, model: 'sonnet', effort: 'high' } });
    expect(haalInstelling('claude')).toMatchObject({
      model: 'sonnet',
      effort: 'high',
      apiSleutelVersleuteld: 'geheim',
    });
    expect(nep.legeStatusCache).toHaveBeenCalledOnce();
  });

  it('V-16: bedrijf bewaren redigeert voorbeelden opnieuw vanaf de bron en synchroniseert de werkmap', async () => {
    const bron = 'Offerte van Dakwerken Pietersen\nBetaling op rekening NL91 ABNA 0417 1643 00.\n'.repeat(3);
    const voegToe = (id: string, naam: string, status: string) => {
      t.db
        .prepare(`INSERT INTO bestanden VALUES (?, ?, 'application/pdf', ?)`)
        .run(`b-${id}`, naam, Buffer.from(bron));
      t.db
        .prepare(
          `INSERT INTO voorbeelden (id, bestandsnaam, bestand_id, tekst_geanonimiseerd, handmatige_redacties, status, aangemaakt_op)
           VALUES (?, ?, ?, 'oud', '["Pietersen"]', ?, '2026-09-01T10:00:00Z')`,
        )
        .run(id, naam, `b-${id}`, status);
    };
    voegToe('v1', 'oud.pdf', 'goedgekeurd');
    voegToe('v2', 'kapot.pdf', 'goedgekeurd');

    const logo = schrijf('logo.png', 10);
    beheer.bewaarLogoBestand(logo);
    const logoId = haalInstelling('bedrijf').logoBestandId;

    const r = await bewaar(nepEvent, {
      sleutel: 'bedrijf',
      waarde: bedrijf({ naam: 'Mijn Dak BV', iban: 'NL91ABNA0417164300' }),
    });
    expect(r.ok).toBe(true);
    expect(haalInstelling('bedrijf')).toMatchObject({ naam: 'Mijn Dak BV', logoBestandId: logoId });

    const tekst = (id: string) =>
      (
        t.db.prepare('SELECT tekst_geanonimiseerd AS t FROM voorbeelden WHERE id = ?').get(id) as {
          t: string;
        }
      ).t;
    expect(tekst('v1')).toContain('rekening [BEDRIJF]');
    expect(tekst('v1')).toContain('Dakwerken [VERWIJDERD]');
    expect(tekst('v2')).toBe('oud'); // onleesbaar: overgeslagen, rest gaat door

    const bestanden = readdirSync(join(nep.agentMap, 'voorbeelden'));
    const inhoud = bestanden
      .map((b) => readFileSync(join(nep.agentMap, 'voorbeelden', b), 'utf8'))
      .join('\n');
    expect(inhoud).toContain('rekening [BEDRIJF]');
  });

  it('bedrijf bewaren zonder voorbeelden werkt ook', async () => {
    const r = await bewaar(nepEvent, { sleutel: 'bedrijf', waarde: bedrijf({ naam: 'X' }) });
    expect(r.ok).toBe(true);
  });
});

describe('logo (FE-070, V-11)', () => {
  it('bewaart PNG/JPG als data-URI, vervangt het oude logo en kan het verwijderen', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    beheer.bewaarLogoBestand(schrijf('a.png', png));
    const eerste = haalInstelling('bedrijf').logoBestandId;
    expect(beheer.haalInstellingen().bedrijf.logoDataUri).toBe(
      `data:image/png;base64,${png.toString('base64')}`,
    );

    beheer.bewaarLogoBestand(schrijf('b.JPG', 20));
    expect(beheer.haalInstellingen().bedrijf.logoDataUri).toMatch(/^data:image\/jpeg;base64,/);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM bestanden WHERE id = ?').get(eerste)).toEqual({ n: 0 });

    beheer.verwijderLogo();
    expect(beheer.haalInstellingen().bedrijf.logoDataUri).toBeNull();
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM bestanden').get()).toEqual({ n: 0 });
    expect(beheer.logoDataUri('bestaat-niet')).toBeNull();
  });

  it('weigert een logo groter dan 5 MB en een ander type', () => {
    expect(() => beheer.bewaarLogoBestand(schrijf('groot.png', 5 * 1024 * 1024 + 1))).toThrow(
      expect.objectContaining({
        code: 'BESTAND_TE_GROOT',
        melding: 'Dit bestand is te groot (maximaal 5 MB).',
      }),
    );
    expect(() => beheer.bewaarLogoBestand(schrijf('logo.gif', 10))).toThrow(
      expect.objectContaining({ code: 'BESTAND_TYPE_ONBEKEND' }),
    );
    beheer.bewaarLogoBestand(schrijf('precies.png', 5 * 1024 * 1024));
    expect(haalInstelling('bedrijf').logoBestandId).not.toBeNull();
  });

  it('kiesLogo via de dialoog: annuleren en kiezen', async () => {
    const kies = maakIpcHandler('instellingen:kiesLogo', instellingenHandlers['instellingen:kiesLogo']);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn uit de mock, geen echte methode
    const toon = vi.mocked(dialog.showOpenDialog);
    toon.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await kies(nepEvent, undefined)).toEqual({ ok: true, data: { gekozen: false } });

    toon.mockResolvedValueOnce({ canceled: false, filePaths: [schrijf('c.png', 5)] });
    expect(await kies(nepEvent, undefined)).toEqual({ ok: true, data: { gekozen: true } });
    expect(beheer.haalInstellingen().bedrijf.logoDataUri).not.toBeNull();

    const verwijder = maakIpcHandler(
      'instellingen:verwijderLogo',
      instellingenHandlers['instellingen:verwijderLogo'],
    );
    expect(await verwijder(nepEvent, undefined)).toEqual({ ok: true, data: null });
  });
});

describe('instellingen:opmaakVoorbeeld (FE-071, FE-072, V-22)', () => {
  const voorbeeld = maakIpcHandler(
    'instellingen:opmaakVoorbeeld',
    instellingenHandlers['instellingen:opmaakVoorbeeld'],
  );

  it('gebruikt het voorbeeldbedrijf zonder bedrijfsnaam, anders de echte gegevens', async () => {
    const opmaak: Opmaak = standaardInstelling('opmaak');
    const zonder = await voorbeeld(nepEvent, { opmaak });
    expect(zonder.ok && zonder.data.html).toContain(VOORBEELD_BEDRIJF.naam);

    bewaarInstelling('bedrijf', { ...standaardInstelling('bedrijf'), naam: 'Dakwerken Mijn Eigen' });
    const met = await voorbeeld(nepEvent, { opmaak });
    expect(met.ok && met.data.html).toContain('Dakwerken Mijn Eigen');
    expect(met.ok && met.data.html).not.toContain(VOORBEELD_BEDRIJF.naam);
  });

  it('elke combinatie van 3 lay-outs × 7 kleuren × 3 lettertypes levert HTML met die kleur', () => {
    const kleuren = [...ACCENTKLEUREN, '#0A0B0C'];
    for (const layout of ['klassiek', 'modern', 'compact'] as const) {
      for (const accentkleur of kleuren) {
        for (const lettertype of ['inter', 'merriweather', 'source-sans-3'] as const) {
          const { html } = beheer.opmaakVoorbeeldHtml({ layout, accentkleur, lettertype });
          expect(html).toContain(accentkleur.toUpperCase());
          expect(html.startsWith('<!doctype html>') || html.startsWith('<!DOCTYPE html>')).toBe(true);
        }
      }
    }
  });
});

describe('prijzen (FE-074, V-15)', () => {
  const lijst = maakIpcHandler('prijzen:lijst', prijzenHandlers['prijzen:lijst']);
  const bewaar = maakIpcHandler('prijzen:bewaar', prijzenHandlers['prijzen:bewaar']);
  const verwijder = maakIpcHandler('prijzen:verwijder', prijzenHandlers['prijzen:verwijder']);

  it('toont de startset zonder prijzen; een nieuwe post komt achteraan met max + 10', async () => {
    const start = await lijst(nepEvent, undefined);
    if (!start.ok) throw new Error('lijst faalde');
    expect(start.data.length).toBeGreaterThan(0);
    expect(start.data.every((p) => p.prijsCent === null)).toBe(true);
    const hoogste = Math.max(...start.data.map((p) => p.volgorde));

    const r = await bewaar(nepEvent, {
      id: '',
      sleutel: null,
      omschrijving: 'Eigen post',
      eenheid: 'uur',
      prijsCent: 4550,
      btwTarief: 21,
      volgorde: 0,
    });
    if (!r.ok) throw new Error('bewaren faalde');
    const na = await lijst(nepEvent, undefined);
    expect(na.ok && na.data.at(-1)).toMatchObject({ id: r.data.id, volgorde: hoogste + 10, prijsCent: 4550 });

    const eerste = start.data[0]!;
    expect((await verwijder(nepEvent, { id: eerste.id })).ok).toBe(true);
    const weg = await lijst(nepEvent, undefined);
    expect(weg.ok && weg.data.some((p) => p.id === eerste.id)).toBe(false);

    const leeg = await bewaar(nepEvent, { ...eerste, id: '', omschrijving: '  ', prijsCent: -1 });
    expect(leeg.ok ? null : leeg.fout.code).toBe('VALIDATIE');
  });
});
