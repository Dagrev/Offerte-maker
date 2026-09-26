import { useQuery } from '@tanstack/react-query';
import type { KeuzeLijst, Keuzeoptie } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Keuzelijsten van de wizard (OFM-034). Bewaren en herstellen invalideren ook het overzicht (de korte
// omschrijving volgt een nieuwe naam) en de prijslijst (een nieuwe optie krijgt een prijspost).

export function useKeuzelijsten() {
  return useQuery({
    queryKey: queryKeys.keuzelijsten(),
    queryFn: () => roep(window.api.keuzelijstenHaal()),
  });
}

async function naWijziging(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.keuzelijsten() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() }),
    // De soorten werk staan ook in `werkzaamheden:haal` (OFM-043).
    queryClient.invalidateQueries({ queryKey: queryKeys.werkzaamheden() }),
  ]);
}

export interface OptieInvoer {
  /** Leeg = nieuwe optie. */
  id: string;
  label: string;
  verborgen: boolean;
  /** OFM-049: hoogstens één per lijst. */
  standaardkeuze: boolean;
  /** OFM-050: "Zin in de offerte"; weglaten = niet wijzigen. */
  zin?: string;
  /** OFM-050: alleen bij soort werk; weglaten = niet wijzigen. */
  vraagtBedekking?: boolean;
}

/** De hele lijst in de nieuwe volgorde; ontbrekende opties worden verwijderd. Geeft de bewaarde lijst. */
export async function bewaarKeuzelijst(lijst: KeuzeLijst, opties: OptieInvoer[]): Promise<Keuzeoptie[]> {
  const uit = await roep(window.api.keuzelijstenBewaar({ lijst, opties }));
  await naWijziging();
  return uit;
}

export async function herstelKeuzelijst(lijst: KeuzeLijst): Promise<void> {
  await roep(window.api.keuzelijstenHerstel({ lijst }));
  await naWijziging();
}
