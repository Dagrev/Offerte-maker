import { berekenTotalen } from '../calc/bedragen';
import { aanhefRegel } from '../labels';
import { formatNummer } from '../nummering';
import { berekenGeldigTot } from '../periode';
import type { Bedrijf, Klant, OfferteInhoud, Opmaak, Teksten } from '../types';
import type { PdfModel } from './render';

// Vaste voorbeelddata voor het opmaakvoorbeeld in de tab Opmaak (TDO §12.5, V-22). Verzonnen
// gegevens; geen echte klant of echt bedrijf. Geen URL's met protocol (NFE-009-test op de uitvoer).

export const VOORBEELD_KLANT: Klant = {
  aanhef: 'fam',
  naam: 'De Vries',
  bedrijfsnaam: '',
  adres: { straatHuisnummer: 'Lindelaan 12', postcode: '5611 AB', plaats: 'Eindhoven' },
  telefoon: '',
  email: '',
  heeftWerkadres: false,
  werkadres: { straatHuisnummer: '', postcode: '', plaats: '' },
};

/** Gebruikt als de eigenaar nog geen bedrijfsnaam heeft ingevuld (V-22). */
export const VOORBEELD_BEDRIJF: Bedrijf = {
  naam: 'Dakdekkersbedrijf Voorbeeld',
  contactpersoon: 'J. Voorbeeld',
  adres: 'Industrieweg 4',
  postcode: '5600 AA',
  plaats: 'Eindhoven',
  telefoon: '040 123 45 67',
  email: 'info@voorbeelddak.nl',
  website: 'www.voorbeelddak.nl',
  kvk: '12345678',
  btwNummer: 'NL001234567B01',
  iban: 'NL00 BANK 0123 4567 89',
  logoBestandId: null,
};

export const VOORBEELD_INHOUD: OfferteInhoud = {
  titel: 'Offerte vervangen dakbedekking plat dak',
  inleiding:
    'Naar aanleiding van uw aanvraag doen wij u hierbij graag een offerte toekomen voor de onderstaande werkzaamheden.',
  werkomschrijving: [
    'Bestaande dakbedekking verwijderen en afvoeren.',
    'Ondergrond controleren en waar nodig herstellen.',
    'Isolatie aanbrengen, 100 mm PIR.',
    'Nieuwe dakbedekking aanbrengen: EPDM 1,5 mm.',
    'Daktrim en hemelwaterafvoeren vernieuwen.',
  ],
  regels: [
    {
      id: 'voorbeeld-1',
      omschrijving: 'Verwijderen en afvoeren bestaande dakbedekking',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 1250,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
    {
      id: 'voorbeeld-2',
      omschrijving: 'Isolatie PIR 100 mm',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 3200,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
    {
      id: 'voorbeeld-3',
      omschrijving: 'EPDM 1,5 mm, volledig verkleefd',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 4500,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
    {
      id: 'voorbeeld-4',
      omschrijving: 'Aluminium daktrim',
      aantalHonderdsten: 2400,
      eenheid: 'm¹',
      prijsCent: 2750,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
    {
      id: 'voorbeeld-5',
      omschrijving: 'Hemelwaterafvoer vernieuwen',
      aantalHonderdsten: 200,
      eenheid: 'stuk',
      prijsCent: 8500,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
  ],
  uitvoering:
    'De werkzaamheden duren naar verwachting twee werkdagen. Wij plannen de uitvoering in overleg, bij droog weer.',
  opmerkingen: '',
  afsluiting:
    'Wij vertrouwen erop u hiermee een passende aanbieding te hebben gedaan. Heeft u vragen, neem dan gerust contact met ons op.',
  controlepunten: [],
};

export interface OpmaakVoorbeeldInvoer {
  /** De echte bedrijfsgegevens; zonder naam valt het voorbeeld terug op `VOORBEELD_BEDRIJF` (V-22). */
  bedrijf: Bedrijf;
  logoDataUri: string | null;
  opmaak: Opmaak;
  fontCss: string;
  teksten: Teksten;
  /** `YYYY-MM-DD`, meestal `vandaag()`. */
  vandaag: string;
}

/**
 * Het `PdfModel` voor het opmaakvoorbeeld (`instellingen:opmaakVoorbeeld`, OFM-018): vaste klant en
 * inhoud, echte bedrijfsgegevens en logo als de bedrijfsnaam is ingevuld, anders het voorbeeldbedrijf
 * zonder logo. Met een nummer, zodat het voorbeeld niet onder een CONCEPT-watermerk verdwijnt.
 */
export function opmaakVoorbeeldModel(invoer: OpmaakVoorbeeldInvoer): PdfModel {
  const echt = invoer.bedrijf.naam.trim() !== '';
  return {
    bedrijf: echt ? invoer.bedrijf : VOORBEELD_BEDRIJF,
    logoDataUri: echt ? invoer.logoDataUri : null,
    opmaak: invoer.opmaak,
    fontCss: invoer.fontCss,
    klant: VOORBEELD_KLANT,
    nummer: formatNummer(invoer.vandaag, 1),
    offertedatum: invoer.vandaag,
    geldigTot: berekenGeldigTot(invoer.vandaag, invoer.teksten.geldigheidDagen),
    aanhefregel: aanhefRegel(VOORBEELD_KLANT),
    inhoud: VOORBEELD_INHOUD,
    totalen: berekenTotalen(VOORBEELD_INHOUD.regels),
    garantietekst: invoer.teksten.garantie10,
    betalingsvoorwaarden: invoer.teksten.betalingsvoorwaarden,
    geldigheidDagen: invoer.teksten.geldigheidDagen,
    voetnoot: invoer.teksten.voetnoot,
  };
}
