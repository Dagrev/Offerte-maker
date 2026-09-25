// Tekst van een voorbeeld opdelen in gewone stukken en plaatshouders, zodat de review
// `[VERWIJDERD]` en `[BEDRIJF]` als zwarte balkjes kan tonen (TDO §13.4, FE-082). Eigenaar: OFM-019.

export type RedactieSoort = 'verwijderd' | 'bedrijf';

export interface TekstDeel {
  tekst: string;
  redactie: RedactieSoort | null;
}

const PLAATSHOUDER = /(\[VERWIJDERD\]|\[BEDRIJF\])/;

export function splitsRedacties(tekst: string): TekstDeel[] {
  return tekst
    .split(PLAATSHOUDER)
    .filter((deel) => deel !== '')
    .map((deel) => ({
      tekst: deel,
      redactie: deel === '[VERWIJDERD]' ? 'verwijderd' : deel === '[BEDRIJF]' ? 'bedrijf' : null,
    }));
}

/** Grenzen van een fragment voor **Onleesbaar maken** (§6.2: 2–200 tekens). */
export const FRAGMENT_MIN = 2;
export const FRAGMENT_MAX = 200;

export type Selectie = { soort: 'geen' } | { soort: 'teLang' } | { soort: 'ok'; fragment: string };

/** Wat de review met de geselecteerde tekst kan: niets, een melding "te lang", of het fragment. */
export function beoordeelSelectie(selectie: string): Selectie {
  const fragment = selectie.trim();
  if (fragment.length < FRAGMENT_MIN) return { soort: 'geen' };
  if (fragment.length > FRAGMENT_MAX) return { soort: 'teLang' };
  return { soort: 'ok', fragment };
}
