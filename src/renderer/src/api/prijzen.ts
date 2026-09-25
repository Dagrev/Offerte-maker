import { useQuery } from '@tanstack/react-query';
import type { Prijspost } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Prijslijst (OFM-018, FE-074). Bewaren en verwijderen invalideren `['prijzen']`.

export function usePrijzen() {
  return useQuery({
    queryKey: queryKeys.prijzen(),
    queryFn: () => roep(window.api.prijzenLijst()),
  });
}

/** Lege `id` = nieuwe post (achteraan, V-15). Gewone functie: ook na verlaten van de tab bruikbaar. */
export async function bewaarPrijspost(post: Prijspost): Promise<{ id: string }> {
  const uit = await roep(window.api.prijzenBewaar(post));
  await queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() });
  return uit;
}

export async function verwijderPrijspost(id: string): Promise<void> {
  await roep(window.api.prijzenVerwijder({ id }));
  await queryClient.invalidateQueries({ queryKey: queryKeys.prijzen() });
}
