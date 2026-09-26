import type { Klant, OfferteLijstItem, Ordening, OverzichtResultaat, Status } from '@shared/types';
import { klantWeergave, volledigeNaam } from '@shared/labels';
import { weergaveNummer } from '@shared/nummering';
import { periodeVan, type Weergave } from '@shared/periode';
import { database } from '../verbinding';

// Lijsten van offertes (TDO §8.2, §6.3, V-14, V-16). Eigenaar: OFM-009. Alleen lezen.
// `lijstKolommen`, `LIJST_VOLGORDE` en `naarLijstItem` zijn ook bedoeld voor de prullenbaklijst
// (OFM-016), zodat een lijstrij overal hetzelfde wordt samengesteld.

/** Ruwe rij van een lijstquery. */
export interface LijstRij {
  id: string;
  nummer: string | null;
  status: Status;
  klant_json: string;
  omschrijving_kort: string;
  totaal_incl_cent: number | null;
  offertedatum: string;
  /** Versieletter van de laatste PDF, of NULL zonder PDF. */
  laatste_letter: string | null;
}

/**
 * Kolommen voor een lijstrij; `o` is de alias van `offertes`. De laatste PDF is de jongste; bij
 * gelijk tijdstip wint de hoogste letter ('' < 'b' < 'c').
 */
export const lijstKolommen = `
  o.id, o.nummer, o.status, o.klant_json, o.omschrijving_kort, o.totaal_incl_cent, o.offertedatum,
  (SELECT p.versieletter FROM pdf_bestanden p WHERE p.offerte_id = o.id
     ORDER BY p.aangemaakt_op DESC, p.versieletter DESC LIMIT 1) AS laatste_letter`;

/**
 * Sortering (§8.2, OFM-053). `datum`: nieuwste datum eerst, concepten (zonder volgnummer) vóór
 * genummerde. `nummer_op`/`nummer_af`: op jaar en volgnummer (werkt voor `JJJJ-NNN` en
 * `JJJJ-MM-DD-NNN`); offertes zonder nummer altijd onderaan, onderling nieuwste datum eerst.
 */
export function lijstVolgorde(ordening: Ordening = 'datum'): string {
  if (ordening === 'datum') return 'o.offertedatum DESC, o.volgnummer DESC NULLS FIRST, o.aangemaakt_op DESC';
  const richting = ordening === 'nummer_op' ? 'ASC' : 'DESC';
  return `o.nummer IS NULL, o.jaar ${richting}, o.volgnummer ${richting}, o.offertedatum DESC, o.aangemaakt_op DESC`;
}

/** De standaardsortering (datum), ook voor de prullenbak (OFM-016). */
export const LIJST_VOLGORDE = lijstVolgorde('datum');

/** OFM-053: filter en ordening van de lijst en de zoekresultaten. */
export interface LijstFilter {
  /** Leeg of weg = alle statussen. */
  statussen?: readonly Status[] | undefined;
  ordening?: Ordening | undefined;
}

/** `AND o.status IN (?, …)` met de parameters; leeg zonder filter. */
function statusVoorwaarde(statussen: readonly Status[] | undefined): { sql: string; params: Status[] } {
  const uniek = [...new Set(statussen ?? [])];
  if (uniek.length === 0) return { sql: '', params: [] };
  return { sql: `AND o.status IN (${uniek.map(() => '?').join(', ')})`, params: uniek };
}

const AANHEFFEN = new Set<Klant['aanhef']>(['dhr', 'mevr', 'fam', 'bedrijf']);

function tekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde : '';
}

/** Haalt uit `klant_json` alleen wat de lijst toont; persoonsgegevens blijven in main (§4.2). */
function klantVoorLijst(klantJson: string): { weergave: string; plaats: string } {
  let ruw: Record<string, unknown> = {};
  try {
    const gelezen: unknown = JSON.parse(klantJson);
    if (gelezen && typeof gelezen === 'object') ruw = gelezen as Record<string, unknown>;
  } catch {
    // Onleesbare klantgegevens: lege naam tonen in plaats van de hele lijst te laten falen.
  }
  const aanhef = ruw['aanhef'] as Klant['aanhef'];
  // OFM-038: voor- en achternaam; een rij van vóór migratie 003 met alleen `naam` telt als achternaam.
  const voornaam = tekst(ruw['voornaam']);
  const achternaam = tekst(ruw['achternaam'] ?? ruw['naam']);
  // OFM-046: tussenvoegsel; ontbreekt bij offertes van daarvoor.
  const tussenvoegsel = tekst(ruw['tussenvoegsel']);
  const bedrijfsnaam = tekst(ruw['bedrijfsnaam']);
  const adres =
    ruw['adres'] && typeof ruw['adres'] === 'object' ? (ruw['adres'] as Record<string, unknown>) : {};
  return {
    weergave: AANHEFFEN.has(aanhef)
      ? klantWeergave({ aanhef, voornaam, tussenvoegsel, achternaam, bedrijfsnaam })
      : volledigeNaam({ voornaam, tussenvoegsel, achternaam }),
    // De plaats van de klant (verplicht in wizardstap 1), ook als het werk op een ander adres is.
    plaats: tekst(adres['plaats']).trim(),
  };
}

