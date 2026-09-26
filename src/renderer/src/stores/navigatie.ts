import { create } from 'zustand';
import type { Fout } from '@shared/fouten';

// Navigatie zonder router (TDO §13.1, V-03, V-07). Deze store is compleet; latere tickets wijzigen
// hem niet, ze roepen alleen `gaNaar`, `bezigKlaar` en `zetPeriode` aan.

export type Scherm =
  'welkom' | 'overzicht' | 'wizard' | 'bezig' | 'detail' | 'bewerken' | 'instellingen' | 'prullenbak';

/** Tabs van Instellingen (§13.4); de laatste vier staan onder Geavanceerd (OFM-018). */
export type InstellingenTab =
  | 'bedrijf'
  | 'opmaak'
  | 'teksten'
  | 'prijzen'
  | 'keuzelijsten'
  | 'werkzaamheden'
  | 'voorbeelden'
  | 'claudeKoppeling'
  | 'privacylog'
  | 'backups'
  | 'over';

export type Weergave = 'dag' | 'week' | 'maand' | 'jaar';

export type WizardStap = 1 | 2 | 3 | 4;

/** Waar het Bezig-scherm voor draait en waar het na een fout naartoe gaat (V-07). */
export interface Bezig {
  /** Offerte-ID, of `'template_teksten'` (V-08). */
  id: string;
  soort: 'maken' | 'aanpassen' | 'zonder_claude' | 'template_teksten';
  terugNaar: 'wizard' | 'detail' | 'instellingen';
}

/** Een navigatiedoel. `fout` toont het doelscherm bovenaan als `Foutmelding` (V-07). */
export type Doel =
  | { scherm: 'welkom' }
  | { scherm: 'overzicht' }
  | { scherm: 'wizard'; offerteId: string; wizardStap?: WizardStap; fout?: Fout }
  | { scherm: 'bezig'; bezig: Bezig }
  | { scherm: 'detail'; offerteId: string; fout?: Fout }
  | { scherm: 'bewerken'; offerteId: string }
  | { scherm: 'instellingen'; instellingenTab?: InstellingenTab; fout?: Fout }
  | { scherm: 'prullenbak' };

export interface NavigatieState {
  /** `false` tot `start()` is aangeroepen met de gegevens uit `app:info`. */
  gestart: boolean;
  scherm: Scherm;
  offerteId?: string;
  instellingenTab?: InstellingenTab;
  wizardStap?: WizardStap;
  bezig?: Bezig;
  /** Fout die het huidige scherm bovenaan toont; verdwijnt bij de volgende navigatie. */
  fout?: Fout;

  /** "Vandaag" volgens main (`app:info.vandaag`, V-10); nooit `new Date()` in de renderer. */
  vandaag: string;
  /** Weergave en datum van het overzicht; blijven tijdens de sessie behouden (§13.4). */
  weergave: Weergave;
  datum: string;

  /** Eenmalig bij het opstarten (App.tsx): beginscherm en startdatum zetten (V-10, V-27). */
  start: (info: { vandaag: string; welkomVoltooid: boolean }) => void;
  gaNaar: (doel: Doel) => void;
  /** Het Bezig-scherm is klaar: naar het vervolgscherm (V-07). Zonder `fout` = gelukt. */
  bezigKlaar: (fout?: Fout) => void;
  zetPeriode: (periode: { weergave?: Weergave; datum?: string }) => void;
  wisFout: () => void;
}

/** Vervolg na het Bezig-scherm (V-07). */
export function doelNaBezig(bezig: Bezig, fout?: Fout): Doel {
  if (bezig.soort === 'template_teksten') {
    return { scherm: 'instellingen', instellingenTab: 'voorbeelden', ...(fout && { fout }) };
  }
  if (!fout) return { scherm: 'detail', offerteId: bezig.id };
  switch (bezig.terugNaar) {
    case 'wizard':
      return { scherm: 'wizard', offerteId: bezig.id, wizardStap: 4, fout };
    case 'detail':
      return { scherm: 'detail', offerteId: bezig.id, fout };
    case 'instellingen':
      return { scherm: 'instellingen', instellingenTab: 'voorbeelden', fout };
  }
}

/** Zet een doel om in de schermvelden van de store; niet-genoemde velden worden gewist. */
function schermVelden(
  doel: Doel,
): Pick<NavigatieState, 'scherm' | 'offerteId' | 'instellingenTab' | 'wizardStap' | 'bezig' | 'fout'> {
  const leeg = {
    offerteId: undefined,
    instellingenTab: undefined,
    wizardStap: undefined,
    bezig: undefined,
    fout: undefined,
  };
  switch (doel.scherm) {
    case 'wizard':
      return {
        ...leeg,
        scherm: 'wizard',
        offerteId: doel.offerteId,
        wizardStap: doel.wizardStap,
        fout: doel.fout,
      };
    case 'bezig':
      return { ...leeg, scherm: 'bezig', offerteId: doel.bezig.id, bezig: doel.bezig };
    case 'detail':
      return { ...leeg, scherm: 'detail', offerteId: doel.offerteId, fout: doel.fout };
    case 'bewerken':
      return { ...leeg, scherm: 'bewerken', offerteId: doel.offerteId };
    case 'instellingen':
      return { ...leeg, scherm: 'instellingen', instellingenTab: doel.instellingenTab, fout: doel.fout };
    default:
      return { ...leeg, scherm: doel.scherm };
  }
}

export const useNavigatie = create<NavigatieState>()((set, get) => ({
  gestart: false,
  // Tot `start()` staat de store op het overzicht; App.tsx toont dan nog een laadscherm.
  scherm: 'overzicht',
  vandaag: '',
  weergave: 'maand', // FO UC-02: standaard Maand op de huidige maand
  datum: '',

  start: ({ vandaag, welkomVoltooid }) =>
    set({
      ...schermVelden({ scherm: welkomVoltooid ? 'overzicht' : 'welkom' }),
      gestart: true,
      vandaag,
      datum: vandaag,
    }),

  gaNaar: (doel) => set(schermVelden(doel)),

  bezigKlaar: (fout) => {
    const { bezig } = get();
    if (!bezig) return;
    set(schermVelden(doelNaBezig(bezig, fout)));
  },

  zetPeriode: ({ weergave, datum }) =>
    set((s) => ({ weergave: weergave ?? s.weergave, datum: datum ?? s.datum })),

  wisFout: () => set({ fout: undefined }),
}));
