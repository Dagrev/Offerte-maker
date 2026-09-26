import type { MateriaalTags, Situatie } from '../../shared/types';
import {
  MATERIALEN_STARTSET,
  ONDERGROND_ONBEKEND,
  TAG_LIJST,
  WERKZAAMHEDEN_STARTSET,
  pastBijSituatie,
  type TagGroep,
} from '../../shared/werkzaamheden';
import type { Db } from './verbinding';

// Materiaaltags en materiaal per daksituatie (OFM-055, TDO §4.2 migratie 011, §9.7). Lezen en schrijven
// van `materiaal_tag` en `werkzaamheid_situatie_materiaal`, de starttags, de startsituaties en de omzetting
// van de regels van OFM-051. Zonder `database()` of Electron (relatieve imports), zodat `migreer()` en het
// seed-script dit met hun eigen verbinding kunnen gebruiken.

const GROEPEN: readonly TagGroep[] = ['ondergrond', 'bedekking'];

/** Sleutels van een keuzelijst in lijstvolgorde (ook de verborgen). */
function optieSleutels(db: Db, lijst: string): string[] {
  return (
    db.prepare('SELECT sleutel FROM keuzeopties WHERE lijst = ? ORDER BY volgorde, id').all(lijst) as {
      sleutel: string;
    }[]
  ).map((r) => r.sleutel);
}

/** Tags per materiaal-id; een materiaal zonder rijen in een lijst heeft daar `'alle'`. */
export function tagsVan(db: Db): Map<string, MateriaalTags> {
  const rijen = db
    .prepare(
      `SELECT t.materiaal_id, t.lijst, t.sleutel FROM materiaal_tag t
       JOIN keuzeopties k ON k.lijst = t.lijst AND k.sleutel = t.sleutel
       ORDER BY k.volgorde, k.id`,
    )
    .all() as { materiaal_id: string; lijst: string; sleutel: string }[];
  const uit = new Map<string, MateriaalTags>();
  for (const r of rijen) {
    const tags = uit.get(r.materiaal_id) ?? { ondergrond: 'alle', bedekking: 'alle' };
    const groep: TagGroep = r.lijst === TAG_LIJST.ondergrond ? 'ondergrond' : 'bedekking';
    const nu = tags[groep];
    uit.set(r.materiaal_id, { ...tags, [groep]: nu === 'alle' ? [r.sleutel] : [...nu, r.sleutel] });
  }
  return uit;
}

/** Schrijft de tags van één materiaal (`'alle'` = geen rijen); onbekende sleutels vervallen. */
export function schrijfTags(db: Db, materiaalId: string, tags: MateriaalTags): void {
  db.prepare('DELETE FROM materiaal_tag WHERE materiaal_id = ?').run(materiaalId);
  const invoegen = db.prepare(
    'INSERT OR IGNORE INTO materiaal_tag (materiaal_id, lijst, sleutel) VALUES (?, ?, ?)',
  );
  for (const groep of GROEPEN) {
    const waarde = tags[groep];
    if (waarde === 'alle') continue;
    const bekend = new Set(optieSleutels(db, TAG_LIJST[groep]));
    for (const sleutel of waarde)
      if (bekend.has(sleutel)) invoegen.run(materiaalId, TAG_LIJST[groep], sleutel);
  }
}

/**
 * Een nieuwe optie in de keuzelijst ondergrond of nieuwe dakbedekking staat bij bestaande materialen
 * standaard aan (ticket OFM-055): materialen met `'alle'` hebben hem vanzelf, materialen met eigen tags in
 * die lijst krijgen hem erbij. Andere lijsten: niets.
 */
export function voegTagOptieToe(db: Db, lijst: string, sleutel: string): void {
  if (lijst !== TAG_LIJST.ondergrond && lijst !== TAG_LIJST.bedekking) return;
  if (sleutel === ONDERGROND_ONBEKEND) return;
  db.prepare(
    `INSERT OR IGNORE INTO materiaal_tag (materiaal_id, lijst, sleutel)
     SELECT DISTINCT materiaal_id, lijst, ? FROM materiaal_tag WHERE lijst = ?`,
  ).run(sleutel, lijst);
}

