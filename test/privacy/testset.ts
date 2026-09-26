import type { Adres, Klant, KlusInvoer } from '@shared/types';

// Privacytestset (TDO §11.6, NFE-008). Elk geval beschrijft een klant, de wizardinvoer en
// eventueel een aanpassingsinstructie, met wat er niet (en wel) in de opdracht aan de agent mag
// staan. `privacy.test.ts` bouwt per geval de opdrachtdata met de echte `bouwKlusVoorAgent()`.
// OFM-013 breidt de test uit naar de volledige opdracht via de opdrachtbouwer.
//
// Alle namen, adressen en nummers zijn verzonnen.

export interface Privacygeval {
  omschrijving: string;
  klant: Klant;
  invoer: KlusInvoer;
  /** Aanpassingsinstructie (opdracht `aanpassen`); gaat door het filter. */
  instructie?: string;
  verwacht: {
    /** Hoofdletterongevoelig, behalve een waarde die gelijk is aan de plaats van klant of werkadres. */
    nietInOpdracht: string[];
    welInOpdracht?: string[];
  };
}

const leegAdres: Adres = { straatHuisnummer: '', postcode: '', plaats: '' };

export function maakKlant(deel: Partial<Klant> = {}): Klant {
  return {
    aanhef: 'dhr',
    voornaam: '',
    achternaam: '',
    bedrijfsnaam: '',
    adres: leegAdres,
    telefoon: '',
    email: '',
    heeftWerkadres: false,
    werkadres: leegAdres,
    ...deel,
  };
}

/** Lege `KlusInvoer` volgens §5, met de opgegeven velden erover. */
export function maakInvoer(deel: Partial<KlusInvoer> = {}): KlusInvoer {
  return {
    soortWerk: 'dak_vervangen',
    soortDak: 'plat',
    dakvlakken: [{ id: 'v1', naam: 'Dakvlak 1', modus: 'lxb', lengteM: 5, breedteM: 4.5, m2: null }],
    huidigeBedekking: null,
    ondergrond: null,
    hoogte: '1',
    steigerNodig: false,
    garantieJaren: '10',
    // OFM-044: minstens één werkzaamheid (standaard verplicht).
    werkzaamheden: [
      {
        id: 'w1',
        sleutel: 'slopen',
        eenmalig: null,
        aantal: 22.5,
        prijsCent: null,
        perUur: false,
        notitie: '',
        materialen: [],
        opties: [],
      },
    ],
    gewensteUitvoering: '',
    overig: '',
    ...deel,
  };
}

const vlak = (naam: string) => ({
  id: naam,
  naam,
  modus: 'm2' as const,
  lengteM: null,
  breedteM: null,
  m2: 20,
});

/** Standaardklant: dhr. Jansen in Veldhoven. */
const jansen = (deel: Partial<Klant> = {}): Klant =>
  maakKlant({
    voornaam: '',
    achternaam: 'Jansen',
    adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
    telefoon: '06-12345678',
    email: 'jansen@mail.nl',
    ...deel,
  });

const adres = (straatHuisnummer: string, postcode: string, plaats: string): Adres => ({
  straatHuisnummer,
  postcode,
  plaats,
});

