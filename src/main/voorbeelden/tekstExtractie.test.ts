import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Document, Packer, Paragraph } from 'docx';
import { describe, expect, it } from 'vitest';
import { AppFout, type FoutCode } from '@shared/fouten';
import { MAX_VOORBEELD_MB, controleerVoorbeeldbestand, haalTekstUit } from './tekstExtractie';

const fixtures = resolve(import.meta.dirname, '../../../test/fixtures/voorbeelden');
const lees = (naam: string) => new Uint8Array(readFileSync(join(fixtures, naam)));

async function docx(...alineas: string[]): Promise<Uint8Array> {
  const document = new Document({ sections: [{ children: alineas.map((a) => new Paragraph(a)) }] });
  return new Uint8Array(await Packer.toBuffer(document));
}

async function fout(belofte: Promise<unknown>): Promise<{ code: FoutCode; melding: string }> {
  try {
    await belofte;
  } catch (e) {
    if (e instanceof AppFout) return { code: e.code, melding: e.melding };
    throw e;
  }
  throw new Error('verwachtte een AppFout');
}

describe('haalTekstUit', () => {
  it('leest een tekst-PDF', async () => {
    const tekst = await haalTekstUit(lees('offerte.pdf'), 'offerte.pdf');
    expect(tekst).toContain('Geachte heer Bakker');
    expect(tekst).toContain('EPDM 1,1 mm');
  });

  it('leest een .docx als platte tekst', async () => {
    const tekst = await haalTekstUit(lees('offerte.docx'), 'Offerte.DOCX');
    expect(tekst).toContain('Geachte heer Bakker,');
    expect(tekst).toContain('Kerkstraat 5\n');
  });

  it('laat de buffer van de aanroeper intact', async () => {
    const buffer = lees('offerte.pdf');
    await haalTekstUit(buffer, 'offerte.pdf');
    expect(buffer.byteLength).toBeGreaterThan(0);
    await expect(haalTekstUit(buffer, 'offerte.pdf')).resolves.toContain('Bakker');
  });

  it('een .jpg of .doc: BESTAND_TYPE_ONBEKEND', async () => {
    expect(await fout(haalTekstUit(lees('foto.jpg'), 'foto.jpg'))).toEqual({
      code: 'BESTAND_TYPE_ONBEKEND',
      melding: 'Dit soort bestand kan ik niet lezen. Gebruik een PDF- of Word-bestand.',
    });
    expect((await fout(haalTekstUit(new Uint8Array(10), 'oud.doc'))).code).toBe('BESTAND_TYPE_ONBEKEND');
    expect((await fout(haalTekstUit(new Uint8Array(10), 'zonder-extensie'))).code).toBe(
      'BESTAND_TYPE_ONBEKEND',
    );
  });

  it('een PDF zonder tekstlaag (scan): BESTAND_GEEN_TEKST', async () => {
    expect((await fout(haalTekstUit(lees('scan.pdf'), 'scan.pdf'))).code).toBe('BESTAND_GEEN_TEKST');
  });

  it('49 niet-witruimtetekens: BESTAND_GEEN_TEKST; 50: wel tekst', async () => {
    const negenenveertig = await docx('a'.repeat(20), ' \t ', 'b'.repeat(29));
    expect((await fout(haalTekstUit(negenenveertig, 'kort.docx'))).code).toBe('BESTAND_GEEN_TEKST');
    const vijftig = await docx('a'.repeat(20), ' \t ', 'b'.repeat(30));
    await expect(haalTekstUit(vijftig, 'kort.docx')).resolves.toContain('b'.repeat(30));
  });

  it('een kapot bestand: BESTAND_ONLEESBAAR', async () => {
    expect((await fout(haalTekstUit(lees('kapot.pdf'), 'kapot.pdf'))).code).toBe('BESTAND_ONLEESBAAR');
    expect((await fout(haalTekstUit(lees('kapot.pdf'), 'kapot.docx'))).code).toBe('BESTAND_ONLEESBAAR');
  });

  it('groter dan 20 MB: BESTAND_TE_GROOT, zonder in te lezen', async () => {
    const teGroot = new Uint8Array(20 * 1024 * 1024 + 1);
    expect(await fout(haalTekstUit(teGroot, 'groot.pdf'))).toEqual({
      code: 'BESTAND_TE_GROOT',
      melding: 'Dit bestand is te groot (maximaal 20 MB).',
    });
  });
});

describe('controleerVoorbeeldbestand', () => {
  it('geeft het soort terug en controleert de grootte', () => {
    expect(controleerVoorbeeldbestand('a.PDF', 1)).toBe('pdf');
    expect(controleerVoorbeeldbestand('a.docx', MAX_VOORBEELD_MB * 1024 * 1024)).toBe('docx');
    expect(() => controleerVoorbeeldbestand('a.docx', MAX_VOORBEELD_MB * 1024 * 1024 + 1)).toThrow(AppFout);
    expect(() => controleerVoorbeeldbestand('a.txt', 1)).toThrow(AppFout);
  });
});
