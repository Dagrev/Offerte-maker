import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakKlant } from '../../../test/privacy/testset';

const nep = vi.hoisted(() => ({
  tmp: '',
  renameFout: null as string | null,
  laadFout: false,
  printToPDF: vi.fn((opties: unknown) => Promise.resolve(Buffer.from(opties ? '%PDF' : ''))),
  destroy: vi.fn(),
  opties: [] as unknown[],
}));
vi.mock('electron', () => ({
  BrowserWindow: class {
    webContents = { printToPDF: nep.printToPDF };
    destroy = nep.destroy;
    constructor(opties: unknown) {
      nep.opties.push(opties);
    }
    loadFile = () => (nep.laadFout ? Promise.reject(new Error('laden mislukt')) : Promise.resolve());
    isDestroyed = () => false;
  },
}));
vi.mock('../paden', () => ({
  paden: {
    get tmpMap() {
      return nep.tmp;
    },
  },
}));
vi.mock('node:fs/promises', async (origineel) => {
  const echt = await origineel<typeof import('node:fs/promises')>();
  return {
    ...echt,
    rename: (van: string, naar: string) => {
      if (nep.renameFout)
        return Promise.reject(Object.assign(new Error(nep.renameFout), { code: nep.renameFout }));
      return echt.rename(van, naar);
    },
  };
});

const m = await import('./maakPdf');

beforeEach(() => {
  nep.tmp = mkdtempSync(join(tmpdir(), 'ofm-maakpdf-'));
  nep.renameFout = null;
  nep.laadFout = false;
  nep.opties.length = 0;
  nep.destroy.mockClear();
  nep.printToPDF.mockClear();
});
afterEach(() => rmSync(nep.tmp, { recursive: true, force: true }));

describe('pdfBestandsnaam (FE-056)', () => {
  it('nummer en naam, ongeldige tekens en controletekens worden -', () => {
    expect(m.pdfBestandsnaam('2026-003', maakKlant({ achternaam: 'Jansen/de Vries' }))).toBe(
      '2026-003 Jansen-de Vries.pdf',
    );
    expect(m.pdfBestandsnaam('2026-003', maakKlant({ achternaam: 'a<>:"\\|?*\tb' }))).toBe(
      '2026-003 a---------b.pdf',
    );
  });
  it('bedrijfsnaam alleen bij aanhef bedrijf en als ingevuld', () => {
    expect(
      m.pdfBestandsnaam('1', maakKlant({ aanhef: 'bedrijf', achternaam: 'Piet', bedrijfsnaam: 'Bouw' })),
    ).toBe('1 Bouw.pdf');
    expect(
      m.pdfBestandsnaam('1', maakKlant({ aanhef: 'bedrijf', achternaam: 'Piet', bedrijfsnaam: ' ' })),
    ).toBe('1 Piet.pdf');
    expect(
      m.pdfBestandsnaam('1', maakKlant({ aanhef: 'dhr', achternaam: 'Piet', bedrijfsnaam: 'Bouw' })),
    ).toBe('1 Piet.pdf');
  });
  it('lege naam en maximaal 150 tekens', () => {
    expect(m.pdfBestandsnaam('2026-001', maakKlant({ achternaam: '' }))).toBe('2026-001.pdf');
    const lang = m.pdfBestandsnaam('2026-001', maakKlant({ achternaam: 'x'.repeat(400) }));
    expect(lang).toHaveLength(150);
    expect(lang.endsWith('.pdf')).toBe(true);
  });
});

describe('printOpties en footerTemplate (§12.3, V-22)', () => {
  it('A4, marges 20/25 mm, voettekst geëscaped met paginanummer', () => {
    const o = m.printOpties({ kvk: '123', btwNummer: '', iban: 'NL<00>' });
    expect(o).toMatchObject({
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margins: { top: 0.79, bottom: 0.98, left: 0.79, right: 0.79 },
    });
    expect(o.footerTemplate).toContain('KvK 123 · IBAN NL&lt;00&gt;');
    expect(o.footerTemplate).toContain('font-size:8px');
    expect(o.footerTemplate).toContain(
      '<span class="pageNumber"></span> van <span class="totalPages"></span>',
    );
  });
});

describe('vrijPad', () => {
  it('overschrijft nooit: -2, -3', async () => {
    expect(await m.vrijPad(nep.tmp, 'a.pdf')).toBe(join(nep.tmp, 'a.pdf'));
    writeFileSync(join(nep.tmp, 'a.pdf'), '');
    writeFileSync(join(nep.tmp, 'a-2.pdf'), '');
    expect(await m.vrijPad(nep.tmp, 'a.pdf')).toBe(join(nep.tmp, 'a-3.pdf'));
  });
});

describe('verplaatsBestand (V-01 stap 4)', () => {
  const bron = () => {
    const pad = join(nep.tmp, 'bron.pdf');
    writeFileSync(pad, 'inhoud');
    return pad;
  };
  it('gewoon hernoemen', async () => {
    await m.verplaatsBestand(bron(), join(nep.tmp, 'doel.pdf'));
    expect(readdirSync(nep.tmp)).toEqual(['doel.pdf']);
  });
  it('EXDEV: kopiëren en verwijderen', async () => {
    nep.renameFout = 'EXDEV';
    await m.verplaatsBestand(bron(), join(nep.tmp, 'doel.pdf'));
    expect(readdirSync(nep.tmp)).toEqual(['doel.pdf']);
    expect(readFileSync(join(nep.tmp, 'doel.pdf'), 'utf8')).toBe('inhoud');
  });
  it.each(['EBUSY', 'EPERM'])('%s → PDF_BESTAND_BEZET', async (code) => {
    nep.renameFout = code;
    await expect(m.verplaatsBestand(bron(), join(nep.tmp, 'doel.pdf'))).rejects.toMatchObject({
      code: 'PDF_BESTAND_BEZET',
    });
  });
  it('andere fout gaat door', async () => {
    nep.renameFout = 'ENOSPC';
    await expect(m.verplaatsBestand(bron(), join(nep.tmp, 'doel.pdf'))).rejects.toMatchObject({
      code: 'ENOSPC',
    });
  });
});

describe('renderPdf en metVerborgenVenster (§12.3 stap 2–6)', () => {
  it('verborgen gesandboxt venster, printToPDF met de opties, alles opgeruimd', async () => {
    const bedrijf = { kvk: '1', btwNummer: '2', iban: '3' } as Parameters<typeof m.renderPdf>[1];
    expect((await m.renderPdf('<p>x</p>', bedrijf)).toString()).toBe('%PDF');
    expect(nep.opties).toEqual([m.VERBORGEN_VENSTER]);
    expect(nep.printToPDF).toHaveBeenCalledWith(m.printOpties(bedrijf));
    expect(nep.destroy).toHaveBeenCalled();
    expect(readdirSync(nep.tmp)).toEqual([]);
  });
  it('ruimt ook op als laden mislukt', async () => {
    nep.laadFout = true;
    await expect(m.metVerborgenVenster('<p>x</p>', () => Promise.resolve(1))).rejects.toThrow(
      'laden mislukt',
    );
    expect(nep.destroy).toHaveBeenCalled();
    expect(readdirSync(nep.tmp)).toEqual([]);
  });
});
