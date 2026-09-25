import { randomUUID } from 'node:crypto';
import { aantalNaarHonderdsten, euroNaarCent } from '@shared/calc/bedragen';
import { formatEuro } from '@shared/formatteer';
import type { Klant, OfferteInhoud, Offerteregel, Prijspost } from '@shared/types';
import { mapTekstvelden, TOEGESTANE_PLAATSHOUDERS, terugNaarPlaatshouders } from '../privacy/invullen';
import type { AgentUitvoer, AgentUitvoerRegel } from './uitvoerSchema';

// Nabewerking van het agentantwoord (TDO §10.7 stap 6, V-02, V-05, V-06). Puur: de aanroeper geeft de
// prijsposten en de klant mee, deze module leest niets uit de database.

export interface NabewerkOpties {
  soort: 'maken' | 'aanpassen';
  klant: Klant;
  /** Prijspost op id; `null` als die niet (meer) bestaat. */
  prijspost: (id: string) => Prijspost | null;
  /**
   * Alleen bij `aanpassen` (OFM-017): de regels van de huidige offerte, in de volgorde waarin ze als
   * `r1`, `r2`, … in de opdracht stonden (V-06).
   */
  huidigeRegels?: readonly Offerteregel[];
}

const WEGGELATEN = /\[(?:VERWIJDERD|BEDRIJF)\]/g;
const PLAATSHOUDER = /\[[A-Z_]+\]/g;
const AANHEF_REGEL = /^\s*(geachte|beste)\b[^\n]*\n?/i;

/** `[VERWIJDERD]` en `[BEDRIJF]` weg, dubbele spaties en spaties aan regelranden opgeschoond. */
export function zonderWeggelaten(tekst: string): string {
  return tekst
    .replace(WEGGELATEN, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/gm, '');
}

export function controlepuntPrijslijst(omschrijving: string, prijsCent: number): string {
  return `Prijs van "${omschrijving}" gelijkgezet aan de prijslijst (${formatEuro(prijsCent)}).`;
}

export function controlepuntOnbekendePlaatshouder(plaatshouder: string): string {
  return `Onbekende plaatshouder ${plaatshouder} in de tekst.`;
}

/** Regel omzetten naar honderdsten/centen en de prijsbronregels uit §10.7 toepassen. */
function verwerkRegel(r: AgentUitvoerRegel, opties: NabewerkOpties, controlepunten: string[]): Offerteregel {
  const basis = {
    id: randomUUID(),
    omschrijving: r.omschrijving,
    aantalHonderdsten: aantalNaarHonderdsten(r.aantal),
    eenheid: r.eenheid,
    prijsCent: euroNaarCent(r.prijsEuro),
    btwTarief: r.btwTarief,
    prijspostId: r.prijspostId,
  };

  // V-06: handmatig blijft alleen bij `aanpassen`, als de ref naar een handmatige regel wijst met
  // dezelfde prijs. Bij `maken` is `ref` altijd null.
  if (r.prijsbron === 'handmatig') {
    const oud = opties.soort === 'aanpassen' && r.ref !== null ? refRegel(r.ref, opties.huidigeRegels) : null;
    if (oud?.prijsbron === 'handmatig' && oud.prijsCent === basis.prijsCent) {
      return { ...basis, prijsbron: 'handmatig' };
    }
  }

  const post = r.prijspostId === null ? null : opties.prijspost(r.prijspostId);
  if (post && post.prijsCent !== null) {
    if (basis.prijsCent !== post.prijsCent) {
      controlepunten.push(controlepuntPrijslijst(r.omschrijving, post.prijsCent));
    }
    return {
      ...basis,
      prijsCent: post.prijsCent,
      eenheid: post.eenheid,
      btwTarief: post.btwTarief,
      prijsbron: 'prijslijst',
    };
  }
  if (r.prijsbron === 'prijslijst' || r.prijsbron === 'handmatig')
    return { ...basis, prijsbron: 'schatting' };
  return { ...basis, prijsbron: r.prijsbron };
}

/** `r1` → eerste huidige regel, enz.; onbekende ref → null (V-27: dubbele ref telt maar één keer). */
function refRegel(ref: string, huidige: readonly Offerteregel[] = []): Offerteregel | null {
  const m = /^r(\d+)$/.exec(ref);
  return m ? (huidige[Number(m[1]) - 1] ?? null) : null;
}

/** Controlepunten voor plaatshouders die de app niet kent; die blijven in de tekst staan. */
function onbekendePlaatshouders(inhoud: OfferteInhoud): string[] {
  const toegestaan = new Set<string>(TOEGESTANE_PLAATSHOUDERS);
  const gevonden = new Set<string>();
  mapTekstvelden(inhoud, (t) => {
    for (const p of t.match(PLAATSHOUDER) ?? []) if (!toegestaan.has(p)) gevonden.add(p);
    return t;
  });
  return [...gevonden].map(controlepuntOnbekendePlaatshouder);
}

/** §10.7 stap 6: van gevalideerd agentantwoord naar op te slaan inhoud (met plaatshouders). */
export function nabewerk(uitvoer: AgentUitvoer, opties: NabewerkOpties): OfferteInhoud {
  const extraPunten: string[] = [];
  const gebruikteRefs = new Set<string>();
  const regels = uitvoer.regels.map((r) => {
    // V-27: alleen de eerste regel met een bepaalde ref geldt als die bestaande regel.
    const ref = opties.soort === 'maken' || r.ref === null || gebruikteRefs.has(r.ref) ? null : r.ref;
    if (ref !== null) gebruikteRefs.add(ref);
    return verwerkRegel({ ...r, ref }, opties, extraPunten);
  });

  let inhoud: OfferteInhoud = {
    titel: uitvoer.titel,
    inleiding: uitvoer.inleiding.replace(AANHEF_REGEL, ''),
    werkomschrijving: uitvoer.werkomschrijving,
    regels,
    uitvoering: uitvoer.uitvoering,
    opmerkingen: uitvoer.opmerkingen,
    afsluiting: uitvoer.afsluiting,
    // V-05: schattingen komen hier niet bij; de gele balk berekent die zelf.
    controlepunten: uitvoer.controlepunten,
  };
  inhoud = mapTekstvelden(inhoud, zonderWeggelaten);
  inhoud = {
    ...inhoud,
    controlepunten: [...inhoud.controlepunten, ...extraPunten, ...onbekendePlaatshouders(inhoud)],
  };
  // Opslaginvariant (§11.4): vangnet voor een klantgegeven dat de agent toch zou noemen.
  return terugNaarPlaatshouders(inhoud, opties.klant);
}
