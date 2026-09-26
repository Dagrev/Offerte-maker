// Interfacetekst van Instellingen › Werkzaamheden en prijzen (OFM-043, OFM-048, NFE-006, V-11).
export const werkzaamheden = {
  uitleg:
    'Hier stel je in waaruit een offerte wordt opgebouwd en wat het kost: materialen, werkzaamheden met hun opties, en de overige prijzen. Alle prijzen zijn exclusief btw. Een prijs mag leeg blijven: Claude schat die dan, en de offerte vraagt je om te controleren.',

  // Sectie Materialen
  materialen: 'Materialen',
  materialenUitleg:
    'Welke materialen bij een werkzaamheid kiesbaar zijn, vink je hieronder aan bij die werkzaamheid.',
  geenMaterialenLijst: 'Er zijn nog geen materialen.',
  materiaalNaam: (label: string) => `Naam van materiaal ${label}`,
  materiaalEenheid: (label: string) => `Eenheid van materiaal ${label}`,
  materiaalPrijs: (label: string) => `Prijs van materiaal ${label}`,
  materiaalBtw: (label: string) => `Btw van materiaal ${label}`,
  nieuwMateriaal: 'Nieuw materiaal',
  nieuwMateriaalHint: 'Bijvoorbeeld: Zink.',
  materiaalToevoegen: 'Materiaal toevoegen',

  // Sectie Werkzaamheden
  werkzaamheden: 'Werkzaamheden',
  werkzaamhedenUitleg:
    'Per werkzaamheid een prijs per eenheid en een prijs per uur: in de offerte kies je per werkzaamheid welke van de twee geldt.',
  soortenElders: 'De soorten werk zelf (zoals Dak vervangen) beheer je onder Keuzelijsten.',
  naarKeuzelijsten: 'Soorten werk beheren',
  geenWerkzaamheden: 'Er zijn nog geen werkzaamheden.',
  werkNaam: (label: string) => `Naam van werkzaamheid ${label}`,
  werkEenheid: (label: string) => `Eenheid van werkzaamheid ${label}`,
  werkPrijs: (label: string) => `Prijs per eenheid van werkzaamheid ${label}`,
  werkUurprijs: (label: string) => `Prijs per uur van werkzaamheid ${label}`,
  werkBtw: (label: string) => `Btw van werkzaamheid ${label}`,
  prijsPerEenheid: 'Prijs per eenheid',
  prijsPerUur: 'Prijs per uur',
  hoortBij: (werk: string) => `${werk} hoort bij`,
  hoortBijNiets: 'Hoort nog bij geen enkele soort werk: dan staat hij niet in de wizard.',
  nieuwWerk: 'Nieuwe werkzaamheid',
  nieuwWerkHint: 'Bijvoorbeeld: Dakkapel bekleden.',
  werkToevoegen: 'Werkzaamheid toevoegen',
  opties: (werk: string) => `Opties bij ${werk}`,
  optiesUitleg: 'Iets wat je bij deze werkzaamheid kunt aanvinken, zoals een afvalcontainer.',
  geenOpties: 'Nog geen opties.',
  optieNaam: (optie: string, werk: string) => `Naam van optie ${optie} bij ${werk}`,
  optieEenheid: (optie: string, werk: string) => `Eenheid van optie ${optie} bij ${werk}`,
  optiePrijs: (optie: string, werk: string) => `Prijs van optie ${optie} bij ${werk}`,
  nieuweOptie: (werk: string) => `Nieuwe optie bij ${werk}`,
  optieToevoegen: 'Optie toevoegen',
  kiesbareMaterialen: (werk: string) => `Materialen bij ${werk}`,
  geenMaterialen: 'Er zijn nog geen materialen.',
  standaardMateriaal: (werk: string) => `Standaardmateriaal bij ${werk}`,
  standaardMateriaalHint: 'Dit materiaal staat in de wizard al aangevinkt.',
  geenStandaard: 'Geen',
  verborgenAchter: (label: string) => `${label} (verborgen)`,

  // Sectie Overige prijzen (de vaste posten, via prijzen:*)
  overig: 'Overige prijzen',
  overigUitleg:
    'Deze posten zet de app zelf in een offerte: steiger (als die nodig is), verzekerde garantie en voorrijkosten.',
  postOmschrijving: (label: string) => `Omschrijving van ${label}`,
  postPrijs: (label: string) => `Prijs van ${label}`,
  postBtw: (label: string) => `Btw van ${label}`,
  omschrijvingFout: 'Vul een omschrijving in.',

  naam: 'Naam',
  naamFout: 'Vul een naam in.',
  eenheid: 'Eenheid',
  prijs: 'Prijs excl. btw',
  btw: 'Btw',
  btwTarief: (tarief: number) => `${tarief}%`,
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
