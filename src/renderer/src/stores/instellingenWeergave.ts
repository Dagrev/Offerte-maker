import { create } from 'zustand';

// Open/dicht-stand in Instellingen (OFM-056, TDO §13.4): welke werkzaamheidkaarten in de tab
// Werkzaamheden open staan (standaard dicht) en, sinds OFM-057, welke categoriegroepen in de tab Materialen
// en prijzen dicht staan (standaard open). De stand blijft staan zolang de app open is (ook na een
// wissel van tab), maar wordt bewust niet opgeslagen. Los van `navigatie.ts`, zodat die store klein blijft.

interface InstellingenWeergaveState {
  /** Id's van de werkzaamheden waarvan de kaart open staat. */
  openWerk: Record<string, true>;
  zetWerkOpen: (id: string, open: boolean) => void;
  /** Alles openen (met de id's van alle kaarten) of alles sluiten. */
  zetAlleWerk: (ids: readonly string[], open: boolean) => void;
  /** OFM-057: id's van de categoriegroepen die dicht staan. */
  dichteCategorieen: Record<string, true>;
  zetCategorieOpen: (id: string, open: boolean) => void;
  /** Deze groepen open (bijv. met treffers bij zoeken); de rest blijft zoals hij is. */
  openCategorieen: (ids: readonly string[]) => void;
  /** Alles openen of alles sluiten (met de id's van alle groepen). */
  zetAlleCategorieen: (ids: readonly string[], open: boolean) => void;
}

export const useInstellingenWeergave = create<InstellingenWeergaveState>()((set) => ({
  openWerk: {},
  zetWerkOpen: (id, open) =>
    set((s) => {
      const openWerk = { ...s.openWerk };
      if (open) openWerk[id] = true;
      else delete openWerk[id];
      return { openWerk };
    }),
  zetAlleWerk: (ids, open) =>
    set(() => ({ openWerk: open ? Object.fromEntries(ids.map((id) => [id, true as const])) : {} })),
  dichteCategorieen: {},
  zetCategorieOpen: (id, open) =>
    set((s) => {
      const dichteCategorieen = { ...s.dichteCategorieen };
      if (open) delete dichteCategorieen[id];
      else dichteCategorieen[id] = true;
      return { dichteCategorieen };
    }),
  openCategorieen: (ids) =>
    set((s) => {
      const dichteCategorieen = { ...s.dichteCategorieen };
      for (const id of ids) delete dichteCategorieen[id];
      return { dichteCategorieen };
    }),
  zetAlleCategorieen: (ids, open) =>
    set(() => ({
      dichteCategorieen: open ? {} : Object.fromEntries(ids.map((id) => [id, true as const])),
    })),
}));
