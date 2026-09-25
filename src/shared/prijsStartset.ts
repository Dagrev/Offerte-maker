import type { BtwTarief, Eenheid } from './types';

// Prijslijst-startset (TDO §9.3, V-13): de enige bron. `migreer()` voegt deze posten direct na
// migratie 001 in met `id = 'start-' + sleutel`, `volgorde = (index + 1) × 10` en `prijs_cent = NULL` (A-25).

export interface StartPost {
  sleutel: string;
  omschrijving: string;
  eenheid: Eenheid;
  btwTarief: BtwTarief;
}

export const PRIJS_STARTSET: readonly StartPost[] = [
  { sleutel: 'epdm_11', omschrijving: 'EPDM dakbedekking 1,1 mm', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'epdm_15', omschrijving: 'EPDM dakbedekking 1,5 mm', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'resitrix', omschrijving: 'Resitrix dakbedekking', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'bitumen', omschrijving: 'Bitumineuze dakbedekking (2-laags)', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'sloop', omschrijving: 'Slopen en afvoeren oude dakbedekking', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'dampremmer', omschrijving: 'Dampremmende laag', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'isolatie_80', omschrijving: 'Isolatie PIR 80 mm (Rc 3,5)', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'isolatie_100', omschrijving: 'Isolatie PIR 100 mm', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'isolatie_120', omschrijving: 'Isolatie PIR 120 mm', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'daktrim', omschrijving: 'Aluminium daktrim', eenheid: 'm¹', btwTarief: 21 },
  { sleutel: 'dakgoot_epdm', omschrijving: 'EPDM dakgoot', eenheid: 'm¹', btwTarief: 21 },
  { sleutel: 'hwa', omschrijving: 'Hemelwaterafvoer aansluiten', eenheid: 'stuk', btwTarief: 21 },
  { sleutel: 'noodoverloop', omschrijving: 'Noodoverloop plaatsen', eenheid: 'stuk', btwTarief: 21 },
  { sleutel: 'doorvoer', omschrijving: 'Dakdoorvoer inwerken', eenheid: 'stuk', btwTarief: 21 },
  {
    sleutel: 'lichtkoepel',
    omschrijving: 'Lichtkoepel of dakraam aansluiten',
    eenheid: 'stuk',
    btwTarief: 21,
  },
  { sleutel: 'grind', omschrijving: 'Grindafwerking', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'sedum', omschrijving: 'Sedumdak', eenheid: 'm²', btwTarief: 21 },
  { sleutel: 'steiger', omschrijving: 'Steiger en valbeveiliging', eenheid: 'post', btwTarief: 21 },
  { sleutel: 'hoogwerker', omschrijving: 'Hoogwerker', eenheid: 'dag', btwTarief: 21 },
  { sleutel: 'voorrijkosten', omschrijving: 'Voorrijkosten', eenheid: 'post', btwTarief: 21 },
  { sleutel: 'arbeid_uur', omschrijving: 'Arbeid (reparatie/onderhoud)', eenheid: 'uur', btwTarief: 21 },
  {
    sleutel: 'verzekerde_garantie',
    omschrijving: 'Verzekerde garantie 20 jaar',
    eenheid: 'post',
    btwTarief: 21,
  },
];
