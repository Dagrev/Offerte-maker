import { useQuery } from '@tanstack/react-query';
import type { WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Werkzaamheden, opties en materialen (OFM-043). Bewaren en herstellen invalideren ook de prijslijst
// (elk item heeft een prijspost).

export function useWerkzaamheden() {
  return useQuery({
    queryKey: queryKeys.werkzaamheden(),
    queryFn: () => roep(window.api.werkzaamhedenHaal()),
  });
}

async function naWijziging(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.werkzaamheden() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() }),
  ]);
}

/**
 * De set (uitvoer van `werkzaamheden:haal`) als invoer voor `werkzaamheden:bewaar`. Met `soorten` vallen
 * koppelingen met een net verwijderde soort werk weg (de database doet dat ook).
 */
export function alsBewaarInvoer(set: WerkzaamhedenSet, soorten?: ReadonlySet<string>): WerkzaamhedenBewaar {
  return {
    werkzaamheden: set.werkzaamheden.map((w) => ({
      id: w.id,
      label: w.label.trim(),
      eenheid: w.eenheid,
      prijsCent: w.prijsCent,
      verborgen: w.verborgen,
      soortenWerk: soorten ? w.soortenWerk.filter((s) => soorten.has(s)) : w.soortenWerk,
      opties: w.opties.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
        id,
        label: label.trim(),
        eenheid,
        prijsCent,
        verborgen,
      })),
      materialen: w.materialen,
    })),
    materialen: set.materialen.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
      id,
      label: label.trim(),
      eenheid,
      prijsCent,
      verborgen,
    })),
  };
}

/** De hele set in de nieuwe volgorde; een onbekende id is nieuw, ontbrekende items worden verwijderd. */
export async function bewaarWerkzaamheden(set: WerkzaamhedenBewaar): Promise<WerkzaamhedenSet> {
  const uit = await roep(window.api.werkzaamhedenBewaar(set));
  await naWijziging();
  return uit;
}

export async function herstelWerkzaamheden(): Promise<void> {
  await roep(window.api.werkzaamhedenHerstel());
  await naWijziging();
}

/**
 * Na een wijziging elders (prijs in de tab Prijzen, soort werk in Keuzelijsten): de werkzaamheden
 * opnieuw laden bij het volgende openen, zodat de tab nooit met oude prijzen begint en ze terugschrijft.
 */
export function vergeetWerkzaamheden(): void {
  queryClient.removeQueries({ queryKey: queryKeys.werkzaamheden() });
}
