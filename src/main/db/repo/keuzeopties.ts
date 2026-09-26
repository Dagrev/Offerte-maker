import { randomUUID } from 'node:crypto';
import { AppFout } from '@shared/fouten';
import {
  KEUZE_LIJSTEN,
  KEUZE_STARTSET,
  STANDAARDKEUZE_STARTSET,
  gebruikteSleutels,
  maakSleutel,
  isZinLijst,
  startZin,
  VRAAGT_BEDEKKING_STARTSET,
  type KeuzeBasis,
  type KeuzeLijst,
  type Keuzes,
  type Standaardkeuzes,
} from '@shared/keuzelijsten';
import { omschrijvingKort } from '@shared/omschrijvingKort';
import { klusInvoerSchema } from '@shared/schemas';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { KlusInvoer, Keuzelijsten, Keuzeoptie } from '@shared/types';
import { database } from '../verbinding';

// Keuzelijsten van de wizard (OFM-034, TDO §4.2 `keuzeopties`, §6.2 `keuzelijsten:*`). Sleutels zijn
// stabiel; hernoemen verandert alleen het label. Een optie die in een niet-verwijderde offerte
// voorkomt kan alleen verborgen worden; de standaardkeuze van een nieuwe offerte (OFM-049, kolom
// `standaardkeuze`, hoogstens één per lijst) ook dat niet.

interface KeuzeRij {
  id: string;
  lijst: KeuzeLijst;
  sleutel: string;
  label: string;
  volgorde: number;
  verborgen: number;
  standaard: number;
  standaardkeuze: number;
  /** OFM-050 (migratie 009) */
  zin: string;
  vraagt_bedekking: number;
}

function rijen(lijst?: KeuzeLijst): KeuzeRij[] {
  const db = database();
  return (
    lijst === undefined
      ? db.prepare('SELECT * FROM keuzeopties ORDER BY lijst, volgorde, id').all()
      : db.prepare('SELECT * FROM keuzeopties WHERE lijst = ? ORDER BY volgorde, id').all(lijst)
  ) as KeuzeRij[];
}

/**
 * Alle opties (ook verborgen) per lijst in volgorde, met sleutel en label (de bron voor labels) en sinds
 * OFM-050 de zin en het vinkje "vraagt nieuwe dakbedekking".
 */
export function haalKeuzes(): Keuzes {
  const uit = Object.fromEntries(KEUZE_LIJSTEN.map((l) => [l, [] as KeuzeBasis[]]));
  for (const rij of rijen()) {
    uit[rij.lijst]?.push({
      sleutel: rij.sleutel,
      label: rij.label,
      zin: rij.zin,
      vraagtBedekking: rij.vraagt_bedekking === 1,
    });
  }
  return uit as unknown as Keuzes;
}

/** De ingestelde standaardkeuzes (OFM-049): de beginwaarden van een nieuwe offerte (`offerte:nieuw`). */
export function haalStandaardkeuzes(): Standaardkeuzes {
  const alle = database()
    .prepare('SELECT lijst, sleutel FROM keuzeopties WHERE standaardkeuze = 1')
    .all() as { lijst: KeuzeLijst; sleutel: string }[];
  const uit: Standaardkeuzes = {};
  for (const { lijst, sleutel } of alle) uit[lijst] = sleutel;
  return uit;
}

/** Invoer van alle niet-verwijderde offertes (voor "in gebruik"). */
function invoerVanOffertes(): KlusInvoer[] {
  const alle = database().prepare('SELECT invoer_json FROM offertes WHERE verwijderd_op IS NULL').all() as {
    invoer_json: string;
  }[];
  // Zonder zod (snel bij duizenden offertes).
  return alle.map((r) => JSON.parse(r.invoer_json) as KlusInvoer);
}

