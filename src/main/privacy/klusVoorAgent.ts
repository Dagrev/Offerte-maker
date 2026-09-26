import { euroNaarCent, m2VanDakvlak, totaalM2 } from '@shared/calc/bedragen';
import { keuzeLabel, type Keuzes } from '@shared/keuzelijsten';
import type { Klant, KlusInvoer, Prijspost } from '@shared/types';
import { werkGroepen, type WerkCatalogus, type WerkRegel } from '@shared/werkzaamheden';
import { anonimiseer } from './anonimiseer';
import { bouwPiiSet } from './piiSet';

// Klusgegevens zoals de agent ze krijgt (TDO §10.5 laatste alinea, V-26, FO §8.2, A-12).
// Codes worden labels uit de keuzelijsten (OFM-034); van de klant gaan alleen plaatshouders mee, nooit
// aanhef, adres, postcode, telefoon of e-mail. Vrije tekst (gewensteUitvoering, overig, dakvlaknamen,
// en sinds OFM-044 de notities en namen van eenmalige werkzaamheden en materialen) gaat door het
// privacyfilter. Sinds OFM-044 staan de gekozen werkzaamheden erin met de prijzen van deze offerte; de
// velden van de oude stap Extra's (bedekking, isolatie, extra's, afwerking) zijn met OFM-045 vervallen.

/** Een regel die uit een werkzaamheid volgt, zoals de agent hem krijgt. */
export interface WerkRegelVoorAgent {
  naam: string;
  eenheid: string;
  aantal: number;
  /** Prijs voor deze offerte (excl. btw); `null` = geen prijs, de agent schat. */
  prijsEuro: number | null;
  /** Id van de prijspost; bij een eenmalig item `eenmalig-…` (geen post). */
  prijspostId: string | null;
}

export interface WerkzaamheidVoorAgent extends WerkRegelVoorAgent {
  /**
   * OFM-048: prijs per uur. Dan is `aantal` het aantal uren, `eenheid` "uur", `prijsEuro` de uurprijs en
   * `prijspostId` de uurprijs-post.
   */
  perUur: boolean;
  notitie: string;
  materialen: WerkRegelVoorAgent[];
  opties: WerkRegelVoorAgent[];
}

export interface KlusVoorAgent {
  soortWerk: string | null;
  soortDak: string | null;
  dakvlakken: { naam: string; m2: number }[];
  huidigeBedekking: string | null;
  ondergrond: string | null;
  hoogte: string;
  /** OFM-044: de gekozen werkzaamheden, met materialen en opties. */
  werkzaamheden: WerkzaamheidVoorAgent[];
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
  /** Werkzaamheden en materialen uit de instellingen (OFM-044); standaard leeg. */
  catalogus?: WerkCatalogus;
  /** Prijspost op sleutel (`werk:`, `mat:`, `optie:`), voor het id; standaard geen. */
  postOpSleutel?: (sleutel: string) => Prijspost | null;
}

export interface KlusOpties {
  /**
   * `false` slaat het privacyfilter over. Alleen voor de testhaak `privacyfilter-uit` (§11.3,
   * FE-033); de eindcontrole (`controleer`) draait daarna altijd.
   */
  filteren?: boolean;
}

export const EENMALIG_ID = 'eenmalig-';

