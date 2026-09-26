// Interfacetekst van Instellingen › Werkzaamheden (OFM-043, NFE-006, V-11).
export const werkzaamheden = {
  uitleg:
    'Hier stel je in waaruit een offerte wordt opgebouwd: welke werkzaamheden bij een soort werk horen, met hun opties en materialen. Prijzen zijn exclusief btw en staan ook onder Prijzen.',

  soorten: 'Soorten werk',
  soortenUitleg:
    'Dit is dezelfde lijst als "Soort werk" onder Keuzelijsten. Vink per soort werk aan welke werkzaamheden erbij horen.',
  koppelingen: 'Welke werkzaamheden horen erbij',
  geenWerkzaamheden: 'Er zijn nog geen werkzaamheden.',
  verborgenAchter: (label: string) => `${label} (verborgen)`,

  werkzaamheden: 'Werkzaamheden',
  werkNaam: (label: string) => `Naam van werkzaamheid ${label}`,
  werkEenheid: (label: string) => `Eenheid van werkzaamheid ${label}`,
  werkPrijs: (label: string) => `Prijs van werkzaamheid ${label}`,
  nieuwWerk: 'Nieuwe werkzaamheid',
  nieuwWerkHint: 'Bijvoorbeeld: Dakkapel bekleden.',
  details: (label: string) => `Opties en materialen van ${label}`,
  opties: 'Opties',
  optiesUitleg: 'Iets wat je bij deze werkzaamheid kunt aanvinken, zoals een afvalcontainer.',
  geenOpties: 'Nog geen opties.',
  optieNaam: (optie: string, werk: string) => `Naam van optie ${optie} bij ${werk}`,
  optieEenheid: (optie: string, werk: string) => `Eenheid van optie ${optie} bij ${werk}`,
  optiePrijs: (optie: string, werk: string) => `Prijs van optie ${optie} bij ${werk}`,
  optieVerberg: (optie: string, werk: string) => `Optie ${optie} bij ${werk} verbergen`,
  optieToon: (optie: string, werk: string) => `Optie ${optie} bij ${werk} weer tonen`,
  optieVerwijder: (optie: string, werk: string) => `Optie ${optie} bij ${werk} verwijderen`,
  nieuweOptie: (werk: string) => `Nieuwe optie bij ${werk}`,
  optieToevoegen: 'Optie toevoegen',
  kiesbareMaterialen: (werk: string) => `Materialen bij ${werk}`,
  geenMaterialen: 'Er zijn nog geen materialen.',
  standaardMateriaal: (werk: string) => `Standaardmateriaal bij ${werk}`,
  standaardMateriaalHint: 'Dit materiaal staat in de wizard al aangevinkt.',
  geenStandaard: 'Geen',

  materialen: 'Materialen',
  materialenUitleg: 'Welke materialen bij een werkzaamheid kiesbaar zijn, vink je aan bij die werkzaamheid.',
  materiaalNaam: (label: string) => `Naam van materiaal ${label}`,
  materiaalEenheid: (label: string) => `Eenheid van materiaal ${label}`,
  materiaalPrijs: (label: string) => `Prijs van materiaal ${label}`,
  nieuwMateriaal: 'Nieuw materiaal',
  nieuwMateriaalHint: 'Bijvoorbeeld: Zink.',

  naam: 'Naam',
  naamFout: 'Vul een naam in.',
  eenheid: 'Eenheid',
  prijs: 'Prijs excl. btw',
  toevoegen: 'Toevoegen',
  omhoog: (label: string) => `${label} omhoog`,
  omlaag: (label: string) => `${label} omlaag`,
  verberg: (label: string) => `${label} verbergen`,
  toon: (label: string) => `${label} weer tonen`,
  verwijder: (label: string) => `${label} verwijderen`,
  verborgen: 'Verborgen',

  verwijderTitel: 'Verwijderen?',
  verwijderTekst: (label: string) =>
    `"${label}" en de prijs ervan verdwijnen. Dit kan niet ongedaan worden gemaakt.`,
  verwijderJa: 'Verwijderen',
  verwijderNee: 'Annuleren',
  inGebruik: (label: string) =>
    `"${label}" staat nog in een offerte en kan daarom niet worden verwijderd. Je kunt het wel verbergen.`,
  verbergInPlaats: 'Verbergen',
  sluiten: 'Sluiten',

  herstel: 'Herstel startset',
  herstelTitel: 'Startset herstellen?',
  herstelTekst:
    'De standaardwerkzaamheden en -materialen krijgen hun oorspronkelijke naam, volgorde en koppelingen terug en worden weer getoond. Prijzen en je eigen onderdelen blijven.',
  herstelJa: 'Herstellen',
  herstelNee: 'Annuleren',
};