/** Situaties per werkzaamheid-id, in lijstvolgorde; materialen in de volgorde van de materialenlijst. */
export function situatiesVan(db: Db): Map<string, Situatie[]> {
  const rijen = db
    .prepare(
      `SELECT s.werkzaamheid_id, s.ondergrond, s.bedekking, s.materiaal_id
       FROM werkzaamheid_situatie_materiaal s
       JOIN keuzeopties o ON o.lijst = 'ondergrond' AND o.sleutel = s.ondergrond
       JOIN keuzeopties b ON b.lijst = 'nieuweBedekking' AND b.sleutel = s.bedekking
       JOIN materialen m ON m.id = s.materiaal_id
       ORDER BY o.volgorde, o.id, b.volgorde, b.id, m.volgorde, m.id`,
    )
    .all() as { werkzaamheid_id: string; ondergrond: string; bedekking: string; materiaal_id: string }[];
  const uit = new Map<string, Situatie[]>();
  for (const r of rijen) {
    const lijst = uit.get(r.werkzaamheid_id) ?? [];
    const situatie = lijst.find((s) => s.ondergrond === r.ondergrond && s.bedekking === r.bedekking);
    if (situatie) situatie.materiaalIds.push(r.materiaal_id);
    else lijst.push({ ondergrond: r.ondergrond, bedekking: r.bedekking, materiaalIds: [r.materiaal_id] });
    uit.set(r.werkzaamheid_id, lijst);
  }
  return uit;
}

/**
 * Vervangt de situaties van één werkzaamheid. Een materiaal dat niet kiesbaar is of niet met zijn tags bij
 * de situatie past, of een ondergrond/bedekking die niet (meer) in de keuzelijst staat of "Weet ik niet"
 * is, vervalt stil (de tab meldt vervallen materialen zelf).
 */
export function schrijfSituaties(db: Db, werkzaamheidId: string, situaties: readonly Situatie[]): void {
  db.prepare('DELETE FROM werkzaamheid_situatie_materiaal WHERE werkzaamheid_id = ?').run(werkzaamheidId);
  const kiesbaar = new Set(
    (
      db
        .prepare('SELECT materiaal_id FROM werkzaamheid_materiaal WHERE werkzaamheid_id = ?')
        .all(werkzaamheidId) as {
        materiaal_id: string;
      }[]
    ).map((r) => r.materiaal_id),
  );
  const ondergronden = new Set(optieSleutels(db, TAG_LIJST.ondergrond));
  const bedekkingen = new Set(optieSleutels(db, TAG_LIJST.bedekking));
  const tags = tagsVan(db);
  const invoegen = db.prepare(
    'INSERT OR IGNORE INTO werkzaamheid_situatie_materiaal (werkzaamheid_id, ondergrond, bedekking, materiaal_id) VALUES (?, ?, ?, ?)',
  );
  for (const s of situaties) {
    if (
      s.ondergrond === ONDERGROND_ONBEKEND ||
      !ondergronden.has(s.ondergrond) ||
      !bedekkingen.has(s.bedekking)
    )
      continue;
    const invoer = { ondergrond: s.ondergrond, nieuweBedekking: s.bedekking };
    for (const id of s.materiaalIds) {
      if (!kiesbaar.has(id)) continue;
      if (!pastBijSituatie({ tags: tags.get(id) ?? { ondergrond: 'alle', bedekking: 'alle' } }, invoer))
        continue;
      invoegen.run(werkzaamheidId, s.ondergrond, s.bedekking, id);
    }
  }
}

/**
 * Starttags (`MATERIALEN_STARTSET[].tags`) bij de startmaterialen: bitumen alleen bitumen, EPDM alleen EPDM,
 * PVC alleen PVC; de andere startmaterialen alle tags. Na migratie 011 en bij **Herstel startset**. Staat
 * geen van de starttags (meer) in de keuzelijst, dan blijft de groep `'alle'`.
 */
export function zetStartTags(db: Db): void {
  for (const m of MATERIALEN_STARTSET) {
    const rij = db.prepare('SELECT id FROM materialen WHERE sleutel = ?').get(m.sleutel) as
      { id: string } | undefined;
    if (!rij) continue;
    schrijfTags(db, rij.id, {
      ondergrond: m.tags?.ondergrond ? [...m.tags.ondergrond] : 'alle',
      bedekking: m.tags?.bedekking ? [...m.tags.bedekking] : 'alle',
    });
  }
}

/** Een regel van OFM-051 (`daksysteem_materiaal`): `null` = alle. */
interface OudeRegel {
  ondergrond: string | null;
  bedekking: string | null;
  materiaalId: string;
}

/**
 * De situaties van één werkzaamheid bij het omzetten (migratie 011) en bij de startset: per combinatie
 * (alle ondergronden zonder "Weet ik niet" × alle bedekkingen, ook verborgen) eerst het kiesbare materiaal
 * met de sleutel van de bedekking (de voorselectie van OFM-050), dan de materialen van alle passende regels
 * van OFM-051, of zonder passende regel het oude standaardmateriaal; alleen wat met de tags past.
 * Geeft `null` als de werkzaamheid geen regels en geen bedekkingsmateriaal heeft (vinkje blijft uit).
 */
