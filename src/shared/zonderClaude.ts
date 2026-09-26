import { aantalNaarHonderdsten } from './calc/bedragen';
import { keuzeLabel, type Keuzes } from './keuzelijsten';
import { PRIJS_STARTSET } from './prijsStartset';
import type { KlusInvoer, OfferteInhoud, Offerteregel, Prijspost } from './types';
import { werkGroepen, type WerkCatalogus, type WerkRegel } from './werkzaamheden';

// "Maak zonder Claude" (TDO §9.5, V-09, V-27, FE-110): van wizardinvoer, prijslijst en standaardteksten
// naar een offerte, zonder agent. Puur (geen Node of DOM): main zoekt de posten op en schrijft weg.
// Sinds OFM-044 eerst per gekozen werkzaamheid een regel met de materialen en opties als subregels
// (`onderdeelVan`), met de prijzen uit de offerte; daarna steiger, verzekerde garantie en voorrijkosten.
// De regels van de oude stap Extra's zijn met OFM-045 vervallen (oude offertes zijn omgezet).

export const UITVOERING_STANDAARD = 'In overleg.';

/** Controlepunt bij een post zonder prijs of een eigen regel (§9.5, V-09). */
export function vulPrijsIn(omschrijving: string): string {
  return `Vul de prijs in voor: ${omschrijving}`;
}

export interface ZonderClaudeBron {
  invoer: KlusInvoer;
  /** Keuzelijsten uit de database (OFM-034): labels voor de titel. */
  keuzes: Keuzes;
  /** Werkzaamheden en materialen uit de instellingen (OFM-043/044), voor namen en eenheden. */
  catalogus?: WerkCatalogus;
  /** Prijspost op sleutel (§9.3, en `werk:`/`mat:`/`optie:`); `null` als de post is verwijderd. */
  postOpSleutel: (sleutel: string) => Prijspost | null;
  teksten: { inleiding: string; afsluiting: string };
  /** Regel-id's; standaard `crypto.randomUUID()`. */
  maakId?: () => string;
}

/** Titel volgens V-09: `Offerte` + soort werk (kleine letters) + soort dak, niet-gekozen delen weg. */
export function titelZonderClaude(
  invoer: Pick<KlusInvoer, 'soortWerk' | 'soortDak'>,
  keuzes: Pick<Keuzes, 'soortWerk' | 'soortDak'>,
): string {
  const delen = ['Offerte'];
  if (invoer.soortWerk) delen.push(keuzeLabel(keuzes, 'soortWerk', invoer.soortWerk).toLowerCase());
  if (invoer.soortDak) delen.push(keuzeLabel(keuzes, 'soortDak', invoer.soortDak));
  return delen.join(' ');
}

/** Eén te maken regel na de werkzaamheden: een post (op sleutel) met een aantal. */
interface Plan {
  sleutel: string;
  aantal: number;
}

/** Steiger, verzekerde garantie en voorrijkosten (§9.5, de laatste drie rijen van de tabel). */
export function planRegels(invoer: Pick<KlusInvoer, 'steigerNodig' | 'garantieJaren'>): Plan[] {
  const plan: Plan[] = [];
  if (invoer.steigerNodig) plan.push({ sleutel: 'steiger', aantal: 1 });
  if (invoer.garantieJaren === '20') plan.push({ sleutel: 'verzekerde_garantie', aantal: 1 });
  plan.push({ sleutel: 'voorrijkosten', aantal: 1 });
  return plan;
}

const LEGE_CATALOGUS: WerkCatalogus = { werkzaamheden: [], materialen: [] };

/**
 * De volledige inhoud met controlepunten. Posten mét prijs: `prijslijst` met prijs, eenheid en btw
 * van de post. Posten zonder prijs, verwijderde startposten en eigen regels: `schatting`, prijs 0,
 * btw 21 en een controlepunt (V-09, V-27). Werkzaamheden (OFM-044): de prijs uit de offerte;
 * `prijslijst` als die gelijk is aan de post, anders `handmatig`; zonder prijs een schatting. Tekstvelden
 * bevatten hier nog wat de gebruiker invulde; main haalt ze door het opslaginvariant (§11.4).
 */
export function maakInhoudZonderClaude(bron: ZonderClaudeBron): OfferteInhoud {
  const maakId = bron.maakId ?? (() => crypto.randomUUID());
  const controlepunten: string[] = [];

  const werkRegel = (r: WerkRegel, onderdeelVan: string | null): Offerteregel => {
    const post = r.prijsSleutel === null ? null : bron.postOpSleutel(r.prijsSleutel);
    const basis = {
      id: maakId(),
      omschrijving: r.omschrijving,
      aantalHonderdsten: aantalNaarHonderdsten(r.aantal),
      eenheid: r.eenheid,
      btwTarief: post?.btwTarief ?? 21,
      prijspostId: post?.id ?? null,
      ...(onderdeelVan !== null && { onderdeelVan }),
    };
    if (r.prijsCent === null) {
      controlepunten.push(vulPrijsIn(r.omschrijving));
      return { ...basis, prijsCent: 0, prijsbron: 'schatting' };
    }
    const bronPrijs = post?.prijsCent === r.prijsCent ? 'prijslijst' : 'handmatig';
    return { ...basis, prijsCent: r.prijsCent, prijsbron: bronPrijs };
  };

  const groepen = werkGroepen(bron.invoer.werkzaamheden, bron.catalogus ?? LEGE_CATALOGUS);
  const werkRegels = groepen.flatMap((g) => {
    const hoofd = werkRegel(g.werk, null);
    return [hoofd, ...g.subregels.map((s) => werkRegel(s, hoofd.id))];
  });

  const overige = planRegels(bron.invoer).map((p): Offerteregel => {
    const aantalHonderdsten = aantalNaarHonderdsten(p.aantal);
    const post = bron.postOpSleutel(p.sleutel);
    if (post && post.prijsCent !== null) {
      return {
        id: maakId(),
        omschrijving: post.omschrijving,
        aantalHonderdsten,
        eenheid: post.eenheid,
        prijsCent: post.prijsCent,
        btwTarief: post.btwTarief,
        prijsbron: 'prijslijst',
        prijspostId: post.id,
      };
    }
    const start = PRIJS_STARTSET.find((s) => s.sleutel === p.sleutel);
    const omschrijving = post?.omschrijving ?? start?.omschrijving ?? p.sleutel;
    const eenheid = post?.eenheid ?? start?.eenheid ?? 'post';
    controlepunten.push(vulPrijsIn(omschrijving));
    return {
      id: maakId(),
      omschrijving,
      aantalHonderdsten,
      eenheid,
      prijsCent: 0,
      btwTarief: 21,
      prijsbron: 'schatting',
      prijspostId: post?.id ?? null,
    };
  });
  const regels = [...werkRegels, ...overige];

  // Werkomschrijving: per werkzaamheid de naam (met de notitie), daarna de overige regels.
  const werkomschrijving = [
    ...groepen.map((g) => (g.notitie === '' ? g.werk.omschrijving : `${g.werk.omschrijving}: ${g.notitie}`)),
    ...overige.map((r) => r.omschrijving),
  ];

  return {
    titel: titelZonderClaude(bron.invoer, bron.keuzes),
    inleiding: bron.teksten.inleiding,
    werkomschrijving,
    regels,
    uitvoering: bron.invoer.gewensteUitvoering.trim() || UITVOERING_STANDAARD,
    opmerkingen: bron.invoer.overig,
    afsluiting: bron.teksten.afsluiting,
    controlepunten,
  };
}
