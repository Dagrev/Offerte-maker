import { create } from 'zustand';
import type { TekstenVoorstellen } from '@shared/types';

// Voorstellen voor de standaardteksten uit het template (OFM-024, FE-084, V-08). Eigen kleine store in
// plaats van een veld in de navigatie-store (die is compleet en verandert niet, V-03): het Bezig-scherm
// zet de voorstellen hier via `bijSucces`, en de tab Voorbeelden toont ze na de navigatie in een modaal.

export type TemplateTekstVeld = keyof TekstenVoorstellen;

/** Vaste volgorde in het modaal (gelijk aan het schema, §10.5). */
export const TEMPLATE_TEKST_VELDEN: TemplateTekstVeld[] = [
  'inleiding',
  'afsluiting',
  'betalingsvoorwaarden',
  'garantie10',
  'garantie20',
  'voetnoot',
];

interface TemplateVoorstellenState {
  /** `null` = geen voorstellen open. */
  voorstellen: TekstenVoorstellen | null;
  zet: (voorstellen: TekstenVoorstellen) => void;
  /** Eén voorstel afgehandeld (overgenomen of niet); het laatste sluit het modaal. */
  handelAf: (veld: TemplateTekstVeld) => void;
  sluit: () => void;
}

export const useTemplateVoorstellen = create<TemplateVoorstellenState>()((set) => ({
  voorstellen: null,
  zet: (voorstellen) => set({ voorstellen }),
  handelAf: (veld) =>
    set((s) => {
      if (!s.voorstellen) return s;
      const rest = { ...s.voorstellen };
      delete rest[veld];
      return { voorstellen: Object.keys(rest).length > 0 ? rest : null };
    }),
  sluit: () => set({ voorstellen: null }),
}));

/** De open voorstellen als lijst, in de vaste volgorde. */
export function voorstellenLijst(
  voorstellen: TekstenVoorstellen | null,
): { veld: TemplateTekstVeld; tekst: string }[] {
  if (!voorstellen) return [];
  return TEMPLATE_TEKST_VELDEN.flatMap((veld) => {
    const tekst = voorstellen[veld];
    return tekst ? [{ veld, tekst }] : [];
  });
}
