import type { BtwTarief, Dakvlak, Offerteregel, Totalen } from '../types';

// Rekenmodule (TDO §7). Alle bedragen in centen, alle aantallen in honderdsten (integers).
// "De agent schrijft, de app rekent": totalen komen altijd hieruit, nooit van de agent.

/** Afronden half-van-nul-af, ook bij negatieve getallen. `+ 0` voorkomt `-0`. */
export function rondAf(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x)) + 0;
}

export type RegelVoorBedrag = Pick<Offerteregel, 'aantalHonderdsten' | 'prijsCent'>;
export type RegelVoorTotalen = Pick<Offerteregel, 'aantalHonderdsten' | 'prijsCent' | 'btwTarief'>;
export type MatenVanDakvlak = Pick<Dakvlak, 'modus' | 'lengteM' | 'breedteM' | 'm2'>;

/** Regelbedrag in centen: aantal (honderdsten) × prijs (centen) / 100, afgerond. */
export function regelbedragCent(r: RegelVoorBedrag): number {
  return rondAf((r.aantalHonderdsten * r.prijsCent) / 100);
}

/** Volgorde waarin btw-regels verschijnen. */
const TARIEVEN: readonly BtwTarief[] = [21, 9, 0];

/**
 * Subtotaal, btw per aanwezig tarief (volgorde 21, 9, 0) en totaal. Een tarief staat er alleen in
 * als er regels met dat tarief zijn; btw wordt per tarief over de grondslag berekend.
 */
export function berekenTotalen(regels: readonly RegelVoorTotalen[]): Totalen {
  let subtotaalCent = 0;
  const grondslag = new Map<BtwTarief, number>();
  for (const r of regels) {
    const bedrag = regelbedragCent(r);
    subtotaalCent += bedrag;
    grondslag.set(r.btwTarief, (grondslag.get(r.btwTarief) ?? 0) + bedrag);
  }
  const btw: Totalen['btw'] = [];
  for (const tarief of TARIEVEN) {
    const grondslagCent = grondslag.get(tarief);
    if (grondslagCent === undefined) continue;
    btw.push({ tarief, grondslagCent, bedragCent: rondAf((grondslagCent * tarief) / 100) });
  }
  const totaalCent = btw.reduce((som, b) => som + b.bedragCent, subtotaalCent);
  return { subtotaalCent, btw, totaalCent };
}

/** `null` en negatieve maten tellen als 0. */
function maat(x: number | null): number {
  return x !== null && x > 0 ? x : 0;
}

/** Oppervlakte van één dakvlak in m² (op 2 decimalen bij lengte × breedte). */
export function m2VanDakvlak(v: MatenVanDakvlak): number {
  if (v.modus === 'lxb') return rondAf(maat(v.lengteM) * maat(v.breedteM) * 100) / 100;
  return maat(v.m2);
}

/** Som van alle dakvlakken in m², afgerond op 2 decimalen. */
export function totaalM2(vlakken: readonly MatenVanDakvlak[]): number {
  const som = vlakken.reduce((acc, v) => acc + m2VanDakvlak(v), 0);
  return rondAf(som * 100) / 100;
}

/** Euro's (bijv. 12,5) naar centen (1250). */
export function euroNaarCent(e: number): number {
  return rondAf(e * 100);
}

/** Aantal (bijv. 34,8) naar honderdsten (3480). */
export function aantalNaarHonderdsten(a: number): number {
  return rondAf(a * 100);
}

// ---------- Werkzaamheden (OFM-044) ----------

export type RegelInGroep = Pick<Offerteregel, 'id' | 'aantalHonderdsten' | 'prijsCent' | 'onderdeelVan'>;

export interface Regelgroep<R> {
  regel: R;
  /** Materialen en opties onder deze regel, in hun volgorde; leeg bij een gewone regel. */
  subregels: R[];
  /** Regelbedrag plus alle subregels, in centen. */
  subtotaalCent: number;
}

/**
 * Regels gegroepeerd per werkzaamheid: elke regel zonder (geldige) `onderdeelVan` begint een groep; de
 * regels die ernaar verwijzen komen eronder, ook als ze elders in de lijst staan. Een subregel waarvan
 * de hoofdregel ontbreekt of zelf een subregel is, wordt een gewone regel, zodat er nooit iets wegvalt.
 */
export function groepeerRegels<R extends RegelInGroep>(regels: readonly R[]): Regelgroep<R>[] {
  const hoofdIds = new Set(regels.filter((r) => !r.onderdeelVan).map((r) => r.id));
  const isSub = (r: R) => !!r.onderdeelVan && hoofdIds.has(r.onderdeelVan);
  return regels
    .filter((r) => !isSub(r))
    .map((regel) => {
      const subregels = regels.filter((r) => isSub(r) && r.onderdeelVan === regel.id);
      const subtotaalCent = [regel, ...subregels].reduce((som, r) => som + regelbedragCent(r), 0);
      return { regel, subregels, subtotaalCent };
    });
}

export interface WerkzaamheidVoorBedrag {
  aantal: number;
  prijsCent: number | null;
  materialen: readonly { aantal: number; prijsCent: number | null }[];
  opties: readonly { prijsCent: number | null }[];
}

/**
 * Bedrag van één werkzaamheid in de wizard (excl. btw): aantal × prijs, plus elk materiaal (aantal ×
 * prijs) en elke optie (één keer de prijs). Zonder prijs telt een onderdeel als 0.
 */
export function bedragWerkzaamheidCent(w: WerkzaamheidVoorBedrag): number {
  const bedrag = (aantal: number, prijsCent: number | null) =>
    regelbedragCent({ aantalHonderdsten: aantalNaarHonderdsten(aantal), prijsCent: prijsCent ?? 0 });
  return (
    bedrag(w.aantal, w.prijsCent) +
    w.materialen.reduce((som, m) => som + bedrag(m.aantal, m.prijsCent), 0) +
    w.opties.reduce((som, o) => som + bedrag(1, o.prijsCent), 0)
  );
}
