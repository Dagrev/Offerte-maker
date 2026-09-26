import { AppFout } from '@shared/fouten';
import { keuzeLabel, type Keuzes } from '@shared/keuzelijsten';
import { aanhefRegel } from '@shared/labels';
import type { PdfModel } from '@shared/pdf-template/render';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { Bedrijf, OfferteDetail, Opmaak, Teksten } from '@shared/types';
import { haalInstelling } from '../db/repo/instellingen';
import { haalKeuzes } from '../db/repo/keuzeopties';
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
  /** Keuzelijsten (OFM-034), voor de garantietekst van een zelf toegevoegde garantie. */
  keuzes: Pick<Keuzes, 'garantie'>;
  fontCss: string;
  /** Nummer zoals het op de offerte komt; standaard `detail.nummer` (`null` → CONCEPT). */
  nummer?: string | null | undefined;
}

/**
 * Garantietekst (§9.4): de standaardteksten bij 10 en 20 jaar; bij een zelf toegevoegde garantie
 * (OFM-034) een vaste zin met het label van die keuze; zonder garantiekeuze (OFM-049) leeg.
 */
export function garantieTekst(
  garantie: string | null,
  teksten: Pick<Teksten, 'garantie10' | 'garantie20'>,
  keuzes: Pick<Keuzes, 'garantie'>,
): string {
  if (garantie === null) return '';
  if (garantie === '10') return teksten.garantie10;
  if (garantie === '20') return teksten.garantie20;
  return `Op de uitgevoerde werkzaamheden geven wij garantie: ${keuzeLabel(keuzes, 'garantie', garantie)}.`;
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
    garantietekst: garantieTekst(detail.invoer.garantieJaren, teksten, bron.keuzes),
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
    keuzes: haalKeuzes(),
    fontCss: fontCss(opmaak.lettertype),
    ...opties,
  });
}
