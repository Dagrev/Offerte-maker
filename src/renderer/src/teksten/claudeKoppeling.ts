// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-020 (Geavanceerd, Claude-koppeling).
// Alleen het eigenaarticket vult deze module. Fouttekst bij de status komt uit `shared/teksten/fouten.ts`.
export const claudeKoppeling = {
  titel: 'Claude-koppeling',
  uitleg: 'De app laat Claude de offertes schrijven. Hier zie je of de koppeling werkt.',
  statusTitel: 'Status',
  statusLaden: 'De koppeling wordt gecontroleerd…',
  gekoppeldAccount: (versie: string) => `Gekoppeld met je Claude-account (versie ${versie})`,
  gekoppeldApi: 'Gekoppeld via API-sleutel',
  koppel: 'Koppel Claude-account',
  koppelBezig:
    'Er is een venster geopend om in te loggen bij Claude. Volg de stappen daar en sluit het venster als je klaar bent.',
  test: 'Test de koppeling',
  testBezig: 'Claude wordt getest… Dit kan tot een minuut duren.',
  werkt: 'Werkt!',

  instellingenTitel: 'Instellingen',
  model: 'Model',
  modelHint: 'Alleen voor de koppeling met je Claude-account. Standaard: opus.',
  modelLeeg: 'Vul een model in, bijvoorbeeld opus.',
  effort: 'Hoe grondig werkt Claude?',
  effortOpties: { low: 'Laag', medium: 'Gemiddeld', high: 'Hoog' },
  pad: 'Pad naar claude.exe',
  padHint: 'Leeg laten om automatisch te zoeken.',
  padFout: 'Dit moet een bestand zijn dat eindigt op .exe.',
  bladeren: 'Bladeren',

  sleutelTitel: 'API-sleutel',
  sleutelUitleg:
    'Alleen nodig als de koppeling met het Claude-account niet werkt. De sleutel wordt versleuteld op deze computer bewaard. Met een API-sleutel gebruikt de app altijd Claude Opus 5; het veld Model geldt dan niet.',
  sleutel: 'API-sleutel',
  sleutelIngevuld: 'Er is een API-sleutel ingevuld.',
  bewaren: 'Bewaren',
  verwijderen: 'Verwijderen',
};
