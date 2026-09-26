// Interfacetekst van Instellingen › Materialen en prijzen en › Werkzaamheden (OFM-043, OFM-048, OFM-056,
// NFE-006, V-11).
export const werkzaamheden = {
  uitlegMaterialen:
    'Hier stel je de materialen en de overige prijzen in. Alle prijzen zijn exclusief btw. Een prijs mag leeg blijven: Claude schat die dan, en de offerte vraagt je om te controleren.',
  uitlegWerkzaamheden:
    'Hier stel je in uit welke werkzaamheden een offerte wordt opgebouwd, met hun prijzen, materialen en opties. Alle prijzen zijn exclusief btw. Klik op een werkzaamheid om hem te openen.',

  // Sectie Materialen
  materialen: 'Materialen',
  materialenUitleg:
    'Op alfabetische volgorde. Welke materialen bij een werkzaamheid kiesbaar zijn, vink je aan bij die werkzaamheid in de tab Werkzaamheden.',
  geenMaterialenLijst: 'Er zijn nog geen materialen.',
  materiaalNaam: (label: string) => `Naam van materiaal ${label}`,
  materiaalEenheid: (label: string) => `Eenheid van materiaal ${label}`,
  materiaalPrijs: (label: string) => `Prijs van materiaal ${label}`,
  materiaalBtw: (label: string) => `Btw van materiaal ${label}`,
  nieuwMateriaal: 'Nieuw materiaal',
  nieuwMateriaalHint: 'Bijvoorbeeld: Zink.',
  materiaalToevoegen: 'Materiaal toevoegen',
  zoekMateriaal: 'Zoek een materiaal',
  geenMaterialenGevonden: 'Geen materialen gevonden.',

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
  allesOpenen: 'Alles openen',
  allesSluiten: 'Alles sluiten',
  geenPrijs: 'geen prijs',
  kopPrijs: (prijs: string) => `${prijs} per eenheid`,
  kopUurprijs: (prijs: string) => `${prijs} per uur`,
  aantalOpties: (n: number) => (n === 1 ? '1 optie' : `${n} opties`),
  aantalMaterialen: (n: number) => (n === 1 ? '1 materiaal' : `${n} materialen`),
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

  // Tags bij de materialen (OFM-055)
  tags: {
    titel: 'Beschikbare tags',
    uitleg:
      'Een materiaal is in de wizard alleen kiesbaar bij de ondergronden en dakbedekkingen waarvan de tag aan staat. Een nieuw materiaal heeft alle tags aan. De tags komen uit de keuzelijsten Ondergrond en Nieuwe dakbedekking.',
    ondergrond: 'Ondergrond',
    bedekking: 'Nieuwe dakbedekking',
    geen: 'Geen opties in deze keuzelijst.',
    vanMateriaal: (materiaal: string) => `Tags van ${materiaal}`,
    groepVan: (groep: string, materiaal: string) => `${groep} bij ${materiaal}`,
    tag: (tag: string, materiaal: string) => `${tag} bij ${materiaal}`,
    laatste: 'Minstens één tag per groep blijft aan.',
  },

  // Materiaal per daksituatie bij een werkzaamheid (OFM-055)
  situatie: {
    vinkje: 'Materiaal per daksituatie',
    vinkjeHint:
      'Aan: per combinatie van ondergrond en nieuwe dakbedekking kies je welke materialen de wizard voorselecteert.',
    knoppen: (werk: string) => `Daksituaties bij ${werk}`,
    combinatie: (ondergrond: string, bedekking: string) => `${ondergrond} × ${bedekking}`,
    teller: (aantal: number) => (aantal === 1 ? '1 materiaal' : `${aantal} materialen`),
    materialen: (combinatie: string, werk: string) => `Standaardmaterialen bij ${combinatie} voor ${werk}`,
    geenCombinaties:
      'Er zijn nog geen situaties: zet onder Keuzelijsten minstens één ondergrond en één nieuwe dakbedekking aan.',
    geenPassend:
      'Geen kiesbaar materiaal past bij deze situatie. Vink materialen aan bij deze werkzaamheid of zet hun tags aan bij Materialen.',
    vervallen: (aantal: number) =>
      aantal === 1
        ? 'Eén standaardmateriaal bij een daksituatie is vervallen, omdat het niet meer kiesbaar is of zijn tag uit staat.'
        : `${aantal} standaardmaterialen bij een daksituatie zijn vervallen, omdat ze niet meer kiesbaar zijn of hun tag uit staat.`,
  },

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
  herstelUitleg:
    'Herstel startset zet de standaardwerkzaamheden én de standaardmaterialen (tab Materialen en prijzen) terug zoals ze bij de installatie waren. Je eigen werkzaamheden, materialen en alle prijzen blijven.',
  herstelTitel: 'Startset herstellen?',
  herstelTekst:
    'De standaardwerkzaamheden en -materialen krijgen hun oorspronkelijke naam, volgorde en koppelingen terug en worden weer getoond. Prijzen en je eigen onderdelen blijven. Ook de tags van de standaardmaterialen en het materiaal per daksituatie van de standaardwerkzaamheden gaan terug naar de startset.',
  herstelJa: 'Herstellen',
  herstelNee: 'Annuleren',
};