/** Per lijst de sleutels die in een niet-verwijderde offerte voorkomen. */
function sleutelsInGebruik(): Record<KeuzeLijst, Set<string>> {
  const uit = Object.fromEntries(KEUZE_LIJSTEN.map((l) => [l, new Set<string>()])) as Record<
    KeuzeLijst,
    Set<string>
  >;
  for (const invoer of invoerVanOffertes()) {
    const gebruikt = gebruikteSleutels(invoer);
    for (const lijst of KEUZE_LIJSTEN) for (const s of gebruikt[lijst]) uit[lijst].add(s);
  }
  return uit;
}

function naarOptie(rij: KeuzeRij, inGebruik: Set<string>): Keuzeoptie {
  return {
    id: rij.id,
    sleutel: rij.sleutel,
    label: rij.label,
    verborgen: rij.verborgen === 1,
    standaard: rij.standaard === 1,
    standaardkeuze: rij.standaardkeuze === 1,
    zin: rij.zin,
    vraagtBedekking: rij.vraagt_bedekking === 1,
    inGebruik: inGebruik.has(rij.sleutel),
  };
}

/** `keuzelijsten:haal`: per lijst de opties in volgorde, met `standaardkeuze` en `inGebruik`. */
export function lijstKeuzeopties(): Keuzelijsten {
  const gebruik = sleutelsInGebruik();
  const uit = Object.fromEntries(KEUZE_LIJSTEN.map((l) => [l, [] as Keuzeoptie[]])) as Keuzelijsten;
  for (const rij of rijen()) uit[rij.lijst].push(naarOptie(rij, gebruik[rij.lijst]));
  return uit;
}

function lijstOpties(lijst: KeuzeLijst): Keuzeoptie[] {
  const gebruik = sleutelsInGebruik()[lijst];
  return rijen(lijst).map((rij) => naarOptie(rij, gebruik));
}

export interface OptieWijziging {
  /** Leeg = nieuwe optie. */
  id: string;
  label: string;
  verborgen: boolean;
  /** OFM-049: hoogstens één per lijst; geen enkele = geen standaard. */
  standaardkeuze: boolean;
  /** OFM-050: "Zin in de offerte"; weglaten = niet wijzigen. */
  zin?: string | undefined;
  /** OFM-050: alleen bij soort werk; weglaten = niet wijzigen. */
  vraagtBedekking?: boolean | undefined;
}

/** Sleutels die al bezet zijn: alle keuzeopties (alle lijsten) en alle prijsposten. */
function bezetteSleutels(): Set<string> {
  const db = database();
  const keuze = db.prepare('SELECT sleutel FROM keuzeopties').all() as { sleutel: string }[];
  const prijs = db.prepare('SELECT sleutel FROM prijsposten WHERE sleutel IS NOT NULL').all() as {
    sleutel: string;
  }[];
  return new Set([...keuze, ...prijs].map((r) => r.sleutel));
}

/**
 * Rekent `omschrijving_kort` van alle offertes opnieuw uit (na hernoemen in soort werk),
 * zodat lijst en zoekresultaten de nieuwe naam tonen.
 */
function herberekenOmschrijvingen(): void {
  const db = database();
  const keuzes = haalKeuzes();
  const alle = db.prepare('SELECT id, invoer_json, omschrijving_kort FROM offertes').all() as {
    id: string;
    invoer_json: string;
    omschrijving_kort: string;
  }[];
  const bijwerken = db.prepare('UPDATE offertes SET omschrijving_kort = ? WHERE id = ?');
  for (const rij of alle) {
    const nieuw = omschrijvingKort(klusInvoerSchema.parse(JSON.parse(rij.invoer_json)), keuzes);
    if (nieuw !== rij.omschrijving_kort) bijwerken.run(nieuw, rij.id);
  }
}

const ongeldig = (melding: string = VALIDATIE_MELDINGEN.ongeldigeInvoer) => new AppFout('VALIDATIE', melding);

