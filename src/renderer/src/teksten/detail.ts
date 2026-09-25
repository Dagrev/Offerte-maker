import type { Eenheid } from '@shared/types';

// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-014, OFM-015, OFM-016, OFM-017 (schermen/Detail.tsx).
// Alleen het eigenaarticket vult deze module.
export const detail = {
  titel: 'Offerte',
  laden: 'De offerte wordt geopend…',
  terugNaarOverzicht: 'Terug naar overzicht',
  concept: 'Concept',
  offertenummer: 'Offertenummer',
  klant: 'Klant',
  status: 'Status',
  totaal: 'Totaal incl. btw',
  acties: 'Acties',

  /** Gele balk (FE-051, V-05). */
  controleerEven: 'Controleer even:',
  geschattePrijs: (omschrijving: string, prijs: string, eenheid: Eenheid) =>
    `Geschatte prijs: ${omschrijving} (${prijs} per ${eenheid}).`,

  aanpassen: 'Aanpassen',
  laatClaudeAanpassen: 'Laat Claude aanpassen',
  maakDefinitief: 'Maak definitief',
  openPdf: 'Open PDF',
  afdrukken: 'Afdrukken',
  toonInMap: 'Toon in map',
  maakKopie: 'Maak kopie',
  verwijderen: 'Verwijderen',
  /** Tooltip bij knoppen die in een volgend ticket worden aangesloten. */
  binnenkort: 'Komt in een volgende versie.',

  eerdereVersies: 'Eerdere versies',
  versie: (nr: number) => `Versie ${nr}`,
  versieBron: {
    agent: 'Gemaakt door Claude',
    agent_aanpassing: 'Aangepast door Claude',
    handmatig: 'Zelf aangepast',
    terugzetten: 'Teruggezet',
    zonder_claude: 'Gemaakt zonder Claude',
  } as Record<string, string>,

  /** Offerte zonder inhoud (nog niet gemaakt). */
  geenInhoud: 'Deze offerte is nog niet gemaakt.',
  naarWizard: 'Verder met de offerte',
};
