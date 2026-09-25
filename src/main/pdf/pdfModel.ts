import { AppFout } from '@shared/fouten';
import { aanhefRegel } from '@shared/labels';
import type { PdfModel } from '@shared/pdf-template/render';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { Bedrijf, OfferteDetail, Opmaak, Teksten } from '@shared/types';
import { haalInstelling } from '../db/repo/instellingen';
import { haalOfferte } from '../db/repo/offertesInvoer';
import { logoDataUri } from '../instellingen/beheer';
import { fontCss } from './fonts';

// Samenstelling van het `PdfModel` (TDO §12.3 stap 1, V-27). Eén plek voor voorbeeld (OFM-014,
// `offerte:voorbeeldHtml`) en PDF (OFM-015), zodat die twee per definitie gelijk zijn (FE-050).

export interface PdfModelBron {
  /** Uit `haalOfferte`: inhoud al ingevuld (§11.4), totalen via §7. */
  detail: OfferteDetail;
  bedrijf: Bedrijf;
  logoDataUri: string | null;
  opmaak: Opmaak;
  teksten: Teksten;
  fontCss: string;
  /** Nummer zoals het op de offerte komt; standaard `detail.nummer` (`null` → CONCEPT). */
  nummer?: string | null | undefined;
}

/** Pure samenstelling; gooit `VALIDATIE` als de offerte nog geen inhoud heeft. */
export function stelPdfModelSamen(bron: PdfModelBron): PdfModel {
  const { detail, teksten } = bron;
  if (detail.inhoud === null || detail.totalen === null) {
    throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
  }
  return {
    bedrijf: bron.bedrijf,
    logoDataUri: bron.logoDataUri,
    opmaak: bron.opmaak,
    fontCss: bron.fontCss,
    klant: detail.klant,
    nummer: bron.nummer === undefined ? detail.nummer : bron.nummer,
    offertedatum: detail.offertedatum,
    geldigTot: detail.geldigTot,
    aanhefregel: aanhefRegel(detail.klant),
    inhoud: detail.inhoud,
    totalen: detail.totalen,
    garantietekst: detail.invoer.garantieJaren === 20 ? teksten.garantie20 : teksten.garantie10,
    betalingsvoorwaarden: teksten.betalingsvoorwaarden,
    geldigheidDagen: teksten.geldigheidDagen,
    voetnoot: teksten.voetnoot,
  };
}

/**
 * Het `PdfModel` van een opgeslagen offerte, met de huidige instellingen. OFM-015 geeft bij definitief
 * maken het nummer met versieletter mee via `opties.nummer`.
 */
export function pdfModelVoorOfferte(id: string, opties: { nummer?: string | null } = {}): PdfModel {
  const bedrijf = haalInstelling('bedrijf');
  const opmaak = haalInstelling('opmaak');
  return stelPdfModelSamen({
    detail: haalOfferte(id),
    bedrijf,
    logoDataUri: logoDataUri(bedrijf.logoBestandId),
    opmaak,
    teksten: haalInstelling('teksten'),
    fontCss: fontCss(opmaak.lettertype),
    ...opties,
  });
}
