import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { extraInMeters, extrasMetAantal, keuzeLabel, prijsSleutel, type Keuzes } from './keuzelijsten';
import { labelIsolatie } from './labels';
import { PRIJS_STARTSET } from './prijsStartset';
import type { Eenheid, KlusInvoer, OfferteInhoud, Offerteregel, Prijspost } from './types';

// "Maak zonder Claude" (TDO §9.5, V-09, V-27, FE-110): van wizardinvoer, prijslijst en standaardteksten
// naar een offerte, zonder agent. Puur (geen Node of DOM): main zoekt de posten op en schrijft weg.

export const UITVOERING_STANDAARD = 'In overleg.';

/** Controlepunt bij een post zonder prijs of een eigen regel (§9.5, V-09). */
export function vulPrijsIn(omschrijving: string): string {
  return `Vul de prijs in voor: ${omschrijving}`;
}

export interface ZonderClaudeBron {
  invoer: KlusInvoer;
  /** Keuzelijsten uit de database (OFM-034): labels, en de volgorde van de extra's. */
  keuzes: Keuzes;
  /** Prijspost op startset-sleutel (§9.3); `null` als de post is verwijderd. */
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

/**
 * Eén te maken regel: een post (op sleutel) of een eigen regel, met een aantal in eenheden. `label` is
 * de omschrijving als er geen post (meer) is en de sleutel niet uit de startset komt (OFM-034).
 */
type Plan =
  | { sleutel: string; aantal: number; label?: string; eenheid?: Eenheid }
  | { eigen: string; eenheid: Eenheid; aantal: number };

/**
 * De regels in de volgorde en met de aantallen van de tabel in §9.5. Opties die de gebruiker zelf aan
 * een keuzelijst toevoegde (OFM-034) gebruiken de prijspost met dezelfde sleutel; extra's volgen de
 * volgorde van hun keuzelijst.
 */
export function planRegels(invoer: KlusInvoer, keuzes: Keuzes): Plan[] {
  const m2 = totaalM2(invoer.dakvlakken);
  const plan: Plan[] = [];
  if (invoer.slopenEnAfvoeren) plan.push({ sleutel: 'sloop', aantal: m2 });
  if (invoer.isolatie !== 'geen') plan.push({ sleutel: 'dampremmer', aantal: m2 });
  if (invoer.isolatie === 'anders') {
    const dikte = labelIsolatie(keuzes, 'anders', invoer.isolatieAndersMm);
    plan.push({ eigen: dikte ? `Isolatie ${dikte}` : 'Isolatie', eenheid: 'm²', aantal: m2 });
  } else if (invoer.isolatie !== 'geen') {
    plan.push({
      sleutel: prijsSleutel('isolatie', invoer.isolatie),
      aantal: m2,
      label: `Isolatie ${labelIsolatie(keuzes, invoer.isolatie, null)}`,
      eenheid: 'm²',
    });
  }
  if (invoer.bedekking === 'anders') {
    plan.push({ eigen: invoer.bedekkingAnders.trim() || 'Dakbedekking', eenheid: 'm²', aantal: m2 });
  } else if (invoer.bedekking !== null) {
    plan.push({
      sleutel: invoer.bedekking,
      aantal: m2,
      label: keuzeLabel(keuzes, 'bedekking', invoer.bedekking),
      eenheid: 'm²',
    });
  }
  for (const extra of extrasMetAantal(invoer, keuzes)) {
    const eenheid = extraInMeters(extra.sleutel) ? 'm¹' : 'stuk';
    plan.push({ sleutel: extra.sleutel, aantal: extra.aantal, label: extra.label, eenheid });
  }
  if (invoer.afwerking !== 'geen') {
    plan.push({
      sleutel: invoer.afwerking,
      aantal: m2,
      label: keuzeLabel(keuzes, 'afwerking', invoer.afwerking),
      eenheid: 'm²',
    });
  }
  if (invoer.steigerNodig) plan.push({ sleutel: 'steiger', aantal: 1 });
  if (invoer.garantieJaren === '20') plan.push({ sleutel: 'verzekerde_garantie', aantal: 1 });
  plan.push({ sleutel: 'voorrijkosten', aantal: 1 });
  return plan;
}

/**
 * De volledige inhoud met controlepunten. Posten mét prijs: `prijslijst` met prijs, eenheid en btw
 * van de post. Posten zonder prijs, verwijderde startposten en eigen regels: `schatting`, prijs 0,
 * btw 21 en een controlepunt (V-09, V-27). Tekstvelden bevatten hier nog wat de gebruiker invulde;
 * main haalt ze door het opslaginvariant (§11.4).
 */
export function maakInhoudZonderClaude(bron: ZonderClaudeBron): OfferteInhoud {
  const maakId = bron.maakId ?? (() => crypto.randomUUID());
  const controlepunten: string[] = [];

  const regels = planRegels(bron.invoer, bron.keuzes).map((p): Offerteregel => {
    const aantalHonderdsten = aantalNaarHonderdsten(p.aantal);
    const post = 'sleutel' in p ? bron.postOpSleutel(p.sleutel) : null;
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
    const start = 'sleutel' in p ? PRIJS_STARTSET.find((s) => s.sleutel === p.sleutel) : undefined;
    const omschrijving =
      post?.omschrijving ?? start?.omschrijving ?? ('eigen' in p ? p.eigen : (p.label ?? p.sleutel));
    const eenheid = post?.eenheid ?? start?.eenheid ?? p.eenheid ?? 'post';
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

  return {
    titel: titelZonderClaude(bron.invoer, bron.keuzes),
    inleiding: bron.teksten.inleiding,
    werkomschrijving: regels.map((r) => r.omschrijving),
    regels,
    uitvoering: bron.invoer.gewensteUitvoering.trim() || UITVOERING_STANDAARD,
    opmerkingen: bron.invoer.overig,
    afsluiting: bron.teksten.afsluiting,
    controlepunten,
  };
}