/**
 * `keuzelijsten:bewaar`: de hele lijst in de nieuwe volgorde. Lege `id` = nieuwe optie (sleutel uit het
 * label; sinds OFM-045 heeft geen enkele lijst nog een eigen prijspost). Een bestaande
 * optie die ontbreekt wordt verwijderd, maar alleen als hij niet de (bewaarde) standaardkeuze is en in
 * geen enkele niet-verwijderde offerte voorkomt. De standaardkeuze (OFM-049) staat per optie in de lijst:
 * hoogstens één, en die mag niet verborgen zijn. Geeft de bewaarde lijst terug (met de id's van nieuwe
 * opties).
 */
export function bewaarKeuzelijst(lijst: KeuzeLijst, opties: readonly OptieWijziging[]): Keuzeoptie[] {
  const db = database();
  db.transaction(() => {
    const bestaand = new Map(rijen(lijst).map((r) => [r.id, r]));
    const ids = opties.filter((o) => o.id !== '').map((o) => o.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => !bestaand.has(id))) throw ongeldig();

    if (opties.filter((o) => o.standaardkeuze).length > 1) throw ongeldig();

    const inGebruik = sleutelsInGebruik()[lijst];
    for (const rij of bestaand.values()) {
      if (ids.includes(rij.id)) continue;
      if (rij.standaardkeuze === 1) throw ongeldig(VALIDATIE_MELDINGEN.keuzeVast);
      if (inGebruik.has(rij.sleutel)) throw ongeldig(VALIDATIE_MELDINGEN.keuzeInGebruik);
    }
    if (opties.some((o) => o.standaardkeuze && o.verborgen)) throw ongeldig(VALIDATIE_MELDINGEN.keuzeVast);

    let labelsGewijzigd = false;
    for (const rij of bestaand.values()) {
      if (!ids.includes(rij.id)) {
        db.prepare('DELETE FROM keuzeopties WHERE id = ?').run(rij.id);
        labelsGewijzigd = true;
      }
    }
    const bezet = bezetteSleutels();
    // Eerst alle standaardkeuzes van de lijst uit: de unieke index laat er hoogstens één toe.
    db.prepare('UPDATE keuzeopties SET standaardkeuze = 0 WHERE lijst = ?').run(lijst);
    const bijwerken = db.prepare(
      'UPDATE keuzeopties SET label = ?, volgorde = ?, verborgen = ?, standaardkeuze = ?, zin = ?, vraagt_bedekking = ? WHERE id = ?',
    );
    const invoegen = db.prepare(
      'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze, zin, vraagt_bedekking) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
    );
    // OFM-050: de zin alleen in de lijsten van de beginsituatie, het vinkje alleen bij soort werk.
    const zinVan = (optie: OptieWijziging, oud: string) =>
      isZinLijst(lijst) ? (optie.zin?.trim() ?? oud) : '';
    const vraagtVan = (optie: OptieWijziging, oud: number) =>
      lijst === 'soortWerk' ? (optie.vraagtBedekking === undefined ? oud : optie.vraagtBedekking ? 1 : 0) : 0;
    opties.forEach((optie, index) => {
      const volgorde = (index + 1) * 10;
      const label = optie.label.trim();
      const rij = bestaand.get(optie.id);
      if (rij) {
        if (rij.label !== label) labelsGewijzigd = true;
        bijwerken.run(
          label,
          volgorde,
          optie.verborgen ? 1 : 0,
          optie.standaardkeuze ? 1 : 0,
          zinVan(optie, rij.zin),
          vraagtVan(optie, rij.vraagt_bedekking),
          rij.id,
        );
        return;
      }
      const sleutel = maakSleutel(label, bezet);
      bezet.add(sleutel);
      invoegen.run(
        randomUUID(),
        lijst,
        sleutel,
        label,
        volgorde,
        optie.verborgen ? 1 : 0,
        optie.standaardkeuze ? 1 : 0,
        zinVan(optie, ''),
        vraagtVan(optie, 0),
      );
    });
    if (labelsGewijzigd && lijst === 'soortWerk') herberekenOmschrijvingen();
  })();
  return lijstOpties(lijst);
}

