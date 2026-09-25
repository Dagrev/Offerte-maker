import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KanaalInvoer } from '@shared/types';
import { queryKeys } from './queryKeys';
import { roep } from './roep';

// Hooks voor één offerte (OFM-010). `offerte:nieuw` vanaf het hoofdscherm staat in `api/overzicht.ts`
// (OFM-009). Latere tickets (OFM-013/014/016/017) voegen hier hun mutaties toe.

/** `offerte:haal`. Met `vers` wordt bij elk openen van het scherm opnieuw opgehaald (wizard). */
export function useOfferte(id: string | undefined, opties: { vers?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.offerte(id ?? ''),
    queryFn: () => roep(window.api.offerteHaal({ id: id ?? '' })),
    enabled: id !== undefined,
    refetchOnMount: opties.vers ? 'always' : true,
  });
}

export type InvoerDeel = Omit<KanaalInvoer<'offerte:bewaarInvoer'>, 'id'>;

const DEBOUNCE_MS = 500;

/**
 * Automatisch bewaren van de wizardinvoer (FE-025, NFE-011). `plan(deel)` voegt een wijziging toe en
 * bewaart na 500 ms zonder nieuwe wijziging; `nu()` bewaart direct (stapwissel, verlaten). Bij het
 * ontkoppelen van het scherm wordt wat nog openstaat ook direct bewaard.
 * `signaal` telt de geslaagde bewaaracties (voor `BewaardIndicator`); `fout` is de laatste fout.
 */
export function useAutoBewaarInvoer(id: string) {
  const queryClient = useQueryClient();
  const open = useRef<InvoerDeel>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bezig = useRef<Promise<void>>(Promise.resolve());
  const [signaal, setSignaal] = useState(0);
  const [fout, setFout] = useState<unknown>(null);
  const actief = useRef(true);

  const nu = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const deel = open.current;
    open.current = {};
    if (Object.keys(deel).length === 0) return bezig.current;
    // Achter elkaar bewaren, zodat een oudere wijziging nooit een nieuwere overschrijft.
    bezig.current = bezig.current.then(async () => {
      try {
        await roep(window.api.offerteBewaarInvoer({ id, ...deel }));
        void queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() });
        if (actief.current) {
          setSignaal((s) => s + 1);
          setFout(null);
        }
      } catch (e) {
        if (actief.current) setFout(e);
      }
    });
    return bezig.current;
  }, [id, queryClient]);

  const plan = useCallback(
    (deel: InvoerDeel) => {
      open.current = { ...open.current, ...deel };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void nu(), DEBOUNCE_MS);
    },
    [nu],
  );

  useEffect(() => {
    actief.current = true;
    const bijSluiten = () => void nu();
    window.addEventListener('beforeunload', bijSluiten);
    return () => {
      actief.current = false;
      window.removeEventListener('beforeunload', bijSluiten);
      // Verlaten van de wizard: openstaande invoer direct bewaren en de offerte opnieuw laten ophalen.
      void nu().then(() => queryClient.invalidateQueries({ queryKey: queryKeys.offerte(id) }));
    };
  }, [id, nu, queryClient]);

  return { plan, nu, signaal, fout };
}
