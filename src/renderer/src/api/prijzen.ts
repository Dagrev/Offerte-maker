import { useQuery } from '@tanstack/react-query';
import type { Prijspost } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';
import { vergeetWerkzaamheden } from './werkzaamheden';

// Prijslijst (OFM-018, FE-074). Bewaren en verwijderen invalideren `['prijzen']`; de werkzaamheden
// (OFM-043) lezen hun prijzen hieruit en worden bij het volgende openen opnieuw geladen.

export function usePrijzen() {
  return useQuery({
    queryKey: queryKeys.prijzen(),
    queryFn: () => roep(window.api.prijzenLijst()),
  });
}

/** Lege `id` = nieuwe post (achteraan, V-15). Gewone functie: ook na verlaten van de tab bruikbaar. */
export async function bewaarPrijspost(post: Prijspost): Promise<{ id: string }> {
  const uit = await roep(window.api.prijzenBewaar(post));
  vergeetWerkzaamheden();
  await queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() });
  return uit;
}

export async function verwijderPrijspost(id: string): Promise<void> {
  await roep(window.api.prijzenVerwijder({ id }));
  vergeetWerkzaamheden();
  await queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() });
}