export function naarLijstItem(rij: LijstRij): OfferteLijstItem {
  const klant = klantVoorLijst(rij.klant_json);
  return {
    id: rij.id,
    nummer: weergaveNummer(rij.nummer, rij.laatste_letter),
    status: rij.status,
    klantWeergave: klant.weergave,
    plaats: klant.plaats,
    omschrijvingKort: rij.omschrijving_kort,
    totaalInclCent: rij.totaal_incl_cent,
    offertedatum: rij.offertedatum,
  };
}

/** Telt mee in totalen en subtotalen: alles behalve concepten (§8.2, V-14). */
function bedragVoorTotaal(item: OfferteLijstItem): number {
  return item.status === 'concept' ? 0 : (item.totaalInclCent ?? 0);
}

/**
 * `overzicht:lijst`: offertes in de periode rond `datum`, met samenvatting en (bij jaar, geordend op
 * datum) maandgroepen. Lijst en telling volgen `filter.statussen` (OFM-053).
 */
export function lijstOverzicht(
  weergave: Weergave,
  datum: string,
  filter: LijstFilter = {},
): OverzichtResultaat {
  const periode = periodeVan(weergave, datum);
  const status = statusVoorwaarde(filter.statussen);
  const ordening = filter.ordening ?? 'datum';
  const rijen = database()
    .prepare(
      `SELECT ${lijstKolommen} FROM offertes o
       WHERE o.verwijderd_op IS NULL AND o.offertedatum BETWEEN ? AND ? ${status.sql}
       ORDER BY ${lijstVolgorde(ordening)}`,
    )
    .all(periode.van, periode.tot, ...status.params) as LijstRij[];
  const items = rijen.map(naarLijstItem);

  const samenvatting = {
    aantal: items.length,
    totaalCent: items.reduce((som, item) => som + bedragVoorTotaal(item), 0),
    aantalAkkoord: items.filter((item) => item.status === 'akkoord').length,
  };

  // Maandgroepen alleen bij datumordening: op nummer zouden de maanden door elkaar lopen.
  const groepen = weergave === 'jaar' && ordening === 'datum' ? groepeerPerMaand(items) : null;
  return { periode, items, groepen, samenvatting };
}

/** Maandgroepen in lijstvolgorde (nieuwste maand eerst); lege maanden ontbreken (FE-015). */
function groepeerPerMaand(items: OfferteLijstItem[]): NonNullable<OverzichtResultaat['groepen']> {
  const groepen: NonNullable<OverzichtResultaat['groepen']> = [];
  for (const item of items) {
    const maand = Number(item.offertedatum.slice(5, 7));
    let groep = groepen.at(-1);
    if (groep?.maand !== maand) {
      groep = { maand, label: periodeVan('maand', item.offertedatum).label, items: [], subtotaalCent: 0 };
      groepen.push(groep);
    }
    groep.items.push(item);
    groep.subtotaalCent += bedragVoorTotaal(item);
  }
  return groepen;
}

export const ZOEK_LIMIET = 200;

/** `%`, `_` en het escapeteken zelf letterlijk laten zoeken in `LIKE … ESCAPE '\'`. */
export function escapeLike(tekst: string): string {
  return tekst.replace(/[\\%_]/g, (teken) => `\\${teken}`);
}

/** `overzicht:zoek`: treffers uit alle periodes op `zoektekst` (naam, bedrijf, plaats, nummer). */
export function zoekOffertes(zoek: string, filter: LijstFilter = {}): OfferteLijstItem[] {
  const status = statusVoorwaarde(filter.statussen);
  const rijen = database()
    .prepare(
      `SELECT ${lijstKolommen} FROM offertes o
       WHERE o.verwijderd_op IS NULL AND o.zoektekst LIKE '%' || ? || '%' ESCAPE '\\' ${status.sql}
       ORDER BY ${lijstVolgorde(filter.ordening)}
       LIMIT ${ZOEK_LIMIET}`,
    )
    .all(escapeLike(zoek.toLowerCase()), ...status.params) as LijstRij[];
  return rijen.map(naarLijstItem);
}
