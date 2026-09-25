import { extname } from 'node:path';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { AppFout } from '@shared/fouten';
import { bestandTeGroot } from '@shared/teksten/fouten';

// Tekst lokaal uit voorbeeldoffertes halen (TDO §11.5, §17, FE-080, V-11, V-16). Geen netwerk:
// unpdf en mammoth werken volledig in het proces. Werkt op een buffer, omdat de brontekst bij
// opnieuw redigeren uit de BLOB in `bestanden` komt (OFM-019).

export type VoorbeeldSoort = 'pdf' | 'docx';

/** Maximale grootte van een voorbeeldbestand in MB (FE-080, V-11). */
export const MAX_VOORBEELD_MB = 20;
const MAX_BYTES = MAX_VOORBEELD_MB * 1024 * 1024;

/** Minder niet-witruimtetekens dan dit → `BESTAND_GEEN_TEKST` (V-16). */
export const MIN_TEKENS = 50;

/**
 * Type en grootte controleren, vóór het inlezen. OFM-019 kan dit met `fs.stat` aanroepen voordat
 * het bestand in het geheugen komt.
 */
export function controleerVoorbeeldbestand(bestandsnaam: string, grootteBytes: number): VoorbeeldSoort {
  const extensie = extname(bestandsnaam).toLowerCase();
  if (extensie !== '.pdf' && extensie !== '.docx') throw new AppFout('BESTAND_TYPE_ONBEKEND');
  if (grootteBytes > MAX_BYTES) throw new AppFout('BESTAND_TE_GROOT', bestandTeGroot(MAX_VOORBEELD_MB));
  return extensie === '.pdf' ? 'pdf' : 'docx';
}

async function pdfTekst(inhoud: Uint8Array): Promise<string> {
  // Kopie: pdf.js neemt de onderliggende ArrayBuffer over. Met een buffer (geen proxy) ruimt
  // unpdf het document zelf op.
  const { text } = await extractText(new Uint8Array(inhoud), { mergePages: true });
  return text;
}

async function docxTekst(inhoud: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(inhoud) });
  return value;
}

/**
 * Tekst uit een `.pdf` of `.docx`. Gooit `AppFout` met `BESTAND_TYPE_ONBEKEND`, `BESTAND_TE_GROOT`,
 * `BESTAND_ONLEESBAAR` (beschadigd of beveiligd) of `BESTAND_GEEN_TEKST` (bijv. een scan).
 */
export async function haalTekstUit(inhoud: Uint8Array, bestandsnaam: string): Promise<string> {
  const soort = controleerVoorbeeldbestand(bestandsnaam, inhoud.byteLength);
  let tekst: string;
  try {
    tekst = soort === 'pdf' ? await pdfTekst(inhoud) : await docxTekst(inhoud);
  } catch {
    throw new AppFout('BESTAND_ONLEESBAAR');
  }
  tekst = tekst.replace(/\r\n?/g, '\n');
  if ([...tekst.replace(/\s/g, '')].length < MIN_TEKENS) throw new AppFout('BESTAND_GEEN_TEKST');
  return tekst;
}
