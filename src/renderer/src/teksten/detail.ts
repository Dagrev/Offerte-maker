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
  pdfWordtGemaakt: 'De PDF wordt gemaakt…',
  openPdf: 'Open PDF',
  afdrukken: 'Afdrukken',
  toonInMap: 'Toon in map',
  maakKopie: 'Maak kopie',
  verwijderen: 'Verwijderen',

  /** Statusknoppen (FE-060, OFM-016). */
  statusKiezen: 'Status van de offerte',
  statusAlleenDefinitief: 'Maak de offerte eerst definitief om de status te kiezen.',

  /** Kopie (FE-061, V-21). */
  kopieTitel: 'Voor wie is de kopie?',
  kopieUitleg: 'De klusgegevens gaan mee. De teksten en prijzen maakt Claude opnieuw.',
  zelfdeKlant: 'Zelfde klant',
  andereKlant: 'Andere klant',
  annuleren: 'Annuleren',

  /** Laat Claude aanpassen (FE-053, OFM-017). */
  aanpassenTitel: 'Laat Claude aanpassen',
  watMoetErAnders: 'Wat moet er anders?',
  watMoetErAndersHint: 'Bijvoorbeeld: "Maak de dakgoot 14 meter en haal de noodoverloop eruit."',
  aanpassenVersturen: 'Pas aan',
  terugzetten: 'Terugzetten',
  terugzettenVersie: (nr: number) => `Versie ${nr} terugzetten`,

  /** Verwijderen (FE-062). */
  verwijderTitel: 'Weet je het zeker?',
  verwijderUitleg: 'De offerte gaat naar de prullenbak. Daar kun je hem 90 dagen terugzetten.',
  jaVerwijderen: 'Ja, verwijderen',
  nee: 'Nee',

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