function omgezetteSituaties(db: Db, werkzaamheidId: string, regels: readonly OudeRegel[]): Situatie[] | null {
  const kiesbaar = db
    .prepare(
      `SELECT wm.materiaal_id AS id, wm.standaard, m.sleutel FROM werkzaamheid_materiaal wm
       JOIN materialen m ON m.id = wm.materiaal_id WHERE wm.werkzaamheid_id = ? ORDER BY m.volgorde, m.id`,
    )
    .all(werkzaamheidId) as { id: string; standaard: number; sleutel: string }[];
  const bedekkingen = optieSleutels(db, TAG_LIJST.bedekking);
  const bedekkingMateriaal = (b: string) => kiesbaar.find((m) => m.sleutel === b)?.id;
  if (regels.length === 0 && !bedekkingen.some((b) => bedekkingMateriaal(b) !== undefined)) return null;

  const ondergronden = optieSleutels(db, TAG_LIJST.ondergrond).filter((o) => o !== ONDERGROND_ONBEKEND);
  const standaard = kiesbaar.find((m) => m.standaard === 1)?.id;
  const tags = tagsVan(db);
  const past = (id: string, o: string, b: string) =>
    pastBijSituatie(
      { tags: tags.get(id) ?? { ondergrond: 'alle', bedekking: 'alle' } },
      {
        ondergrond: o,
        nieuweBedekking: b,
      },
    );
  return ondergronden.flatMap((o) =>
    bedekkingen.flatMap((b) => {
      const passend = regels.filter(
        (r) => (r.ondergrond === null || r.ondergrond === o) && (r.bedekking === null || r.bedekking === b),
      );
      const kandidaten = [
        bedekkingMateriaal(b),
        ...(passend.length > 0 ? passend.map((r) => r.materiaalId) : [standaard]),
      ];
      const ids = [...new Set(kandidaten)].filter(
        (id): id is string => id !== undefined && kiesbaar.some((m) => m.id === id) && past(id, o, b),
      );
      return ids.length > 0 ? [{ ondergrond: o, bedekking: b, materiaalIds: ids }] : [];
    }),
  );
}

function zetOm(db: Db, werkzaamheidId: string, regels: readonly OudeRegel[]): boolean {
  const situaties = omgezetteSituaties(db, werkzaamheidId, regels);
  if (situaties === null) return false;
  db.prepare('UPDATE werkzaamheden SET per_situatie = 1 WHERE id = ?').run(werkzaamheidId);
  schrijfSituaties(db, werkzaamheidId, situaties);
  return true;
}

/**
 * Startsituaties bij **Herstel startset** (en via de omzetting bij een nieuwe database): elke
 * startwerkzaamheid met een kiesbaar bedekkingsmateriaal (Nieuwe bedekking, Plaatselijk herstel) krijgt het
 * vinkje en per situatie dat materiaal plus het standaardmateriaal als dat past; de andere
 * startwerkzaamheden gaan terug naar zonder vinkje. Eigen werkzaamheden blijven zoals ze zijn.
 */
export function zetSituatieStartset(db: Db): void {
  for (const w of WERKZAAMHEDEN_STARTSET) {
    const rij = db.prepare('SELECT id FROM werkzaamheden WHERE sleutel = ?').get(w.sleutel) as
      { id: string } | undefined;
    if (!rij) continue;
    db.prepare('UPDATE werkzaamheden SET per_situatie = 0 WHERE id = ?').run(rij.id);
    db.prepare('DELETE FROM werkzaamheid_situatie_materiaal WHERE werkzaamheid_id = ?').run(rij.id);
    zetOm(db, rij.id, []);
  }
}

/**
 * Migratie 011 (`NA_MIGRATIE`): starttags, dan per werkzaamheid met regels van OFM-051 of een kiesbaar
 * bedekkingsmateriaal het vinkje en de situaties (`omgezetteSituaties`), en daarna `daksysteem_materiaal`
 * weg. Geeft het aantal omgezette werkzaamheden.
 */
export function zetDaksituatiesOm(db: Db): number {
  zetStartTags(db);
  const bestaat = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'daksysteem_materiaal'")
    .get();
  const regels = bestaat
    ? (db
        .prepare(
          'SELECT werkzaamheid_id, ondergrond, bedekking, materiaal_id FROM daksysteem_materiaal ORDER BY rowid',
        )
        .all() as {
        werkzaamheid_id: string;
        ondergrond: string | null;
        bedekking: string | null;
        materiaal_id: string;
      }[])
    : [];
  const werken = db.prepare('SELECT id FROM werkzaamheden ORDER BY volgorde, id').all() as { id: string }[];
  let aantal = 0;
  for (const w of werken) {
    const eigen = regels
      .filter((r) => r.werkzaamheid_id === w.id)
      .map((r) => ({ ondergrond: r.ondergrond, bedekking: r.bedekking, materiaalId: r.materiaal_id }));
    if (zetOm(db, w.id, eigen)) aantal += 1;
  }
  db.exec('DROP TABLE IF EXISTS daksysteem_materiaal');
  return aantal;
}
