import { create } from 'zustand';
import type { Ordening, Status } from '@shared/types';

// Filter op status en ordening van het hoofdscherm (OFM-053, FO UC-02/UC-03). Geldt voor de
// periodelijst én de zoekresultaten en blijft staan zolang de app open is (ook na een periodewissel of
// een bezoek aan een offerte). Bewust niet opgeslagen: bij een volgende start leeg en op datum.
// Los van `navigatie.ts` gehouden, zodat die store klein blijft.

/** De statussen in de volgorde van de filterknoppen (= volgorde van de levenscyclus). */
export const FILTER_STATUSSEN: readonly Status[] = ['concept', 'klaar', 'verstuurd', 'akkoord', 'afgewezen'];
export const ORDENINGEN: readonly Ordening[] = ['datum', 'nummer_op', 'nummer_af'];

interface OverzichtFilterState {
  /** Aangevinkte statussen in knopvolgorde; leeg = alle. */
  statussen: Status[];
  ordening: Ordening;
  wisselStatus: (status: Status) => void;
  wisStatussen: () => void;
  zetOrdening: (ordening: Ordening) => void;
}

export const useOverzichtFilter = create<OverzichtFilterState>()((set) => ({
  statussen: [],
  ordening: 'datum',
  wisselStatus: (status) =>
    set((s) => ({
      statussen: s.statussen.includes(status)
        ? s.statussen.filter((x) => x !== status)
        : FILTER_STATUSSEN.filter((x) => x === status || s.statussen.includes(x)),
    })),
  wisStatussen: () => set({ statussen: [] }),
  zetOrdening: (ordening) => set({ ordening }),
}));
