import { aantalNaarHonderdsten, totaalM2 } from './calc/bedragen';
import { SOORT_DAK_LABELS, SOORT_WERK_LABELS, labelIsolatie } from './labels';
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
  /** Prijspost op startset-sleutel (§9.3); `null` als de post is verwijderd. */
  postOpSleutel: (sleutel: string) => Prijspost | null;
  teksten: { inleiding: string; afsluiting: string };
  /** Regel-id's; standaard `crypto.randomUUID()`. */
  maakId?: () => string;
}

/** Titel volgens V-09: `Offerte` + soort werk (kleine letters) + soort dak, niet-gekozen delen weg. */
export function titelZonderClaude(invoer: Pick<KlusInvoer, 'soortWerk' | 'soortDak'>): string {
  const delen = ['Offerte'];
  if (invoer.soortWerk) delen.push(SOORT_WERK_LABELS[invoer.soortWerk].toLowerCase());
  if (invoer.soortDak) delen.push(SOORT_DAK_LABELS[invoer.soortDak]);
  return delen.join(' ');
}

/** Eén te maken regel: een startpost (op sleutel) of een eigen regel, met een aantal in eenheden. */
type Plan = { sleutel: string; aantal: number } | { eigen: string; eenheid: Eenheid; aantal: number };

/** De regels in de volgorde en met de aantallen van de tabel in §9.5. */
export function planRegels(invoer: KlusInvoer): Plan[] {
  const m2 = totaalM2(invoer.dakvlakken);
  const plan: Plan[] = [];
  if (invoer.slopenEnAfvoeren) plan.push({ sleutel: 'sloop', aantal: m2 });
  if (invoer.isolatie !== 'geen') plan.push({ sleutel: 'dampremmer', aantal: m2 });
  if (invoer.isolatie === 'anders') {
    const dikte = labelIsolatie('anders', invoer.isolatieAndersMm);
    plan.push({ eigen: dikte ? `Isolatie ${dikte}` : 'Isolatie', eenheid: 'm²', aantal: m2 });
  } else if (invoer.isolatie !== 'geen') {
    plan.push({ sleutel: `isolatie_${invoer.isolatie}`, aantal: m2 });
  }
  if (invoer.bedekking === 'anders') {
    plan.push({ eigen: invoer.bedekkingAnders.trim() || 'Dakbedekking', eenheid: 'm²', aantal: m2 });
  } else if (invoer.bedekking !== null) {
    plan.push({ sleutel: invoer.bedekking, aantal: m2 });
  }
  if (invoer.daktrimM1 > 0) plan.push({ sleutel: 'daktrim', aantal: invoer.daktrimM1 });
  if (invoer.dakgootM1 > 0) plan.push({ sleutel: 'dakgoot_epdm', aantal: invoer.dakgootM1 });
  if (invoer.hwaAantal > 0) plan.push({ sleutel: 'hwa', aantal: invoer.hwaAantal });
  if (invoer.noodoverloopAantal > 0)
    plan.push({ sleutel: 'noodoverloop', aantal: invoer.noodoverloopAantal });
  if (invoer.doorvoerAantal > 0) plan.push({ sleutel: 'doorvoer', aantal: invoer.doorvoerAantal });
  if (invoer.lichtkoepelAantal > 0) plan.push({ sleutel: 'lichtkoepel', aantal: invoer.lichtkoepelAantal });
  if (invoer.afwerking !== 'geen') plan.push({ sleutel: invoer.afwerking, aantal: m2 });
  if (invoer.steigerNodig) plan.push({ sleutel: 'steiger', aantal: 1 });
  if (invoer.garantieJaren === 20) plan.push({ sleutel: 'verzekerde_garantie', aantal: 1 });
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

  const regels = planRegels(bron.invoer).map((p): Offerteregel => {
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
    const omschrijving = post?.omschrijving ?? start?.omschrijving ?? ('eigen' in p ? p.eigen : '');
    const eenheid = post?.eenheid ?? start?.eenheid ?? ('eigen' in p ? p.eenheid : 'post');
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
    titel: titelZonderClaude(bron.invoer),
    inleiding: bron.teksten.inleiding,
    werkomschrijving: regels.map((r) => r.omschrijving),
    regels,
    uitvoering: bron.invoer.gewensteUitvoering.trim() || UITVOERING_STANDAARD,
    opmerkingen: bron.invoer.overig,
    afsluiting: bron.teksten.afsluiting,
    controlepunten,
  };
}
