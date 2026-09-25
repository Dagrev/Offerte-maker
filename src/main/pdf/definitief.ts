import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppFout } from '@shared/fouten';
import { renderOfferteHtml } from '@shared/pdf-template/render';
import type { Bedrijf } from '@shared/types';
import { haalInstelling } from '../db/repo/instellingen';
import { legDefinitiefVast, planDefinitief } from '../db/repo/offertesDefinitief';
import { log } from '../log';
import { paden } from '../paden';
import { testhaak } from '../testhaken';
import { pdfBestandsnaam, renderPdf, verplaatsBestand, vrijPad } from './maakPdf';
import { pdfModelVoorOfferte } from './pdfModel';

// `maakDefinitief(id)` volgens V-01 (TDO §12.3): geen transactie rond de asynchrone PDF-stap.
// 1. mutex · 2. lezen (voorlopig nummer, versieletter) · 3. PDF naar tmp · 4. verplaatsen ·
// 5. één synchrone transactie. Mislukt 3 of 4, dan is er niets in de database veranderd.

export type PdfRenderer = (html: string, bedrijf: Bedrijf) => Promise<Buffer>;

let wachtrij: Promise<unknown> = Promise.resolve();

/** Module-brede mutex: één `maakDefinitief` tegelijk in de hele app; een volgende aanroep wacht. */
function na<T>(werk: () => Promise<T>): Promise<T> {
  const beurt = wachtrij.then(werk, werk);
  wachtrij = beurt.catch(() => undefined);
  return beurt;
}

export function maakDefinitief(
  id: string,
  renderer: PdfRenderer = renderPdf,
): Promise<{ nummer: string; pad: string }> {
  return na(async () => {
    const plan = planDefinitief(id);
    const weergave = plan.nummer + plan.versieletter;
    const bedrijf = haalInstelling('bedrijf');
    const html = renderOfferteHtml(pdfModelVoorOfferte(id, { nummer: weergave }), 'pdf');

    await mkdir(paden.tmpMap, { recursive: true });
    const tmpPdf = join(paden.tmpMap, `pdf-${randomUUID()}.pdf`);
    let pad: string;
    try {
      await writeFile(tmpPdf, await renderer(html, bedrijf));
      const map = paden.pdfMap(plan.jaar);
      await mkdir(map, { recursive: true });
      pad = await vrijPad(map, pdfBestandsnaam(weergave, plan.klant));
      if (testhaak('pdf-bezet')) throw new AppFout('PDF_BESTAND_BEZET');
      await verplaatsBestand(tmpPdf, pad);
    } finally {
      await rm(tmpPdf, { force: true });
    }

    try {
      legDefinitiefVast(plan, pad, haalInstelling('teksten').geldigheidDagen);
    } catch (fout) {
      await rm(pad, { force: true });
      log.error(`definitief ${id}: database bijwerken mislukt, PDF verwijderd`, fout);
      throw new AppFout('ONBEKEND');
    }
    log.info(`definitief ${id}: ${weergave}`);
    return { nummer: weergave, pad };
  });
}
