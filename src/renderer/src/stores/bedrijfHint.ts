import { create } from 'zustand';

// Hint "Vul je bedrijfsgegevens in" op het hoofdscherm (OFM-029). Wegklikken geldt alleen voor deze
// start: geen browseropslag in de renderer voor status (TDO §13.1), dus bij een volgende start komt
// de hint terug zolang de bedrijfsnaam leeg is.

interface BedrijfHintState {
  verborgen: boolean;
  verberg: () => void;
}

export const useBedrijfHint = create<BedrijfHintState>()((set) => ({
  verborgen: false,
  verberg: () => set({ verborgen: true }),
}));
