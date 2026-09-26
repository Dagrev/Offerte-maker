import type { WerkzaamhedenSet } from '@shared/types';

// Pure hulpfuncties voor de tabs Materialen en prijzen en Werkzaamheden (OFM-056): alfabetisch sorteren,
// zoeken en de stabiele namen. De repository levert in opslagvolgorde; sorteren gebeurt hier.

type MetNaam = { id: string; label: string };

/** Nederlandse vergelijking zonder hoofdlettergevoeligheid ("appel" vóór "Beton", "é" als "e"). */
export const vergelijkNaam = (a: string, b: string): number =>
  a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true });

/**
 * Items alfabetisch op naam. De naam komt uit `namen` (de namen zoals bij het openen van de tab), zodat
 * een item niet verspringt terwijl je zijn naam typt; een item dat daar niet in staat, sorteert op zijn
 * huidige naam. Bij gelijke namen blijft de opslagvolgorde.
 */
export function sorteerOpNaam<T extends MetNaam>(items: readonly T[], namen: readonly MetNaam[] = []): T[] {
  const naam = (item: T) => namen.find((n) => n.id === item.id)?.label ?? item.label;
  return [...items].sort((a, b) => vergelijkNaam(naam(a), naam(b)));
}

/** Zoeken op (een deel van) de naam, zonder hoofdletters en spaties aan de randen; leeg = alles. */
export function zoekOpNaam<T extends MetNaam>(items: readonly T[], zoekterm: string): T[] {
  const term = zoekterm.trim().toLocaleLowerCase('nl');
  if (term === '') return [...items];
  return items.filter((item) => item.label.toLocaleLowerCase('nl').includes(term));
}

/** Labels zoals bij het openen van de tab, aangevuld met nieuwe items (voor stabiele namen). */
export function beginSetLabels(begin: readonly MetNaam[], nu: readonly MetNaam[]): MetNaam[] {
  return [...begin, ...nu.filter((n) => !begin.some((b) => b.id === n.id))];
}

/** Naam voor labels en koppen: de bewaarde naam, anders de huidige, anders `terugval`. */
export function naamVan(item: MetNaam, bewaard: readonly MetNaam[], terugval: string): string {
  return bewaard.find((b) => b.id === item.id)?.label ?? (item.label.trim() || terugval);
}

/** Alleen bewaren als alles een naam heeft (een lege naam is een tussenstand). */
export const allesBenoemd = (set: WerkzaamhedenSet): boolean =>
  [...set.werkzaamheden, ...set.werkzaamheden.flatMap((w) => w.opties), ...set.materialen].every(
    (i) => i.label.trim() !== '',
  );
