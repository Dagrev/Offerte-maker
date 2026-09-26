import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { AppFout } from '@shared/fouten';
import { volledigeNaam } from '@shared/labels';
import { escapeHtml, voettekstRegel } from '@shared/pdf-template/secties';
import type { Bedrijf, Klant } from '@shared/types';
import { paden } from '../paden';

// PDF maken (TDO §12.3 stap 2–6, V-22): HTML in modus `pdf` → verborgen venster → `printToPDF`.
// De pure delen (opties, bestandsnaam) staan apart, zodat tests ze zonder Electron kunnen gebruiken.

/** §12.3 stap 4: één regel, 8 px sans-serif; links KvK/btw/IBAN, rechts het paginanummer. */
export function footerTemplate(bedrijf: Pick<Bedrijf, 'kvk' | 'btwNummer' | 'iban'>): string {
  return (
    '<div style="box-sizing:border-box;width:100%;padding:0 0.79in;font-family:sans-serif;font-size:8px;color:#444;' +
    'display:flex;justify-content:space-between;">' +
    `<span>${escapeHtml(voettekstRegel(bedrijf))}</span>` +
    '<span>pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span></div>'
  );
}

/** §12.3 stap 3 en V-22: A4, marges 20 mm (0,79 in) links, rechts en boven, 25 mm (0,98 in) onder. */
export function printOpties(bedrijf: Pick<Bedrijf, 'kvk' | 'btwNummer' | 'iban'>) {
  return {
    pageSize: 'A4' as const,
    printBackground: true,
    margins: { top: 0.79, bottom: 0.98, left: 0.79, right: 0.79 },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footerTemplate(bedrijf),
  };
}

/** Veilige webPreferences voor het verborgen venster (§12.3 stap 3). */
export const VERBORGEN_VENSTER = {
  show: false,
  webPreferences: { sandbox: true, javascript: false, contextIsolation: true },
} as const;

const MAX_NAAM = 150;

/**
 * §12.3 stap 5 / FE-056: `<nummer+versieletter> <klantnaam>.pdf`. Klantnaam = bedrijfsnaam bij aanhef
 * `bedrijf` (als ingevuld), anders voor- en achternaam; `<>:"/\|?*` en controletekens → `-`; max. 150 tekens.
 */
export function pdfBestandsnaam(
  nummer: string,
  klant: Pick<Klant, 'aanhef' | 'voornaam' | 'achternaam' | 'bedrijfsnaam'>,
): string {
  const bedrijf = klant.aanhef === 'bedrijf' ? klant.bedrijfsnaam.trim() : '';
  const naam = (bedrijf || volledigeNaam(klant)).replace(/[<>:"/\\|?*\p{Cc}]/gu, '-');
  const basis = `${nummer} ${naam}`
    .trim()
    .slice(0, MAX_NAAM - '.pdf'.length)
    .trimEnd();
  // Windows: een naam mag niet op een punt eindigen.
  return `${basis.replace(/\.+$/, '')}.pdf`;
}

async function bestaat(pad: string): Promise<boolean> {
  try {
    await access(pad, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Eerste vrije pad in `map`: `naam.pdf`, anders `naam-2.pdf`, `naam-3.pdf`, … (FE-056, nooit overschrijven). */
export async function vrijPad(map: string, bestandsnaam: string): Promise<string> {
  const stam = bestandsnaam.replace(/\.pdf$/, '');
  for (let n = 1; ; n++) {
    const pad = join(map, n === 1 ? bestandsnaam : `${stam}-${n}.pdf`);
    if (!(await bestaat(pad))) return pad;
  }
}

function isBezet(fout: unknown): boolean {
  const code = (fout as NodeJS.ErrnoException | null)?.code;
  return code === 'EBUSY' || code === 'EPERM';
}

/** V-01 stap 4: verplaatsen; bij `EXDEV` kopiëren (zonder overschrijven) en verwijderen. */
export async function verplaatsBestand(van: string, naar: string): Promise<void> {
  try {
    try {
      await rename(van, naar);
    } catch (fout) {
      if ((fout as NodeJS.ErrnoException).code !== 'EXDEV') throw fout;
      await copyFile(van, naar, constants.COPYFILE_EXCL);
      await rm(van, { force: true });
    }
  } catch (fout) {
    if (isBezet(fout)) throw new AppFout('PDF_BESTAND_BEZET');
    throw fout;
  }
}

/**
 * Laadt HTML in een verborgen, gesandboxt venster via een tijdelijk bestand (§12.3 stap 2–3) en roept
 * `werk` aan. Venster en tijdelijk bestand worden altijd opgeruimd (stap 6).
 */
export async function metVerborgenVenster<T>(
  html: string,
  werk: (venster: BrowserWindow) => Promise<T>,
): Promise<T> {
  await mkdir(paden.tmpMap, { recursive: true });
  const htmlPad = join(paden.tmpMap, `pdf-${randomUUID()}.html`);
  let venster: BrowserWindow | null = null;
  try {
    await writeFile(htmlPad, html, 'utf8');
    venster = new BrowserWindow(VERBORGEN_VENSTER);
    await venster.loadFile(htmlPad);
    return await werk(venster);
  } finally {
    if (venster && !venster.isDestroyed()) venster.destroy();
    await rm(htmlPad, { force: true });
  }
}

/** Standaard-renderer: HTML (modus `pdf`) → PDF-bytes. */
export function renderPdf(html: string, bedrijf: Bedrijf): Promise<Buffer> {
  return metVerborgenVenster(html, (venster) => venster.webContents.printToPDF(printOpties(bedrijf)));
}
