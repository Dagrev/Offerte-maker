import type { KeuzeLijst } from '@shared/types';

// Interfacetekst van Instellingen › Keuzelijsten (OFM-034, NFE-006, V-11).
export const keuzelijsten = {
  uitleg:
    'Dit zijn de keuzes in de wizard. Een nieuwe naam geldt meteen overal, ook in bestaande offertes. Een keuze die in een offerte staat kun je niet verwijderen, wel verbergen. Met Standaard kies je waarmee een nieuwe offerte begint.',
  kiesLijst: 'Welke lijst',
  lijst: {
    soortWerk: 'Soort werk',
    soortDak: 'Soort dak',
    huidigeBedekking: 'Huidige dakbedekking',
    ondergrond: 'Ondergrond',
    hoogte: 'Hoogte',
    garantie: 'Garantie',
  } satisfies Record<KeuzeLijst, string>,
  /** Extra uitleg bij sommige lijsten. */
  lijstHint: {
    garantie:
      'De teksten voor 10 en 20 jaar staan bij Teksten. Bij een nieuwe keuze komt op de offerte: "Op de uitgevoerde werkzaamheden geven wij garantie: <naam>."',
  } satisfies Partial<Record<KeuzeLijst, string>>,
  naam: 'Naam',
  naamVan: (label: string) => `Naam van ${label}`,
  naamFout: 'Vul een naam in.',
  omhoog: (label: string) => `${label} omhoog`,
  omlaag: (label: string) => `${label} omlaag`,
  verberg: (label: string) => `${label} verbergen`,
  toon: (label: string) => `${label} weer tonen`,
  verwijder: (label: string) => `${label} verwijderen`,
  verborgen: 'Verborgen',
  /** OFM-049: keuzerondje per optie; de naam van de optie staat er onzichtbaar achter (schermlezer). */
  standaard: 'Standaard',
  standaardVoor: (label: string) => ` voor ${label}`,
  geenStandaard: 'Geen standaard',
  geenStandaardUitleg: 'Een nieuwe offerte begint dan zonder keuze in deze lijst.',
  standaardNietWeg: (label: string) =>
    `"${label}" is de standaard voor een nieuwe offerte. Kies eerst een andere standaard of Geen standaard.`,
  inGebruik: (label: string) =>
    `"${label}" staat nog in een offerte en kan daarom niet worden verwijderd. Je kunt hem wel verbergen.`,
  verbergInPlaats: 'Verbergen',
  sluiten: 'Sluiten',
  nieuw: 'Nieuwe keuze',
  nieuwHint: 'Bijvoorbeeld: Leien.',
  toevoegen: 'Toevoegen',
  verwijderTitel: 'Keuze verwijderen?',
  verwijderTekst: (label: string) =>
    `"${label}" verdwijnt uit de wizard. Dit kan niet ongedaan worden gemaakt.`,
  verwijderJa: 'Verwijderen',
  verwijderNee: 'Annuleren',
  herstel: 'Herstel standaardlijst',
  herstelTitel: 'Standaardlijst herstellen?',
  herstelTekst:
    'De keuzes van de standaardlijst krijgen hun oorspronkelijke naam en volgorde terug en worden weer getoond, en de standaard wordt weer die van de standaardlijst. Je eigen keuzes blijven bestaan.',
  herstelJa: 'Herstellen',
  herstelNee: 'Annuleren',
};