export const testset: Privacygeval[] = [
  // --- FE-032 en algemene invoer ---
  {
    omschrijving: 'FE-032: naam, telefoon, e-mail, adres en postcode in overig',
    klant: jansen({ adres: adres('Dorpsstraat 12', '', 'Veldhoven') }),
    invoer: maakInvoer({ overig: 'Bel Jansen op 06-12345678 of jansen@mail.nl, Dorpsstraat 12 5501 AB' }),
    verwacht: {
      nietInOpdracht: ['Jansen', '06-12345678', 'jansen@mail.nl', 'Dorpsstraat', '5501 AB'],
      welInOpdracht: ['Bel [KLANT_NAAM] op [VERWIJDERD] of [VERWIJDERD], [KLANT_ADRES] [VERWIJDERD]'],
    },
  },
  {
    omschrijving: 'naam in kleine letters in overig',
    klant: jansen(),
    invoer: maakInvoer({ overig: 'jansen wil graag voor de winter klaar zijn' }),
    verwacht: { nietInOpdracht: ['jansen'], welInOpdracht: ['[KLANT_NAAM] wil graag voor de winter'] },
  },
  {
    omschrijving: 'naam in hoofdletters in gewenste uitvoering',
    klant: jansen(),
    invoer: maakInvoer({ gewensteUitvoering: 'Overleggen met JANSEN over de steiger' }),
    verwacht: { nietInOpdracht: ['Jansen'], welInOpdracht: ['Overleggen met [KLANT_NAAM]'] },
  },
  {
    omschrijving: 'volledige naam met voornaam, voornaam los genoemd',
    klant: maakKlant({ voornaam: 'Piet', achternaam: 'de Groot' }),
    invoer: maakInvoer({ overig: 'Piet belt terug; de Groot is vaak niet thuis' }),
    verwacht: { nietInOpdracht: ['Piet', 'Groot'], welInOpdracht: ['[KLANT_NAAM] belt terug'] },
  },
  {
    omschrijving: 'OFM-038: voor- en achternaam samen en elk los genoemd',
    klant: maakKlant({ voornaam: 'Kees', achternaam: 'van Leeuwen' }),
    invoer: maakInvoer({ overig: 'Kees van Leeuwen is thuis; kees tekent, Leeuwen betaalt' }),
    verwacht: {
      nietInOpdracht: ['Kees', 'Leeuwen'],
      welInOpdracht: ['[KLANT_NAAM] is thuis; [KLANT_NAAM] tekent, [KLANT_NAAM] betaalt'],
    },
  },
  {
    omschrijving: 'OFM-038: voorletter met achternaam en alleen de voornaam',
    klant: maakKlant({ aanhef: 'mevr', voornaam: 'Marieke', achternaam: 'Dekker' }),
    invoer: maakInvoer({ gewensteUitvoering: 'Afspraak met M. Dekker of met Marieke zelf' }),
    verwacht: {
      nietInOpdracht: ['Dekker', 'Marieke'],
      welInOpdracht: ['Afspraak met M. [KLANT_NAAM] of met [KLANT_NAAM] zelf'],
    },
  },

  // --- tussenvoegsels ---
  {
    omschrijving: 'tussenvoegsel van der Berg',
    klant: maakKlant({ achternaam: 'van der Berg' }),
    invoer: maakInvoer({ overig: 'Dhr. Van der Berg wil ook de goot vervangen. Berg is de eigenaar.' }),
    verwacht: { nietInOpdracht: ['van der Berg', 'Berg'], welInOpdracht: ['de goot vervangen'] },
  },
  {
    omschrijving: 'tussenvoegsel de Vries, "de" elders blijft staan',
    klant: maakKlant({ aanhef: 'mevr', achternaam: 'de Vries' }),
    invoer: maakInvoer({ overig: 'Mevrouw de Vries is thuis, de sleutel ligt bij de buren' }),
    verwacht: { nietInOpdracht: ['Vries'], welInOpdracht: ['de sleutel ligt bij de buren'] },
  },
  {
    omschrijving: 'tussenvoegsel van den Heuvel',
    klant: maakKlant({ achternaam: 'van den Heuvel' }),
    invoer: maakInvoer({ gewensteUitvoering: 'Heuvel wil in het voorjaar' }),
    verwacht: { nietInOpdracht: ['Heuvel'], welInOpdracht: ['wil in het voorjaar'] },
  },
  {
    omschrijving: "tussenvoegsel 't Hart",
    klant: maakKlant({ aanhef: 'fam', achternaam: "'t Hart" }),
    invoer: maakInvoer({ overig: "Familie 't Hart heeft een hond; Hart vraagt om voorzichtigheid" }),
    verwacht: { nietInOpdracht: ['Hart'], welInOpdracht: ['heeft een hond'] },
  },
  {
    omschrijving: 'tussenvoegsel ter Horst',
    klant: maakKlant({ achternaam: 'ter Horst' }),
    invoer: maakInvoer({ overig: 'horst is bereikbaar na vijf uur' }),
    verwacht: { nietInOpdracht: ['Horst'], welInOpdracht: ['bereikbaar na vijf uur'] },
  },

  // --- dubbele achternamen ---
  {
    omschrijving: 'dubbele achternaam met koppelteken',
    klant: maakKlant({ achternaam: 'Jansen-de Vries' }),
    invoer: maakInvoer({ overig: 'Jansen-de Vries wil EPDM; mevrouw Vries belt nog' }),
    verwacht: { nietInOpdracht: ['Jansen', 'Vries'], welInOpdracht: ['wil EPDM'] },
  },
  {
    omschrijving: 'dubbele achternaam zonder koppelteken, los genoemd',
    klant: maakKlant({ achternaam: 'Bakker Smit' }),
    invoer: maakInvoer({ overig: 'smit is de contactpersoon, bakker de eigenaar' }),
    verwacht: { nietInOpdracht: ['Smit', 'Bakker'], welInOpdracht: ['is de contactpersoon'] },
  },

  // --- naam die ook een gewoon woord is ---
  {
    omschrijving: 'naam Visser',
    klant: maakKlant({ achternaam: 'Visser' }),
    invoer: maakInvoer({ overig: 'Visser wil sedum op het dak' }),
    verwacht: { nietInOpdracht: ['Visser'], welInOpdracht: ['wil sedum op het dak'] },
  },
  {
    omschrijving: 'naam Bakker in een dakvlaknaam',
    klant: maakKlant({ achternaam: 'Bakker' }),
    invoer: maakInvoer({ dakvlakken: [vlak('Dak Bakker'), vlak('Garage')] }),
    verwacht: { nietInOpdracht: ['Bakker'], welInOpdracht: ['Dak [KLANT_NAAM]', 'Garage'] },
  },
  {
    omschrijving: 'naam Smit in kleine letters',
    klant: maakKlant({ achternaam: 'Smit' }),
    invoer: maakInvoer({ overig: 'Graag eerst bellen met smit' }),
    verwacht: { nietInOpdracht: ['Smit'], welInOpdracht: ['Graag eerst bellen met [KLANT_NAAM]'] },
  },
  {
    omschrijving: 'naam Staal met ondergrond staal (label blijft staan)',
    klant: maakKlant({ achternaam: 'Piet Staal' }),
    invoer: maakInvoer({ ondergrond: 'staal', overig: 'Piet Staal is er de hele dag' }),
    verwacht: { nietInOpdracht: ['Piet Staal', 'Piet'], welInOpdracht: ['"ondergrond": "Staal"'] },
  },
  {
    omschrijving: 'naam Hout met ondergrond hout',
    klant: maakKlant({ aanhef: 'mevr', achternaam: 'Anna Hout' }),
    invoer: maakInvoer({ ondergrond: 'hout', gewensteUitvoering: 'Mevrouw Hout wil geen lawaai voor 8 uur' }),
    verwacht: {
      nietInOpdracht: ['Mevrouw Hout'],
      welInOpdracht: ['"ondergrond": "Hout"', 'Mevrouw [KLANT_NAAM]'],
    },
  },
  {
    omschrijving: 'naam met accent',
    klant: maakKlant({ achternaam: 'Müller' }),
    invoer: maakInvoer({ overig: 'müller heeft de tekening gestuurd' }),
    verwacht: { nietInOpdracht: ['Müller'], welInOpdracht: ['heeft de tekening gestuurd'] },
  },
  {
    omschrijving: 'naam met niet-Nederlandse tekens',
    klant: maakKlant({ voornaam: 'Ömer', achternaam: 'Yılmaz' }),
    invoer: maakInvoer({ overig: 'Yılmaz is de huurder, Ömer de zoon' }),
    verwacht: { nietInOpdracht: ['Yılmaz', 'Ömer'], welInOpdracht: ['is de huurder'] },
  },
  {
    omschrijving: 'naam als deel van een langer woord blijft staan',
    klant: maakKlant({ achternaam: 'Berg' }),
    invoer: maakInvoer({ overig: 'Materiaal in de berging opslaan' }),
    verwacht: { nietInOpdracht: [], welInOpdracht: ['berging'] },
  },

  // --- bedrijven ---
  {
    omschrijving: 'bedrijfsnaam met B.V.',
    klant: maakKlant({ aanhef: 'bedrijf', achternaam: 'Hendriks', bedrijfsnaam: 'Dakwerken Hendriks B.V.' }),
    invoer: maakInvoer({ overig: 'Factuur naar Dakwerken Hendriks B.V., t.a.v. Hendriks' }),
    verwacht: {
      nietInOpdracht: ['Dakwerken Hendriks', 'Hendriks', 'Dakwerken'],
      welInOpdracht: ['Factuur naar [KLANT_BEDRIJF]', '"bedrijf": "[KLANT_BEDRIJF]"', '"isBedrijf": true'],
    },
  },
  {
    omschrijving: 'bedrijfsnaam met BV zonder punten, alleen kernwoord genoemd',
    klant: maakKlant({ aanhef: 'bedrijf', achternaam: 'Kok', bedrijfsnaam: 'Installatiebedrijf Kok BV' }),
    invoer: maakInvoer({ overig: 'Het installatiebedrijf regelt de doorvoeren' }),
    verwacht: { nietInOpdracht: ['Installatiebedrijf'], welInOpdracht: ['regelt de doorvoeren'] },
  },
  {
    omschrijving: 'bedrijfsnaam met algemene woorden (bouw, en, beheer, groep)',
    klant: maakKlant({
      aanhef: 'bedrijf',
      voornaam: '',
      achternaam: 'Pietersen',
      bedrijfsnaam: 'Bouw en Beheer Groep Pietersen BV',
    }),
    invoer: maakInvoer({ overig: 'Bouw en beheer van het pand ligt bij Pietersen' }),
    verwacht: { nietInOpdracht: ['Pietersen'], welInOpdracht: ['Bouw en beheer van het pand'] },
  },
  {
    omschrijving: 'bedrijfsnaam met v.o.f. en tussenvoegsel',
    klant: maakKlant({ aanhef: 'bedrijf', achternaam: 'van Dijk', bedrijfsnaam: 'Van Dijk v.o.f.' }),
    invoer: maakInvoer({ overig: 'contact via van dijk vof' }),
    verwacht: { nietInOpdracht: ['Dijk'], welInOpdracht: ['contact via'] },
  },
  {
    omschrijving: 'bedrijf zonder bedrijfsnaam',
    klant: maakKlant({ aanhef: 'bedrijf', achternaam: 'Timmermans' }),
    invoer: maakInvoer({ overig: 'Timmermans komt kijken' }),
    verwacht: { nietInOpdracht: ['Timmermans'], welInOpdracht: ['"bedrijf": null', '"isBedrijf": true'] },
  },

  // --- adressen ---
  {
    omschrijving: 'huisnummer met letter',
    klant: maakKlant({ adres: adres('Kerkstraat 12a', '', 'Eersel') }),
    invoer: maakInvoer({ overig: 'Werk aan Kerkstraat 12a, achterzijde' }),
    verwacht: {
      nietInOpdracht: ['Kerkstraat 12a', 'Kerkstraat'],
      welInOpdracht: ['Werk aan [KLANT_ADRES], achterzijde'],
    },
  },
  {
    omschrijving: 'huisnummer met streepje',
    klant: maakKlant({ adres: adres('Molenweg 12-2', '', 'Eersel') }),
    invoer: maakInvoer({ overig: 'Bovenwoning Molenweg 12-2' }),
    verwacht: { nietInOpdracht: ['Molenweg 12-2', 'Molenweg'], welInOpdracht: ['Bovenwoning [KLANT_ADRES]'] },
  },
  {
    omschrijving: 'huisnummer met bis',
    klant: maakKlant({ adres: adres('Lindelaan 12 bis', '', 'Eersel') }),
    invoer: maakInvoer({ overig: 'Adres is Lindelaan 12 bis, zijingang' }),
    verwacht: { nietInOpdracht: ['Lindelaan'], welInOpdracht: ['[KLANT_ADRES], zijingang'] },
  },
  {
    omschrijving: 'straatnaam zonder huisnummer, kleine letters',
    klant: maakKlant({ adres: adres('Kerkstraat 3', '', 'Eersel') }),
    invoer: maakInvoer({ overig: 'Parkeren achter op de kerkstraat' }),
    verwacht: { nietInOpdracht: ['kerkstraat'], welInOpdracht: ['Parkeren achter op de [KLANT_ADRES]'] },
  },
  {
    omschrijving: 'straatnaam met twee woorden, dubbele spatie in de tekst',
    klant: maakKlant({ adres: adres('Grote Markt 7', '', 'Eersel') }),
    invoer: maakInvoer({ overig: 'Bereikbaar via de Grote  Markt' }),
    verwacht: { nietInOpdracht: ['Grote Markt'], welInOpdracht: ['Bereikbaar via de [KLANT_ADRES]'] },
  },

  // --- postcodes ---
  {
    omschrijving: 'klantpostcode met spatie',
    klant: maakKlant({ adres: adres('', '5611 AB', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'Postcode 5611 AB' }),
    verwacht: { nietInOpdracht: ['5611 AB', '5611AB'], welInOpdracht: ['Postcode [KLANT_POSTCODE]'] },
  },
  {
    omschrijving: 'klantpostcode zonder spatie in de tekst',
    klant: maakKlant({ adres: adres('', '5611 AB', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'Postcode 5611AB' }),
    verwacht: { nietInOpdracht: ['5611AB'], welInOpdracht: ['Postcode [KLANT_POSTCODE]'] },
  },
  {
    omschrijving: 'klantpostcode in kleine letters in de tekst',
    klant: maakKlant({ adres: adres('', '5611AB', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'postcode 5611ab' }),
    verwacht: { nietInOpdracht: ['5611ab'], welInOpdracht: ['postcode [KLANT_POSTCODE]'] },
  },
  {
    omschrijving: 'klantpostcode als kleine letters ingevuld',
    klant: maakKlant({ adres: adres('', '5611ab', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'Postcode 5611 AB' }),
    verwacht: { nietInOpdracht: ['5611 AB'], welInOpdracht: ['Postcode [KLANT_POSTCODE]'] },
  },
  {
    omschrijving: 'onbekende postcode',
    klant: jansen(),
    invoer: maakInvoer({ overig: 'Materiaal ophalen bij 1234 XY en 9876zz' }),
    verwacht: {
      nietInOpdracht: ['1234 XY', '9876zz'],
      welInOpdracht: ['ophalen bij [VERWIJDERD] en [VERWIJDERD]'],
    },
  },

  // --- telefoon ---
  {
    omschrijving: 'telefoon 06-12345678',
    klant: jansen({ telefoon: '06-12345678' }),
    invoer: maakInvoer({ overig: 'Nummer: 06-12345678' }),
    verwacht: { nietInOpdracht: ['06-12345678', '12345678'], welInOpdracht: ['Nummer: [VERWIJDERD]'] },
  },
  {
    omschrijving: 'telefoon 06 1234 5678',
    klant: jansen({ telefoon: '06-12345678' }),
    invoer: maakInvoer({ overig: 'Bel 06 1234 5678 na zessen' }),
    verwacht: {
      nietInOpdracht: ['06 1234 5678', '1234 5678'],
      welInOpdracht: ['Bel [VERWIJDERD] na zessen'],
    },
  },
  {
    omschrijving: 'telefoon +31 6 12345678',
    klant: jansen({ telefoon: '06-12345678' }),
    invoer: maakInvoer({ overig: 'Whatsapp: +31 6 12345678' }),
    verwacht: { nietInOpdracht: ['+31 6 12345678', '12345678'], welInOpdracht: ['Whatsapp: [VERWIJDERD]'] },
  },
  {
    omschrijving: 'telefoon 0031612345678',
    klant: jansen({ telefoon: '+31 6 12345678' }),
    invoer: maakInvoer({ overig: 'Tel 0031612345678' }),
    verwacht: { nietInOpdracht: ['0031612345678', '612345678'], welInOpdracht: ['Tel [VERWIJDERD]'] },
  },
  {
    omschrijving: 'vast nummer 040-1234567',
    klant: jansen({ telefoon: '040-1234567' }),
    invoer: maakInvoer({ overig: 'Overdag op 040-1234567' }),
    verwacht: { nietInOpdracht: ['040-1234567', '1234567'], welInOpdracht: ['Overdag op [VERWIJDERD]'] },
  },
  {
    omschrijving: 'vast nummer met haakjes en spaties (alleen via de cijfers herkenbaar)',
    klant: jansen({ telefoon: '040-1234567' }),
    invoer: maakInvoer({ overig: 'Overdag op (040) 123 45 67' }),
    verwacht: { nietInOpdracht: ['123 45 67'], welInOpdracht: ['Overdag op [VERWIJDERD]'] },
  },
  {
    omschrijving: 'telefoon van iemand anders',
    klant: jansen(),
    invoer: maakInvoer({ overig: 'Buurman: 06-87654321' }),
    verwacht: { nietInOpdracht: ['87654321'], welInOpdracht: ['Buurman: [VERWIJDERD]'] },
  },

  // --- e-mail en IBAN ---
  {
    omschrijving: 'e-mail met hoofdletters',
    klant: jansen({ email: 'Jansen@Mail.NL' }),
    invoer: maakInvoer({ overig: 'Mail naar JANSEN@MAIL.NL of Jansen@Mail.NL' }),
    verwacht: {
      nietInOpdracht: ['jansen@mail.nl', 'mail.nl'],
      welInOpdracht: ['Mail naar [VERWIJDERD] of [VERWIJDERD]'],
    },
  },
  {
    omschrijving: 'e-mail met punt in de naam',
    klant: jansen({ email: 'p.jansen@ziggo.nl' }),
    invoer: maakInvoer({ overig: 'Offerte mailen naar P.Jansen@ziggo.nl graag' }),
    verwacht: { nietInOpdracht: ['ziggo', 'p.jansen'], welInOpdracht: ['mailen naar [VERWIJDERD] graag'] },
  },
  {
    omschrijving: 'deel van het e-mailadres vóór de @ los genoemd',
    klant: maakKlant({ achternaam: 'Willems', email: 'dakliefhebber77@gmail.com' }),
    invoer: maakInvoer({ overig: 'Zijn gebruikersnaam is dakliefhebber77' }),
    verwacht: { nietInOpdracht: ['dakliefhebber77'], welInOpdracht: ['gebruikersnaam is [VERWIJDERD]'] },
  },
  {
    omschrijving: 'IBAN aaneengeschreven en met spaties',
    klant: jansen(),
    invoer: maakInvoer({ overig: 'Aanbetaling van NL91ABNA0417164300 of NL91 ABNA 0417 1643 00' }),
    verwacht: {
      nietInOpdracht: ['NL91ABNA0417164300', 'ABNA 0417'],
      welInOpdracht: ['Aanbetaling van [VERWIJDERD] of [VERWIJDERD]'],
    },
  },

  // --- plaatsnamen die een woord zijn (hoofdlettergevoelig, A-12) ---
  {
    omschrijving: 'plaats Best en het woord best',
    klant: maakKlant({ achternaam: 'Claes', adres: adres('Hoofdstraat 1', '5683 AA', 'Best') }),
    invoer: maakInvoer({ overig: 'Zo snel als het best kan, de klant woont in Best' }),
    verwacht: {
      nietInOpdracht: ['Best'],
      welInOpdracht: ['Zo snel als het best kan', 'woont in [KLANT_PLAATS]'],
    },
  },
  {
    omschrijving: 'plaats Son en het woord zon',
    klant: maakKlant({ achternaam: 'Claes', adres: adres('', '', 'Son') }),
    invoer: maakInvoer({ overig: 'Werk in Son, veel zon op het dak' }),
    verwacht: { nietInOpdracht: ['Son'], welInOpdracht: ['Werk in [KLANT_PLAATS]', 'veel zon op het dak'] },
  },
  {
    omschrijving: 'plaats Mierlo',
    klant: maakKlant({ achternaam: 'Claes', adres: adres('', '', 'Mierlo') }),
    invoer: maakInvoer({ gewensteUitvoering: 'Materiaal vanuit Mierlo aanvoeren' }),
    verwacht: { nietInOpdracht: ['Mierlo'], welInOpdracht: ['vanuit [KLANT_PLAATS] aanvoeren'] },
  },
  {
    omschrijving: 'plaats van twee woorden',
    klant: maakKlant({ achternaam: 'Claes', adres: adres('', '', 'Den Bosch') }),
    invoer: maakInvoer({ overig: 'Klus in Den  Bosch' }),
    verwacht: { nietInOpdracht: ['Den Bosch'], welInOpdracht: ['Klus in [KLANT_PLAATS]'] },
  },

  // --- dakvlaknamen ---
  {
    omschrijving: 'naam in een dakvlaknaam',
    klant: jansen(),
    invoer: maakInvoer({ dakvlakken: [vlak('Garage Jansen'), vlak('Uitbouw')] }),
    verwacht: { nietInOpdracht: ['Jansen'], welInOpdracht: ['Garage [KLANT_NAAM]', 'Uitbouw'] },
  },
  {
    omschrijving: 'naam in kleine letters in een dakvlaknaam',
    klant: maakKlant({ achternaam: 'de Vries' }),
    invoer: maakInvoer({ dakvlakken: [vlak('schuur vries')] }),
    verwacht: { nietInOpdracht: ['vries'], welInOpdracht: ['schuur [KLANT_NAAM]'] },
  },
  {
    omschrijving: 'adres in een dakvlaknaam',
    klant: jansen(),
    invoer: maakInvoer({ dakvlakken: [vlak('Dorpsstraat 12 voor')] }),
    verwacht: { nietInOpdracht: ['Dorpsstraat'], welInOpdracht: ['[KLANT_ADRES] voor'] },
  },

  // --- eenmalig materiaal (OFM-045: was "bedekking anders", dat wordt bij de omzetting zo'n materiaal) ---
  {
    omschrijving: 'naam in een eenmalig materiaal',
    klant: jansen(),
    invoer: maakInvoer({
      werkzaamheden: [
        {
          id: 'w1',
          sleutel: 'nieuwe_bedekking',
          eenmalig: null,
          aantal: 22.5,
          prijsCent: 0,
          perUur: false,
          notitie: '',
          materialen: [
            {
              id: 'm1',
              sleutel: null,
              eenmalig: { label: 'Zink zoals bij Jansen', eenheid: 'm²' },
              aantal: 22.5,
              prijsCent: null,
            },
          ],
          opties: [],
        },
      ],
    }),
    verwacht: { nietInOpdracht: ['Jansen'], welInOpdracht: ['Zink zoals bij [KLANT_NAAM]'] },
  },

  // --- aanpassingsinstructie ---
  {
    omschrijving: 'naam in een aanpassingsinstructie',
    klant: jansen(),
    invoer: maakInvoer(),
    instructie: 'Zet erbij dat meneer Jansen 5% korting krijgt',
    verwacht: { nietInOpdracht: ['Jansen'], welInOpdracht: ['meneer [KLANT_NAAM] 5% korting'] },
  },
  {
    omschrijving: 'telefoon en e-mail in een aanpassingsinstructie',
    klant: jansen(),
    invoer: maakInvoer(),
    instructie: 'Noem dat hij bereikbaar is op 06 12 34 56 78 en jansen@mail.nl',
    verwacht: {
      nietInOpdracht: ['56 78', 'jansen@mail.nl'],
      welInOpdracht: ['bereikbaar is op [VERWIJDERD] en [VERWIJDERD]'],
    },
  },
  {
    omschrijving: 'adres en plaats in een aanpassingsinstructie',
    klant: jansen(),
    invoer: maakInvoer(),
    instructie: 'Schrijf dat we op Dorpsstraat 12 in Veldhoven werken',
    verwacht: {
      nietInOpdracht: ['Dorpsstraat', 'Veldhoven'],
      welInOpdracht: ['op [KLANT_ADRES] in [KLANT_PLAATS] werken'],
    },
  },

  // --- werkadres ---
  {
    omschrijving: 'werkadres anders dan klantadres',
    klant: jansen({ heeftWerkadres: true, werkadres: adres('Industrieweg 5', '5652 AA', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'Werk op Industrieweg 5 in Eindhoven, 5652 AA; post naar Dorpsstraat 12' }),
    verwacht: {
      nietInOpdracht: ['Industrieweg', 'Eindhoven', '5652 AA', 'Dorpsstraat'],
      welInOpdracht: [
        'Werk op [WERK_ADRES] in [WERK_PLAATS], [VERWIJDERD]; post naar [KLANT_ADRES]',
        '"heeftWerkadres": true',
      ],
    },
  },
  {
    omschrijving: 'werkadres gelijk aan klantadres',
    klant: jansen({ heeftWerkadres: true, werkadres: adres('Dorpsstraat 12', '5501 AB', 'Veldhoven') }),
    invoer: maakInvoer({ overig: 'Werk op Dorpsstraat 12, Veldhoven' }),
    verwacht: {
      nietInOpdracht: ['Dorpsstraat', 'Veldhoven'],
      welInOpdracht: ['Werk op [KLANT_ADRES], [KLANT_PLAATS]'],
    },
  },
  {
    omschrijving: 'werkadres in dezelfde plaats, andere straat',
    klant: jansen({ heeftWerkadres: true, werkadres: adres('Schoolstraat 3', '5501 CD', 'Veldhoven') }),
    invoer: maakInvoer({ gewensteUitvoering: 'Eerst Schoolstraat 3, daarna thuis in Veldhoven' }),
    verwacht: {
      nietInOpdracht: ['Schoolstraat', 'Veldhoven'],
      welInOpdracht: ['Eerst [WERK_ADRES], daarna thuis in [KLANT_PLAATS]'],
    },
  },
  {
    omschrijving: 'werkplaats die een woord is (hoofdlettergevoelig)',
    klant: jansen({ heeftWerkadres: true, werkadres: adres('Nieuwstraat 1', '', 'Best') }),
    invoer: maakInvoer({ overig: 'Het best is om in Best te beginnen' }),
    verwacht: { nietInOpdracht: ['Best'], welInOpdracht: ['Het best is om in [WERK_PLAATS] te beginnen'] },
  },
  {
    omschrijving: 'werkadres ingevuld maar niet aangevinkt: wordt niet gebruikt',
    klant: jansen({ heeftWerkadres: false, werkadres: adres('Industrieweg 5', '', 'Eindhoven') }),
    invoer: maakInvoer({ overig: 'Werk in Veldhoven' }),
    verwacht: { nietInOpdracht: ['Veldhoven'], welInOpdracht: ['[KLANT_PLAATS]', '"heeftWerkadres": false'] },
  },

  // --- lege optionele velden ---
  {
    omschrijving: 'alleen een naam ingevuld',
    klant: maakKlant({ achternaam: 'Claes' }),
    invoer: maakInvoer({ overig: 'Claes wil de oude bitumen eraf', gewensteUitvoering: 'Na de bouwvak' }),
    verwacht: { nietInOpdracht: ['Claes'], welInOpdracht: ['wil de oude bitumen eraf', 'Na de bouwvak'] },
  },
  {
    omschrijving: 'volledig lege klant',
    klant: maakKlant(),
    invoer: maakInvoer({ overig: 'Gewone tekst zonder gegevens, 34 m2 en 3 hwa' }),
    verwacht: { nietInOpdracht: [], welInOpdracht: ['Gewone tekst zonder gegevens, 34 m2 en 3 hwa'] },
  },
  {
    omschrijving: 'lege invoer en lege dakvlaknaam',
    klant: jansen(),
    invoer: maakInvoer({ soortWerk: null, dakvlakken: [vlak('')] }),
    verwacht: { nietInOpdracht: ['Jansen', 'Veldhoven'] },
  },
  {
    omschrijving: 'korte naam (2 tekens) volledig vervangen',
    klant: maakKlant({ achternaam: 'Li' }),
    invoer: maakInvoer({ overig: 'Li wil een lichtkoepel' }),
    verwacht: { nietInOpdracht: ['Li'], welInOpdracht: ['[KLANT_NAAM] wil een lichtkoepel'] },
  },
];
