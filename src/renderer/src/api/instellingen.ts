import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Api, Opmaak } from '@shared/types';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Hooks voor Instellingen (OFM-018). Alle keys beginnen met `['instellingen']`; bewaren invalideert
// die, zodat ook het opmaakvoorbeeld (echte bedrijfsgegevens, V-22) opnieuw wordt opgehaald.

export type InstellingBewaarInvoer = Parameters<Api['instellingenBewaar']>[0];

/** `instellingen:haal` (V-15). */
export function useInstellingen() {
  return useQuery({
    queryKey: queryKeys.instellingen(),
    queryFn: () => roep(window.api.instellingenHaal()),
  });
}

/**
 * Bewaart één instellingssleutel en ververst de instellingen. Een gewone functie (geen hook), zodat
 * een veld ook na het wisselen van tab nog kan bewaren (FE-075: bewaren bij verlaten).
 */
export async function bewaarInstelling(invoer: InstellingBewaarInvoer): Promise<void> {
  await roep(window.api.instellingenBewaar(invoer));
  await queryClient.invalidateQueries({ queryKey: queryKeys.instellingen() });
}

/** `instellingen:kiesLogo` en `instellingen:verwijderLogo`. */
export function useLogo() {
  const client = useQueryClient();
  const ververs = () => client.invalidateQueries({ queryKey: queryKeys.instellingen() });
  const kies = useMutation({
    mutationFn: () => roep(window.api.instellingenKiesLogo()),
    onSuccess: ververs,
  });
  const verwijder = useMutation({
    mutationFn: () => roep(window.api.instellingenVerwijderLogo()),
    onSuccess: ververs,
  });
  return { kies, verwijder };
}

/** `instellingen:opmaakVoorbeeld` (§12.5); debouncen doet de aanroeper (300 ms, FE-072). */
export function useOpmaakVoorbeeld(opmaak: Opmaak | null) {
  return useQuery({
    queryKey: [...queryKeys.instellingen(), 'opmaakVoorbeeld', opmaak],
    queryFn: () => roep(window.api.instellingenOpmaakVoorbeeld({ opmaak: opmaak! })),
    enabled: opmaak !== null,
    placeholderData: keepPreviousData,
  });
}
