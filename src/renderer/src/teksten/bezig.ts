// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-013 (schermen/Bezig.tsx).
// Alleen het eigenaarticket vult deze module.
export const bezig = {
  titel: 'Bezig met de offerte',
  /** Kop per soort taak (FO S3). */
  kop: {
    maken: 'Claude schrijft je offerte…',
    aanpassen: 'Claude past je offerte aan…',
    zonder_claude: 'De offerte wordt klaargezet…',
    template_teksten: 'Claude leest het template…',
  },
  duur: 'Dit duurt meestal 1 tot 2 minuten',
  verstreken: (tijd: string) => `Verstreken tijd: ${tijd}`,
  stoppen: 'Stoppen',
  bezigMetStoppen: 'Bezig met stoppen…',
};
