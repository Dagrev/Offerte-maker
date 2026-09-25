import { useQuery } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Voorbeeldoffertes (OFM-019, FE-080 t/m 083, FE-085). Alle keys beginnen met `['voorbeelden']`;
// elke mutatie invalideert die, dus ook de open review ververst. Gewone functies (geen
// `useMutation`), zodat de tab ook buiten Instellingen (welkomstscherm, OFM-023) werkt.

export function useVoorbeelden() {
  return useQuery({
    queryKey: queryKeys.voorbeelden(),
    queryFn: () => roep(window.api.voorbeeldenLijst()),
  });
}

export function useVoorbeeld(id: string) {
  return useQuery({
    queryKey: [...queryKeys.voorbeelden(), id],
    queryFn: () => roep(window.api.voorbeeldenHaal({ id })),
  });
}

/** Voert een mutatie uit en ververst daarna altijd `['voorbeelden']`, ook bij een fout. */
async function metVerversen<T>(aanroep: Promise<T>): Promise<T> {
  try {
    return await aanroep;
  } finally {
    await queryClient.invalidateQueries({ queryKey: queryKeys.voorbeelden() });
  }
}

/** Zonder paden opent main de bestandsdialoog; met paden (slepen) worden die toegevoegd. */
export function voegVoorbeeldenToe(paden?: string[]) {
  return metVerversen(roep(window.api.voorbeeldenVoegToe(paden ? { paden } : {})));
}

export function maakOnleesbaar(id: string, fragment: string) {
  return metVerversen(roep(window.api.voorbeeldenMaakOnleesbaar({ id, fragment })));
}

export function keurVoorbeeldGoed(id: string) {
  return metVerversen(roep(window.api.voorbeeldenKeurGoed({ id })));
}

/** `null` haalt de templatemarkering weg. */
export function zetTemplate(id: string | null) {
  return metVerversen(roep(window.api.voorbeeldenZetTemplate({ id })));
}

export function verwijderVoorbeeld(id: string) {
  return metVerversen(roep(window.api.voorbeeldenVerwijder({ id })));
}
