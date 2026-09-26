// Interfacetekst (NFE-006, V-11). Eigenaar: OFM-010 (schermen/wizard/*), OFM-025 (Maak zonder Claude).
// Alleen het eigenaarticket vult deze module. Keuzelabels komen uit `@shared/labels` (§9.1).
export const wizard = {
  titel: 'Nieuwe offerte',
  /** OFM-047: aanpasmodus (de offerte heeft al inhoud). */
  titelAanpassen: 'Offerte aanpassen',
  terugNaarOfferte: 'Terug naar de offerte',
  maakOpnieuw: 'Maak opnieuw',
  maakOpnieuwZonderClaude: 'Maak opnieuw zonder Claude',
  /** OFM-050: stap 2 beschrijft alleen het huidige dak. */
  stappen: ['Klant', 'Het huidige dak', 'Werkzaamheden', 'Overig en maken'] as const,
  terugNaarOverzicht: 'Terug naar overzicht',
  vorige: 'Vorige',
  volgende: 'Volgende',
  maakDeOfferte: 'Maak de offerte',
  /** OFM-025 (FE-110, V-09): alleen zichtbaar als Claude niet werkt. */
  maakZonderClaude: 'Maak zonder Claude',
  laden: 'De offerte wordt geopend…',
  /** OFM-035: samenvatting bij Maak de offerte als er nog iets ontbreekt; de punten zelf staan in
   *  `@shared/teksten/wizardPunten` (ook gebruikt door main). */
  punten: {
    kop: 'Nog niet alles is ingevuld',
    uitleg: 'Vul dit eerst aan; daarna kun je de offerte maken.',
    naarStap: (stap: number) => `Naar stap ${stap}`,
  },

  klant: {
    titel: 'Klant',
    privacy: 'Deze gegevens blijven op deze computer. Claude krijgt ze niet te zien.',
    aanhef: 'Aanhef',
    aanhefOpties: { dhr: 'Dhr.', mevr: 'Mevr.', fam: 'Fam.', bedrijf: 'Bedrijf' },
    voornaam: 'Voornaam',
    /** OFM-046: nooit verplicht; bij verlaten getrimd en in kleine letters. */
    tussenvoegsel: 'Tussenvoegsel',
    achternaam: 'Achternaam',
    /** OFM-038: bij aanhef Bedrijf zijn voor- en achternaam de contactpersoon. */
    contactpersoon: 'Contactpersoon',
    bedrijfsnaam: 'Bedrijfsnaam',
    telefoon: 'Telefoon',
    email: 'E-mail',
    anderWerkadres: 'Het werk is op een ander adres',
    werkadres: 'Werkadres',
    /** OFM-038: onder een leeg verplicht veld, na een poging tot Maak de offerte. */
    veldLeeg: 'Vul dit veld in; het is verplicht',
  },

  dak: {
    titel: 'Het huidige dak',
    soortWerk: 'Soort werk',
    soortDak: 'Soort dak',
    dakvlakken: 'Dakvlakken',
    dakvlakNaam: 'Naam van het dakvlak',
    maatwijze: 'Hoe wil je de maat invullen?',
    lxb: 'Lengte × breedte',
    m2: 'Direct m²',
    lengte: 'Lengte',
    breedte: 'Breedte',
    oppervlakte: 'Oppervlakte',
    meter: 'm',
    vierkanteMeter: 'm²',
    dakvlakToevoegen: 'Dakvlak toevoegen',
    dakvlakVerwijderen: (naam: string) => `${naam} verwijderen`,
    maxDakvlakken: 'Er kunnen maximaal 20 dakvlakken in één offerte.',
    totaal: 'Totaal',
    bedekking: 'Nieuwe dakbedekking',
    bedekkingAnders: 'Welke dakbedekking?',
    huidigeBedekking: 'Huidige dakbedekking',
    ondergrond: 'Ondergrond',
    /** OFM-044: hoogte staat sinds de stap Werkzaamheden bij het dak. */
    hoogte: 'Hoogte',
  },

  extras: {
    titel: "Extra's",
    slopen: 'Oude dakbedekking slopen en afvoeren',
    isolatie: 'Isolatie',
    isolatieMm: 'Dikte van de isolatie',
    mm: 'mm',
    // De namen van de keuzes (isolatie, extra's, afwerking, hoogte, garantie) staan sinds OFM-034 in de
    // database (Instellingen › Keuzelijsten); de startwaarden in src/shared/keuzelijsten.ts.
    strekkendeMeter: 'm¹',
    stuks: 'stuks',
    afwerking: 'Afwerking',
    hoogte: 'Hoogte',
    steiger: 'Steiger of hoogwerker nodig',
    garantie: 'Garantie',
    gewensteUitvoering: 'Gewenste uitvoering',
    gewensteUitvoeringHint: 'Bijvoorbeeld: voor de winter.',
  },

  overig: {
    titel: 'Overig en maken',
    overig: 'Overig',
    vraag: 'Wat moet er nog meer in de offerte? Schrijf het gewoon op.',
    hint: 'Zet hier geen namen, adressen of telefoonnummers in.',
    offertedatum: 'Offertedatum',
    geldigTot: (datum: string) => `Geldig tot ${datum}`,
    samenvatting: 'Samenvatting',
    ja: 'Ja',
    niets: 'Niets ingevuld',
  },

  /** Kopjes in de samenvatting van stap 4. */
  samenvatting: {
    klant: 'Klant',
    adres: 'Adres',
    werkadres: 'Werkadres',
    telefoon: 'Telefoon',
    email: 'E-mail',
    soortWerk: 'Soort werk',
    /** OFM-050 */
    nieuweBedekking: 'Nieuwe dakbedekking',
    soortDak: 'Soort dak',
    dakvlakken: 'Dakvlakken',
    huidigeBedekking: 'Huidige dakbedekking',
    ondergrond: 'Ondergrond',
    hoogte: 'Hoogte',
    steiger: 'Steiger of hoogwerker',
    garantie: 'Garantie',
    gewensteUitvoering: 'Gewenste uitvoering',
    /** OFM-044 */
    werkzaamheden: 'Werkzaamheden',
  },

  /** OFM-044: stap 3 Werkzaamheden. */
  werk: {
    soortWerk: 'Soort werk',
    /** OFM-050 */
    nieuweBedekking: 'Nieuwe dakbedekking',
    nieuweBedekkingHint:
      'Het materiaal komt vanzelf bij de werkzaamheden die het gebruiken; wisselen kan daar nog.',
    kiesSoortEerst: 'Kies eerst een soort werk; daarna verschijnen de werkzaamheden die erbij horen.',
    werkzaamheden: 'Werkzaamheden',
    geenGekoppeld:
      'Bij deze soort werk horen nog geen werkzaamheden. Voeg er een toe met Andere werkzaamheid, of stel ze in onder Instellingen › Werkzaamheden en prijzen.',
    nietBijSoort: 'hoort niet bij deze soort werk',
    aantal: 'Aantal',
    prijs: 'Prijs per eenheid (excl. btw)',
    euro: '€',
    prijsHint: 'Alleen voor deze offerte; de prijslijst verandert niet.',
    geenPrijs: 'Geen prijs in de prijslijst: Claude schat hem, of vul hem hier in.',
    standaardPrijs: 'Standaardprijs',
    standaardPrijsVan: (label: string) => `Standaardprijs voor ${label}`,
    materialen: 'Materialen',
    /** OFM-051: na een andere ondergrond of nieuwe bedekking. */
    daksysteemHint: (materiaal: string) => `Standaard bij dit daksysteem: ${materiaal}`,
    daksysteemGebruik: (materiaal: string, werk: string) => `Gebruik ${materiaal} bij ${werk}`,
    gebruik: 'Gebruik',
    opties: 'Opties',
    notitie: 'Notitie',
    notitieHint: 'Bijzonderheden bij deze werkzaamheid. Zet hier geen namen of adressen in.',
    subtotaal: 'Subtotaal excl. btw',
    aantalVan: (label: string) => `Aantal ${label}`,
    prijsVan: (label: string) => `Prijs per eenheid ${label}`,
    /** OFM-048: per eenheid of per uur. */
    rekenwijze: (label: string) => `${label} rekenen`,
    perEenheid: (eenheid: string) => `Per eenheid (${eenheid})`,
    perUur: 'Per uur',
    urenVan: (label: string) => `Aantal uren ${label}`,
    uurprijsVan: (label: string) => `Prijs per uur ${label}`,
    geenUurprijs:
      'Geen uurprijs ingesteld. Vul hier de prijs per uur in, of laat hem leeg: dan schat Claude hem.',
    eenmalig: 'eenmalig',
    eenmaligUitleg: 'Alleen voor deze offerte.',
    naam: 'Naam',
    naamVan: (soort: string) => `Naam van ${soort}`,
    eenheid: 'Eenheid',
    eenheidVan: (label: string) => `Eenheid ${label}`,
    andereWerkzaamheid: 'Andere werkzaamheid',
    anderMateriaal: 'Ander materiaal',
    anderMateriaalBij: (label: string) => `Ander materiaal bij ${label}`,
    verwijder: (label: string) => `${label} verwijderen`,
    opslaanInInstellingen: 'Ook opslaan in instellingen',
    opslaanUitleg: 'Dan staat hij voortaan in de lijst, met deze prijs in de prijslijst.',
    opslaanNaamNodig: 'Vul eerst een naam in.',
    nieuweWerkzaamheid: 'Nieuwe werkzaamheid',
    nieuwMateriaal: 'Nieuw materiaal',
    overig: 'Verder',
  },
};
