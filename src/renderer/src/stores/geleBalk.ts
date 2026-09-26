import { create } from 'zustand';
import { useNavigatie } from './navigatie';

// Inklapbare gele balk op het detailscherm (OFM-036, FO UC-06, V-05). De keuze uit- of ingeklapt
// geldt zolang de offerte open is: ook na Aanpassen of Laat Claude aanpassen en terug. Zodra een
// andere offerte (of geen) open is, vervalt hij. Bewust niet in browseropslag.

/** Tot en met zoveel punten staat de balk standaard uitgeklapt; daarboven samengevouwen. */
export const UITGEKLAPT_TOT_EN_MET = 3;

interface Keuze {
  offerteId: string;
  uitgeklapt: boolean;
}

interface GeleBalkState {
  keuze: Keuze | null;
  zet: (offerteId: string, uitgeklapt: boolean) => void;
}

export const useGeleBalk = create<GeleBalkState>()((set) => ({
  keuze: null,
  zet: (offerteId, uitgeklapt) => set({ keuze: { offerteId, uitgeklapt } }),
}));

/** De gemaakte keuze voor deze offerte, anders de standaard: uitgeklapt bij 1–3 punten. */
export function isUitgeklapt(keuze: Keuze | null, offerteId: string, aantalPunten: number): boolean {
  if (keuze?.offerteId === offerteId) return keuze.uitgeklapt;
  return aantalPunten <= UITGEKLAPT_TOT_EN_MET;
}

// Offerte gesloten of een andere geopend: de keuze vervalt.
useNavigatie.subscribe((navigatie) => {
  const { keuze } = useGeleBalk.getState();
  if (keuze && navigatie.offerteId !== keuze.offerteId) useGeleBalk.setState({ keuze: null });
});
