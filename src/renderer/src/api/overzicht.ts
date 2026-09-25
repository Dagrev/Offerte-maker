import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Weergave } from '../stores/navigatie';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Hooks van het hoofdscherm (OFM-009). Alle keys beginnen met `['overzicht']`, zodat mutaties uit
// andere tickets (nieuw, bewaren, status, verwijderen) met `queryKeys.overzicht()` alles verversen.

/** `overzicht:lijst` voor de periode rond `datum`. Houdt de vorige lijst vast tijdens het laden. */
export function useOverzicht(weergave: Weergave, datum: string) {
  return useQuery({
    queryKey: [...queryKeys.overzicht(), 'lijst', weergave, datum],
    queryFn: () => roep(window.api.overzichtLijst({ weergave, datum })),
    placeholderData: keepPreviousData,
  });
}

/** `overzicht:zoek`; alleen actief bij 1–100 tekens. */
export function useZoekOffertes(tekst: string) {
  return useQuery({
    queryKey: [...queryKeys.overzicht(), 'zoek', tekst],
    queryFn: () => roep(window.api.overzichtZoek({ tekst })),
    enabled: tekst.length >= 1 && tekst.length <= 100,
    placeholderData: keepPreviousData,
  });
}

/** `offerte:nieuw` vanaf het hoofdscherm; geeft `{ id }` terug (kanaal van OFM-010). */
export function useNieuweOfferte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => roep(window.api.offerteNieuw({})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
  });
}
