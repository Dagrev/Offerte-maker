import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Werkzaamheden, opties en materialen (OFM-043). Bewaren en herstellen invalideren ook de prijslijst
// (elk item heeft een prijspost). Sinds OFM-048 gaan ook de uurprijs en de btw via `werkzaamheden:bewaar`.

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
      uurprijsCent: w.uurprijsCent,
      btwTarief: w.btwTarief,
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
      // OFM-055: vinkje en situaties; main laat materialen vallen die niet (meer) kiesbaar zijn of passen.
      perSituatie: w.perSituatie,
      situaties: w.situaties,
    })),
    materialen: set.materialen.map(
      ({ id, label, eenheid, prijsCent, btwTarief, verborgen, tags, categorieId }) => ({
        id,
        label: label.trim(),
        eenheid,
        prijsCent,
        btwTarief,
        verborgen,
        tags,
        // OFM-057
        categorieId,
      }),
    ),
    categorieen: set.categorieen.map(({ id, naam }) => ({ id, naam: naam.trim() })),
  };
}

// OFM-056: twee tabs (Materialen en prijzen, Werkzaamheden) bewaren elk de hele set. Bij het wisselen van
// tab gaat een wachtende wijziging van de oude tab pas weg als de nieuwe al opent; die mag dan niet met de
// set van vóór die wijziging beginnen. `useWerkzaamhedenBezig` telt de wachtende wijzigingen (nog niet
// bewaard, `meldWachtend`) en de lopende bewaaracties (tot en met het verversen van de query), zodat een
// tab pas begint als de set vers is.
let lopend = 0;
const wachtend = new Set<symbol>();
const luisteraars = new Set<() => void>();
const meld = () => {
  for (const l of luisteraars) l();
};
function zetLopend(delta: number): void {
  lopend += delta;
  meld();
}
/** Een bewerker heeft een wijziging die nog niet bewaard is (`aan`), of niet meer. */
export function meldWachtend(bewerker: symbol, aan: boolean): void {
  if (aan === wachtend.has(bewerker)) return;
  if (aan) wachtend.add(bewerker);
  else wachtend.delete(bewerker);
  meld();
}
const abonneer = (l: () => void) => {
  luisteraars.add(l);
  return () => {
    luisteraars.delete(l);
  };
};

/** Aantal wachtende wijzigingen en lopende bewaaracties van de set (inclusief het verversen van de query). */
export function useWerkzaamhedenBezig(): number {
  return useSyncExternalStore(abonneer, () => lopend + wachtend.size);
}

/** De hele set in de nieuwe volgorde; een onbekende id is nieuw, ontbrekende items worden verwijderd. */
export async function bewaarWerkzaamheden(set: WerkzaamhedenBewaar): Promise<WerkzaamhedenSet> {
  zetLopend(1);
  try {
    const uit = await roep(window.api.werkzaamhedenBewaar(set));
    await naWijziging();
    return uit;
  } finally {
    zetLopend(-1);
  }
}

export async function herstelWerkzaamheden(): Promise<void> {
  await roep(window.api.werkzaamhedenHerstel());
  await naWijziging();
}
