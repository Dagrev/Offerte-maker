import { access } from 'node:fs/promises';
import { shell } from 'electron';
import { AppFout } from '@shared/fouten';
import { renderOfferteHtml } from '@shared/pdf-template/render';
import { laatstePdf } from '../db/repo/offertesDefinitief';
import { log } from '../log';
import { metVerborgenVenster } from './maakPdf';
import { pdfModelVoorOfferte } from './pdfModel';

// Openen, afdrukken en tonen in de map (TDO §12.4, FE-057). Alleen voor offertes met een PDF;
// anders `VALIDATIE` "Maak de offerte eerst definitief." (uit `laatstePdf`).

async function bestaandePdf(id: string): Promise<string> {
  const { pad } = laatstePdf(id);
  try {
    await access(pad);
  } catch {
    log.warn(`pdf van ${id} niet gevonden op schijf`);
    throw new AppFout('ONBEKEND');
  }
  return pad;
}

/** Open PDF: `shell.openPath` van de laatste PDF. */
export async function openPdf(id: string): Promise<null> {
  const fout = await shell.openPath(await bestaandePdf(id));
  if (fout) {
    log.warn(`pdf openen mislukt: ${fout}`);
    throw new AppFout('ONBEKEND');
  }
  return null;
}

/** Toon in map: Verkenner met het bestand geselecteerd. */
export async function toonInMap(id: string): Promise<null> {
  shell.showItemInFolder(await bestaandePdf(id));
  return null;
}

/**
 * Afdrukken: de HTML (modus `pdf`, met het nummer van de laatste PDF) in een verborgen venster zoals
 * bij het maken, dan het Windows-afdrukvenster. Wacht tot de gebruiker afdrukt of annuleert.
 */
export async function drukAf(id: string): Promise<null> {
  const { nummer, versieletter } = laatstePdf(id);
  const html = renderOfferteHtml(pdfModelVoorOfferte(id, { nummer: nummer + versieletter }), 'pdf');
  await metVerborgenVenster(
    html,
    (venster) =>
      new Promise<void>((klaar) => {
        venster.webContents.print({ silent: false, printBackground: true }, (gelukt, reden) => {
          if (!gelukt && reden !== 'cancelled') log.warn(`afdrukken: ${reden}`);
          klaar();
        });
      }),
  );
  return null;
}
