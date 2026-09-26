import { m2VanDakvlak, totaalM2 } from '@shared/calc/bedragen';
import { VASTE_EXTRAS, extrasMetAantal, keuzeLabel, type Keuzes } from '@shared/keuzelijsten';
import { labelBedekking, labelIsolatie } from '@shared/labels';
import type { Klant, KlusInvoer } from '@shared/types';
import { anonimiseer } from './anonimiseer';
import { bouwPiiSet } from './piiSet';

// Klusgegevens zoals de agent ze krijgt (TDO §10.5 laatste alinea, V-26, FO §8.2, A-12).
// Codes worden labels uit de keuzelijsten (OFM-034); van de klant gaan alleen plaatshouders mee, nooit aanhef, adres, postcode,
// telefoon of e-mail. Vrije tekst (gewensteUitvoering, overig, bedekkingAnders, dakvlaknamen) gaat
// door het privacyfilter.

export interface KlusVoorAgent {
  soortWerk: string | null;
  soortDak: string | null;
  dakvlakken: { naam: string; m2: number }[];
  bedekking: string | null;
  bedekkingAnders: string;
  huidigeBedekking: string | null;
  ondergrond: string | null;
  slopenEnAfvoeren: boolean;
  isolatie: string;
  isolatieAndersMm: number | null;
  daktrimM1: number;
  dakgootM1: number;
  hwaAantal: number;
  noodoverloopAantal: number;
  doorvoerAantal: number;
  lichtkoepelAantal: number;
  /** Zelf toegevoegde extra's (OFM-034) met een aantal > 0: label en aantal. */
  extras: { naam: string; aantal: number }[];
  afwerking: string;
  hoogte: string;
  steigerNodig: boolean;
  /** Label van de garantiekeuze, bv. "10 jaar" (OFM-034; was garantieJaren: 10 | 20). */
  garantie: string;
  gewensteUitvoering: string;
  overig: string;
  totaalM2: number;
  offertedatum: string;
  klant: {
    naam: '[KLANT_NAAM]';
    isBedrijf: boolean;
    bedrijf: '[KLANT_BEDRIJF]' | null;
    heeftWerkadres: boolean;
  };
}

export interface KlusBron {
  invoer: KlusInvoer;
  klant: Klant;
  offertedatum: string;
  /** Keuzelijsten uit de database (OFM-034). */
  keuzes: Keuzes;
}

export interface KlusOpties {
  /**
   * `false` slaat het privacyfilter over. Alleen voor de testhaak `privacyfilter-uit` (§11.3,
   * FE-033); de eindcontrole (`controleer`) draait daarna altijd.
   */
  filteren?: boolean;
}

export function bouwKlusVoorAgent(bron: KlusBron, opties: KlusOpties = {}): KlusVoorAgent {
  const { invoer, klant, offertedatum, keuzes } = bron;
  const label = (lijst: Parameters<typeof keuzeLabel>[1], sleutel: string) =>
    keuzeLabel(keuzes, lijst, sleutel);
  const piiSet = bouwPiiSet(klant);
  const filter = opties.filteren === false ? (t: string) => t : (t: string) => anonimiseer(t, piiSet);
  const bedekkingAnders = filter(invoer.bedekkingAnders);
  const isBedrijf = klant.aanhef === 'bedrijf';

  return {
    soortWerk: invoer.soortWerk === null ? null : label('soortWerk', invoer.soortWerk),
    soortDak: invoer.soortDak === null ? null : label('soortDak', invoer.soortDak),
    dakvlakken: invoer.dakvlakken.map((v) => ({ naam: filter(v.naam), m2: m2VanDakvlak(v) })),
    bedekking: invoer.bedekking === null ? null : labelBedekking(keuzes, invoer.bedekking, bedekkingAnders),
    bedekkingAnders,
    huidigeBedekking:
      invoer.huidigeBedekking === null ? null : label('huidigeBedekking', invoer.huidigeBedekking),
    ondergrond: invoer.ondergrond === null ? null : label('ondergrond', invoer.ondergrond),
    slopenEnAfvoeren: invoer.slopenEnAfvoeren,
    isolatie: labelIsolatie(keuzes, invoer.isolatie, invoer.isolatieAndersMm),
    isolatieAndersMm: invoer.isolatieAndersMm,
    daktrimM1: invoer.daktrimM1,
    dakgootM1: invoer.dakgootM1,
    hwaAantal: invoer.hwaAantal,
    noodoverloopAantal: invoer.noodoverloopAantal,
    doorvoerAantal: invoer.doorvoerAantal,
    lichtkoepelAantal: invoer.lichtkoepelAantal,
    extras: extrasMetAantal(invoer, keuzes)
      .filter((e) => !Object.hasOwn(VASTE_EXTRAS, e.sleutel))
      .map((e) => ({ naam: e.label, aantal: e.aantal })),
    afwerking: label('afwerking', invoer.afwerking),
    hoogte: label('hoogte', invoer.hoogte),
    steigerNodig: invoer.steigerNodig,
    garantie: label('garantie', invoer.garantieJaren),
    gewensteUitvoering: filter(invoer.gewensteUitvoering),
    overig: filter(invoer.overig),
    totaalM2: totaalM2(invoer.dakvlakken),
    offertedatum,
    klant: {
      naam: '[KLANT_NAAM]',
      isBedrijf,
      // Alleen als er een bedrijfsnaam is; ook een particulier kan er een hebben ingevuld.
      bedrijf: klant.bedrijfsnaam.trim() !== '' ? '[KLANT_BEDRIJF]' : null,
      heeftWerkadres: klant.heeftWerkadres,
    },
  };
}

/**
 * De delen van `KlusVoorAgent` die uit invoer van de gebruiker komen (§11.3): gewensteUitvoering,
 * overig, bedekkingAnders en de dakvlaknamen. Bij `aanpassen` voegt de opdrachtbouwer de
 * (gefilterde) instructie en de tekstvelden van de huidige inhoud toe (`tekstvelden` in
 * `invullen.ts`). Aan elkaar geplakt met `\n` is dit de `payload` voor `controleer`.
 */
export function gebruikersTekst(klus: KlusVoorAgent): string[] {
  return [klus.gewensteUitvoering, klus.overig, klus.bedekkingAnders, ...klus.dakvlakken.map((v) => v.naam)];
}