/**
 * `keuzelijsten:herstel` ("Herstel standaardlijst"): de opties uit de startset weer met hun
 * oorspronkelijke label, zichtbaar en in de oorspronkelijke volgorde (verwijderde worden teruggezet).
 * Eigen opties blijven bestaan, achter de standaardopties. De standaardkeuze wordt weer die van de
 * startset (`STANDAARDKEUZE_STARTSET`, OFM-049), of geen als de startset er geen heeft.
 */
export function herstelKeuzelijst(lijst: KeuzeLijst): void {
  const db = database();
  db.transaction(() => {
    const start = KEUZE_STARTSET[lijst];
    const standaardkeuze = STANDAARDKEUZE_STARTSET[lijst];
    db.prepare('UPDATE keuzeopties SET standaardkeuze = 0 WHERE lijst = ?').run(lijst);
    const opSleutel = new Map(rijen(lijst).map((r) => [r.sleutel, r]));
    start.forEach((optie, index) => {
      const volgorde = (index + 1) * 10;
      const rij = opSleutel.get(optie.sleutel);
      const isStandaard = optie.sleutel === standaardkeuze ? 1 : 0;
      // OFM-050: ook de startzin en het vinkje "vraagt nieuwe dakbedekking" terug.
      const zin = startZin(lijst, optie.sleutel);
      const vraagt = lijst === 'soortWerk' && VRAAGT_BEDEKKING_STARTSET.includes(optie.sleutel) ? 1 : 0;
      if (rij) {
        db.prepare(
          'UPDATE keuzeopties SET label = ?, volgorde = ?, verborgen = 0, standaard = 1, standaardkeuze = ?, zin = ?, vraagt_bedekking = ? WHERE id = ?',
        ).run(optie.label, volgorde, isStandaard, zin, vraagt, rij.id);
      } else {
        db.prepare(
          'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze, zin, vraagt_bedekking) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)',
        ).run(
          `start-${lijst}-${optie.sleutel}`,
          lijst,
          optie.sleutel,
          optie.label,
          volgorde,
          isStandaard,
          zin,
          vraagt,
        );
      }
    });
    const startSleutels = new Set(start.map((o) => o.sleutel));
    let volgorde = (start.length + 1) * 10;
    for (const rij of rijen(lijst)) {
      if (startSleutels.has(rij.sleutel)) continue;
      db.prepare('UPDATE keuzeopties SET volgorde = ? WHERE id = ?').run(volgorde, rij.id);
      volgorde += 10;
    }
    if (lijst === 'soortWerk') herberekenOmschrijvingen();
  })();
}

/**
 * Controle bij `offerte:bewaarInvoer` (OFM-034): elke keuze moet een bestaande optie van zijn lijst
 * zijn, of de waarde die al in deze offerte stond (een inmiddels verwijderde optie gaat niet verloren).
 */
export function controleerKeuzes(invoer: KlusInvoer, vorige: KlusInvoer | null): void {
  const bekend = new Map<KeuzeLijst, Set<string>>(KEUZE_LIJSTEN.map((l) => [l, new Set<string>()]));
  for (const rij of rijen()) bekend.get(rij.lijst)?.add(rij.sleutel);
  const nu = gebruikteSleutels(invoer);
  const eerder = vorige === null ? null : gebruikteSleutels(vorige);
  for (const lijst of KEUZE_LIJSTEN) {
    for (const sleutel of nu[lijst]) {
      if (bekend.get(lijst)?.has(sleutel) || eerder?.[lijst].includes(sleutel)) continue;
      throw ongeldig(VALIDATIE_MELDINGEN.onbekendeKeuze);
    }
  }
}
