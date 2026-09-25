import type { FoutActie } from '@shared/fouten';
import type { Status } from '@shared/types';

// Interfacetekst van de basiscomponenten in `componenten/` (NFE-006, V-11). Eigenaar: OFM-008.
export const componenten = {
  bewaard: 'Bewaard ✓',

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
  stap: (nummer: number, totaal: number) => `Stap ${nummer} van ${totaal}`,
  stappen: 'Stappen',
  stapKlaar: 'klaar',

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