export function bouwKlusVoorAgent(bron: KlusBron, opties: KlusOpties = {}): KlusVoorAgent {
  const { invoer, klant, offertedatum, keuzes } = bron;
  const label = (lijst: Parameters<typeof keuzeLabel>[1], sleutel: string) =>
    keuzeLabel(keuzes, lijst, sleutel);
  const piiSet = bouwPiiSet(klant);
  const filter = opties.filteren === false ? (t: string) => t : (t: string) => anonimiseer(t, piiSet);
  const isBedrijf = klant.aanhef === 'bedrijf';
  const postOpSleutel = bron.postOpSleutel ?? (() => null);

  const alsRegel = (r: WerkRegel, eenmaligId: string): WerkRegelVoorAgent => ({
    // Een eenmalige naam is vrije tekst van de gebruiker: door het filter.
    naam: r.prijsSleutel === null ? filter(r.omschrijving) : r.omschrijving,
    eenheid: r.eenheid,
    aantal: r.aantal,
    prijsEuro: r.prijsCent === null ? null : r.prijsCent / 100,
    prijspostId:
      r.prijsSleutel === null ? `${EENMALIG_ID}${eenmaligId}` : (postOpSleutel(r.prijsSleutel)?.id ?? null),
  });
  const werkzaamheden = werkGroepen(
    invoer.werkzaamheden,
    bron.catalogus ?? {
      werkzaamheden: [],
      materialen: [],
    },
  ).map((g, i): WerkzaamheidVoorAgent => {
    const nr = `w${i + 1}`;
    const aantalMaterialen = invoer.werkzaamheden[i]?.materialen.length ?? 0;
    const subs = g.subregels.map((s, j) =>
      alsRegel(s, j < aantalMaterialen ? `${nr}-m${j + 1}` : `${nr}-o${j - aantalMaterialen + 1}`),
    );
    return {
      ...alsRegel(g.werk, nr),
      perUur: invoer.werkzaamheden[i]?.perUur ?? false,
      notitie: filter(g.notitie),
      materialen: subs.slice(0, aantalMaterialen),
      opties: subs.slice(aantalMaterialen),
    };
  });

  return {
    soortWerk: invoer.soortWerk === null ? null : label('soortWerk', invoer.soortWerk),
    soortDak: invoer.soortDak === null ? null : label('soortDak', invoer.soortDak),
    dakvlakken: invoer.dakvlakken.map((v) => ({ naam: filter(v.naam), m2: m2VanDakvlak(v) })),
    huidigeBedekking:
      invoer.huidigeBedekking === null ? null : label('huidigeBedekking', invoer.huidigeBedekking),
    ondergrond: invoer.ondergrond === null ? null : label('ondergrond', invoer.ondergrond),
    hoogte: label('hoogte', invoer.hoogte),
    werkzaamheden,
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
 * De prijzen die in deze offerte vastliggen (OFM-044): prijspost-id (of `eenmalig-…`) → prijs in
 * centen. De nabewerking (§10.7) zet een regel met zo'n id op deze prijs, ook als de agent iets anders
 * gaf; een werkzaamheid zonder prijs staat er niet in (die mag de agent schatten).
 */
export function vastePrijzen(klus: Pick<KlusVoorAgent, 'werkzaamheden'>): Map<string, number> {
  const uit = new Map<string, number>();
  const zet = (r: WerkRegelVoorAgent) => {
    if (r.prijspostId !== null && r.prijsEuro !== null) uit.set(r.prijspostId, euroNaarCent(r.prijsEuro));
  };
  for (const w of klus.werkzaamheden) {
    zet(w);
    w.materialen.forEach(zet);
    w.opties.forEach(zet);
  }
  return uit;
}

/**
 * De delen van `KlusVoorAgent` die uit invoer van de gebruiker komen (§11.3): gewensteUitvoering,
 * overig, de dakvlaknamen en (OFM-044) de notities en eenmalige namen. Bij `aanpassen`
 * voegt de opdrachtbouwer de (gefilterde) instructie en de tekstvelden van de huidige inhoud toe
 * (`tekstvelden` in `invullen.ts`). Aan elkaar geplakt met `\n` is dit de `payload` voor `controleer`.
 */
export function gebruikersTekst(klus: KlusVoorAgent): string[] {
  const eenmalig = (r: WerkRegelVoorAgent) => (r.prijspostId?.startsWith(EENMALIG_ID) ? [r.naam] : []);
  return [
    klus.gewensteUitvoering,
    klus.overig,
    ...klus.dakvlakken.map((v) => v.naam),
    ...klus.werkzaamheden.flatMap((w) => [w.notitie, ...eenmalig(w), ...w.materialen.flatMap(eenmalig)]),
  ];
}
