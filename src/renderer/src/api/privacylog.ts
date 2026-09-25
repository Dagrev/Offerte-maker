import { useMutation, useQuery } from '@tanstack/react-query';
import { roep } from './roep';

// Privacylog en tab Over (OFM-021). Eigen query-key; de lijst wordt bij elk openen van de tab
// opnieuw opgehaald, want er komen regels bij zonder mutatie in deze tab.

export const privacylogKey = ['privacylog'] as const;

/** `privacylog:lijst`: zonder opdracht- en antwoordtekst. */
export function usePrivacylogLijst() {
  return useQuery({
    queryKey: [...privacylogKey, 'lijst'],
    queryFn: () => roep(window.api.privacylogLijst()),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** `privacylog:haal`: de volledige tekst, pas bij het openen van een regel. */
export function usePrivacylogRegel(id: string) {
  return useQuery({
    queryKey: [...privacylogKey, 'regel', id],
    queryFn: () => roep(window.api.privacylogHaal({ id })),
  });
}

/** `app:openMap` (V-17): alleen 'log' of 'offertes'. */
export function useOpenMap() {
  return useMutation({
    mutationFn: (welke: 'log' | 'offertes') => roep(window.api.appOpenMap({ welke })),
  });
}
