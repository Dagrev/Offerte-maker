import type { KeuzeLijst } from '@shared/types';

// Interfacetekst van Instellingen › Keuzelijsten (OFM-034, NFE-006, V-11).
export const keuzelijsten = {
  uitleg:
    'Dit zijn de keuzes in de wizard. Een nieuwe naam geldt meteen overal, ook in bestaande offertes. Een keuze die in een offerte staat kun je niet verwijderen, wel verbergen.',
  kiesLijst: 'Welke lijst',
  lijst: {
    soortWerk: 'Soort werk',
    soortDak: 'Soort dak',
    bedekking: 'Nieuwe dakbedekking',
    huidigeBedekking: 'Huidige dakbedekking',
    ondergrond: 'Ondergrond',
    isolatie: 'Isolatie',
    extras: "Extra's",
    afwerking: 'Afwerking',
    hoogte: 'Hoogte',
    garantie: 'Garantie',
  } satisfies Record<KeuzeLijst, string>,
  /** Extra uitleg bij sommige lijsten. */
  lijstHint: {
    bedekking: 'Een nieuwe keuze krijgt een post zonder prijs in de prijslijst (per m²).',
    isolatie: 'Een nieuwe keuze krijgt een post zonder prijs in de prijslijst (per m²).',
    afwerking: 'Een nieuwe keuze krijgt een post zonder prijs in de prijslijst (per m²).',
    extras:
      'In de wizard vul je bij elke extra een aantal in. Een nieuwe extra krijgt een post zonder prijs in de prijslijst (per stuk).',
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
  vast: 'Standaardkeuze',
  vastUitleg: 'Een nieuwe offerte begint met deze keuze. Je kunt hem alleen een andere naam geven.',
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
    'De standaardkeuzes krijgen hun oorspronkelijke naam en volgorde terug en worden weer getoond. Je eigen keuzes blijven bestaan.',
  herstelJa: 'Herstellen',
  herstelNee: 'Annuleren',
};
