import type { FoutActie } from '@shared/fouten';
import type { Status } from '@shared/types';

// Interfacetekst van de basiscomponenten in `componenten/` (NFE-006, V-11). Eigenaar: OFM-008.
export const componenten = {
  bewaard: 'Bewaard ✓',

  /** `AdresVelden` (OFM-031, OFM-040): adres opzoeken in beide richtingen en controleren. */
  adres: {
    postcode: 'Postcode',
    huisnummer: 'Huisnummer',
    straat: 'Straat',
    plaats: 'Plaats',
    zoeken: 'Adres opzoeken…',
    nietGevonden: 'Niet gevonden, vul zelf in',
    /** OFM-040: andersom opzoeken (straat + huisnummer + plaats → postcode). */
    postcodeNietGevonden: 'Postcode niet gevonden, vul zelf in',
    /** OFM-040: oranje, niet-blokkerend als straat of plaats niet bij postcode + huisnummer hoort. */
    afwijkend: 'Dit adres is niet gevonden bij PDOK. Klopt het?',
    straatLeeg: 'Vul ook de straat in',
    huisnummerLeeg: 'Vul ook het huisnummer in',
  },

  /** Knoplabels bij een foutmelding (§15.1); de melding zelf komt uit main. */
  foutActie: {
    naarClaudeKoppeling: 'Naar Claude-koppeling',
    opnieuwInloggen: 'Opnieuw inloggen',
    probeerOpnieuw: 'Probeer opnieuw',
    naarOverig: 'Naar Overig',
    opnieuw: 'Opnieuw',
  } satisfies Record<FoutActie, string>,

  status: {
    concept: 'Concept',
    klaar: 'Klaar',
    verstuurd: 'Verstuurd',
    akkoord: 'Akkoord',
    afgewezen: 'Afgewezen',
  } satisfies Record<Status, string>,

  gekozen: 'gekozen',
  /** Bij een verborgen keuze die een oude offerte nog heeft (OFM-034). */
  nietMeerInLijst: '(niet meer in de lijst)',
  stap: (nummer: number, totaal: number) => `Stap ${nummer} van ${totaal}`,
  stappen: 'Stappen',
  stapKlaar: 'klaar',
  /** Oranje markering in de stappenbalk (OFM-035). */
  stapPunten: (n: number) => (n === 1 ? '(1 punt nog niet in orde)' : `(${n} punten nog niet in orde)`),

  pdfVoorbeeld: 'Voorbeeld van de offerte',
  pdfVoorbeeldLaden: 'Het voorbeeld wordt gemaakt…',

  claude: {
    gekoppeld: 'Claude is gekoppeld',
    nietGekoppeld: 'Claude is niet gekoppeld',
    onbekend: 'Claude wordt gecontroleerd…',
    kort: 'Claude',
  },

  controleer: 'Let op',
};
