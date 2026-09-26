import { volledigeNaam } from './labels';
import type { Adres, Dakvlak, Klant, KlusInvoer } from './types';

// Fabrieken voor een nieuwe offerte (TDO §5 laatste alinea, §6.2 "Gedrag `offerte:nieuw`") en de
// zoektekst (§8.2). Gebruikt door main (offerte:nieuw, bewaarInvoer, later definitief maken) en de
// wizard (nieuw dakvlak). `crypto.randomUUID` bestaat zowel in Node als in de renderer.

export const MAX_DAKVLAKKEN = 20;

function nieuwId(): string {
  return crypto.randomUUID();
}

export function leegAdres(): Adres {
  return { straatHuisnummer: '', postcode: '', plaats: '' };
}

/** Lege klant: aanhef `dhr`, lege strings, geen werkadres. */
export function legeKlant(): Klant {
  return {
    aanhef: 'dhr',
    voornaam: '',
    achternaam: '',
    bedrijfsnaam: '',
    adres: leegAdres(),
    telefoon: '',
    email: '',
    heeftWerkadres: false,
    werkadres: leegAdres(),
  };
}

/** Dakvlak `n` (vanaf 1) met de standaardnaam "Dakvlak n", lengte × breedte, nog zonder maten. */
export function nieuwDakvlak(n: number, id: string = nieuwId()): Dakvlak {
  return { id, naam: `Dakvlak ${n}`, modus: 'lxb', lengteM: null, breedteM: null, m2: null };
}

/** Lege `KlusInvoer` (§5): keuzes `null`, één leeg dakvlak, geen werkzaamheden (OFM-044), `false`. */
export function legeKlusInvoer(): KlusInvoer {
  return {
    soortWerk: null,
    soortDak: null,
    dakvlakken: [nieuwDakvlak(1)],
    huidigeBedekking: null,
    ondergrond: null,
    hoogte: '1',
    steigerNodig: false,
    garantieJaren: '10',
    werkzaamheden: [],
    gewensteUitvoering: '',
    overig: '',
  };
}

/** Kopie van de invoer van een bronofferte (FE-061): alles gelijk, dakvlakken met nieuwe id's. */
export function kopieerInvoer(bron: KlusInvoer): KlusInvoer {
  return { ...bron, dakvlakken: bron.dakvlakken.map((v) => ({ ...v, id: nieuwId() })) };
}

/** Zonder werkadres is het werkadres leeg (§5). */
export function normaliseerKlant(klant: Klant): Klant {
  return klant.heeftWerkadres ? klant : { ...klant, werkadres: leegAdres() };
}

/**
 * `lower(naam + ' ' + bedrijfsnaam + ' ' + plaats + ' ' + nummer)` (§8.2), met naam = voor- en
 * achternaam (OFM-038). Zo vindt "jan", "jansen" en "jan jansen" de klant; zonder voornaam (oude
 * offertes na migratie 003) is de zoektekst precies als vroeger.
 */
export function zoektekstVan(
  klant: Pick<Klant, 'voornaam' | 'achternaam' | 'bedrijfsnaam'> & { adres: Pick<Adres, 'plaats'> },
  nummer: string | null,
): string {
  return [volledigeNaam(klant), klant.bedrijfsnaam, klant.adres.plaats, nummer ?? ''].join(' ').toLowerCase();
}
