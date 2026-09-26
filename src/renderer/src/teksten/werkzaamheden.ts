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
    'Per categorie, en daarin op alfabetische volgorde. Welke materialen bij een werkzaamheid kiesbaar zijn, vink je aan bij die werkzaamheid in de tab Werkzaamheden.',
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

  // Categorieën van materialen (OFM-057)
  categorie: {
    kop: 'Categorie',
    vanMateriaal: (materiaal: string) => `Categorie van ${materiaal}`,
    groep: (categorie: string) => `Categorie ${categorie}`,
    materialenIn: (categorie: string) => `Materialen in ${categorie}`,
    aantal: (n: number) => (n === 1 ? '1 materiaal' : `${n} materialen`),
    leeg: 'Nog geen materialen in deze categorie.',
    nieuwIn: (categorie: string) => `Nieuw materiaal in ${categorie}`,
    toevoegenIn: (categorie: string) => `Materiaal toevoegen aan ${categorie}`,
    beheer: 'Categorieën',
    beheerUitleg:
      'Hier voeg je categorieën toe en verander je de naam en de volgorde. Verwijder je een categorie, dan gaan de materialen erin naar Overig. Overig blijft altijd bestaan.',
    naamVan: (categorie: string) => `Naam van categorie ${categorie}`,
    overigVast: 'vast, voor materialen zonder categorie',
    nieuw: 'Nieuwe categorie',
    toevoegen: 'Categorie toevoegen',
    fout: {
      leeg: 'Vul een naam in.',
      dubbel: 'Er is al een categorie met deze naam.',
    },
    verwijderTitel: 'Categorie verwijderen?',
    verwijderTekst: (categorie: string, aantal: number) =>
      aantal === 0
        ? `"${categorie}" verdwijnt. Er staan geen materialen in.`
        : aantal === 1
          ? `"${categorie}" verdwijnt. Het materiaal erin gaat naar Overig.`
          : `"${categorie}" verdwijnt. De ${aantal} materialen erin gaan naar Overig.`,
  },

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
  kiesbaarUitleg:
    'Hier staan de materialen met Alle situaties. Materialen met eigen tags kies je bij Materiaal per daksituatie.',
  kiesbaarVervallen: (aantal: number) =>
    aantal === 1
      ? 'Een materiaal met eigen tags is niet meer gewoon kiesbaar bij een werkzaamheid. Kies het per daksituatie; in bestaande offertes blijft het staan.'
      : `${aantal} materialen met eigen tags zijn niet meer gewoon kiesbaar bij een werkzaamheid. Kies ze per daksituatie; in bestaande offertes blijven ze staan.`,
  geenMaterialen: 'Er zijn nog geen materialen.',
  standaardMateriaal: (werk: string) => `Standaardmateriaal bij ${werk}`,
  standaardMateriaalHint: 'Dit materiaal staat in de wizard al aangevinkt.',
  geenStandaard: 'Geen',
  verborgenAchter: (label: string) => `${label} (verborgen)`,

  // Tags bij de materialen (OFM-055)
  tags: {
    uitleg:
      'Rechts in elke rij staan de tags. Alle situaties: het materiaal past overal en is bij een werkzaamheid gewoon kiesbaar. Zet je Alle situaties uit, dan kies je zelf bij welke ondergronden en nieuwe dakbedekkingen (uit Keuzelijsten) het past; zo’n materiaal kies je bij een werkzaamheid per daksituatie.',
    alle: 'Alle situaties',
    alleVan: (materiaal: string) => `Alle situaties bij ${materiaal}`,
    ondergrond: 'Ondergrond',
    bedekking: 'Nieuwe dakbedekking',
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
  herstelUitleg:
    'Herstel startset zet de standaardwerkzaamheden én de standaardmaterialen (tab Materialen en prijzen) terug zoals ze bij de installatie waren. Je eigen werkzaamheden, materialen en alle prijzen blijven.',
  herstelTitel: 'Startset herstellen?',
  herstelTekst:
    'De standaardwerkzaamheden en -materialen krijgen hun oorspronkelijke naam, volgorde en koppelingen terug en worden weer getoond. Prijzen en je eigen onderdelen blijven. Ook de tags van de standaardmaterialen en het materiaal per daksituatie van de standaardwerkzaamheden gaan terug naar de startset.',
  herstelJa: 'Herstellen',
  herstelNee: 'Annuleren',
};
