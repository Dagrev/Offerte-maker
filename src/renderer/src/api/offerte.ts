import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KanaalInvoer, OfferteInhoud } from '@shared/types';
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

/**
 * `offerte:voorbeeldHtml` (OFM-014). De key hangt onder `['offerte', id]`, zodat elke mutatie die de
 * offerte invalideert ook het voorbeeld ververst. Bij elk openen opnieuw: de opmaak kan intussen
 * in de instellingen zijn gewijzigd.
 */
export function useVoorbeeldHtml(id: string | undefined, actief = true) {
  return useQuery({
    queryKey: [...queryKeys.offerte(id ?? ''), 'voorbeeld'],
    queryFn: () => roep(window.api.offerteVoorbeeldHtml({ id: id ?? '' })),
    enabled: id !== undefined && actief,
    refetchOnMount: 'always',
  });
}

/** `offerte:bewaarInhoud` (OFM-014): ingevulde inhoud; main zet hem terug naar plaatshouders. */
export function useBewaarInhoud(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inhoud: OfferteInhoud) => roep(window.api.offerteBewaarInhoud({ id, inhoud })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offerte(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
      ]),
  });
}

/** `offerte:maakDefinitief` (OFM-015): nummer en PDF; daarna offerte en lijst opnieuw ophalen. */
export function useMaakDefinitief(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => roep(window.api.offerteMaakDefinitief({ id })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offerte(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
      ]),
  });
}

/** Open PDF, Afdrukken en Toon in map (OFM-015, FE-057): geen data, alleen een eventuele fout. */
export function usePdfActie(id: string) {
  return useMutation({
    mutationFn: (actie: 'open' | 'afdrukken' | 'map') => {
      const aanroep = {
        open: window.api.offerteOpenPdf,
        afdrukken: window.api.offerteAfdrukken,
        map: window.api.offerteToonInMap,
      }[actie];
      return roep(aanroep({ id }));
    },
  });
}

/**
 * `offerte:mail` (OFM-041): concept in het mailprogramma. Kan lang duren: bij Outlook wacht main tot
 * het mailvenster dicht is.
 */
export function useMailOfferte(id: string) {
  return useMutation({ mutationFn: () => roep(window.api.offerteMail({ id })) });
}

/** Query-key van de prullenbak (OFM-016); los van `queryKeys` (OFM-008), dat niet meer wijzigt. */
export const PRULLENBAK_KEY = ['prullenbak'] as const;

/** Offerte en lijsten opnieuw ophalen na een beheeractie (OFM-016). */
function useVerversOfferte(id: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.offerte(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
      queryClient.invalidateQueries({ queryKey: PRULLENBAK_KEY }),
    ]);
}

/** `offerte:zetVersieTerug` (OFM-017, FE-053): nieuwe versie met de inhoud van de gekozen versie. */
export function useZetVersieTerug(id: string) {
  const ververs = useVerversOfferte(id);
  return useMutation({
    mutationFn: (versieId: string) => roep(window.api.offerteZetVersieTerug({ id, versieId })),
    onSuccess: ververs,
  });
}

/** `offerte:zetStatus` (OFM-016, FE-060): direct bewaard. */
export function useZetStatus(id: string) {
  const ververs = useVerversOfferte(id);
  return useMutation({
    mutationFn: (status: KanaalInvoer<'offerte:zetStatus'>['status']) =>
      roep(window.api.offerteZetStatus({ id, status })),
    onSuccess: ververs,
  });
}

/** `offerte:nieuw` met `bronId` (OFM-016, FE-061, V-21): kopie voor dezelfde of een andere klant. */
export function useMaakKopie(bronId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zelfdeKlant: boolean) => roep(window.api.offerteNieuw({ bronId, zelfdeKlant })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
  });
}

/** `offerte:verwijder` (OFM-016, FE-062): naar de prullenbak. */
export function useVerwijderOfferte(id: string) {
  const ververs = useVerversOfferte(id);
  return useMutation({
    mutationFn: () => roep(window.api.offerteVerwijder({ id })),
    onSuccess: ververs,
  });
}

/** `prullenbak:lijst` (OFM-016). */
export function usePrullenbak() {
  return useQuery({
    queryKey: PRULLENBAK_KEY,
    queryFn: () => roep(window.api.prullenbakLijst()),
    refetchOnMount: 'always',
  });
}

/** `offerte:zetTerug` (OFM-016): uit de prullenbak. */
export function useZetTerug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => roep(window.api.offerteZetTerug({ id })),
    onSuccess: (_data, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.offerte(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overzicht() }),
        queryClient.invalidateQueries({ queryKey: PRULLENBAK_KEY }),
      ]),
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
