import { AppFout } from '@shared/fouten';
import { maakSleutel } from '@shared/keuzelijsten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { KlusInvoer, WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import {
  gebruikteWerkzaamheden,
  materiaalPrijsSleutel,
  optiePrijsSleutel,
  prijsGroep,
  werkPrijsSleutel,
} from '@shared/werkzaamheden';
import { database, type Db } from '../verbinding';
import {
  materiaalRijen,
  optieOmschrijving,
  optieRijen,
  werkRijen,
  zetPrijspost,
  zetWerkzaamhedenStartset,
} from '../werkzaamhedenStartset';

// Werkzaamheden, opties en materialen (OFM-043, TDO §4.2 migratie 004, §6.2 `werkzaamheden:*`).
// Soorten werk zijn de keuzelijst `soortWerk` (OFM-034); de koppeling staat in `werkzaamheid_soortwerk`.
// Prijzen staan alleen in `prijsposten` (V-13) onder `werk:<s>`, `optie:<werkzaamheid>:<s>` en
// `mat:<s>`; deze module houdt omschrijving en eenheid van die posten gelijk aan het item.

const ongeldig = (melding: string) => new AppFout('VALIDATIE', melding);

const verwijderPrijspost = (db: Db, sleutel: string) =>
  db.prepare('DELETE FROM prijsposten WHERE sleutel = ?').run(sleutel);

function prijzen(db: Db): Map<string, number | null> {
  const rijen = db.prepare('SELECT sleutel, prijs_cent FROM prijsposten WHERE sleutel IS NOT NULL').all() as {
    sleutel: string;
    prijs_cent: number | null;
  }[];
  return new Map(rijen.filter((r) => prijsGroep(r.sleutel) !== null).map((r) => [r.sleutel, r.prijs_cent]));
}

// ---------- Gebruik ----------

interface Gebruik {
  werkzaamheden: Set<string>;
  opties: Set<string>;
  materialen: Set<string>;
}

/** Sleutels die in een niet-verwijderde offerte voorkomen (via `gebruikteWerkzaamheden`, OFM-044). */
function inGebruik(db: Db): Gebruik {
  const uit: Gebruik = { werkzaamheden: new Set(), opties: new Set(), materialen: new Set() };
  const alle = db.prepare('SELECT invoer_json FROM offertes WHERE verwijderd_op IS NULL').all() as {
    invoer_json: string;
  }[];
  for (const rij of alle) {
    // Zonder zod (snel bij duizenden offertes), zoals bij de keuzelijsten.
    const gebruikt = gebruikteWerkzaamheden(JSON.parse(rij.invoer_json) as KlusInvoer);
    for (const s of gebruikt.werkzaamheden) uit.werkzaamheden.add(s);
    for (const s of gebruikt.opties) uit.opties.add(s);
    for (const s of gebruikt.materialen) uit.materialen.add(s);
  }
  return uit;
}

// ---------- Lezen ----------

function haalSet(db: Db): WerkzaamhedenSet {
  const prijs = prijzen(db);
  const gebruik = inGebruik(db);
  const werken = werkRijen(db);
  const materialen = materiaalRijen(db);
  const opties = optieRijen(db);
  const soorten = db
    .prepare(
      "SELECT sleutel, label, verborgen FROM keuzeopties WHERE lijst = 'soortWerk' ORDER BY volgorde, id",
    )
    .all() as { sleutel: string; label: string; verborgen: number }[];
  const soortKoppelingen = db
    .prepare('SELECT werkzaamheid_id, soort_werk FROM werkzaamheid_soortwerk')
    .all() as {
    werkzaamheid_id: string;
    soort_werk: string;
  }[];
  const materiaalKoppelingen = db
    .prepare('SELECT werkzaamheid_id, materiaal_id, standaard FROM werkzaamheid_materiaal')
    .all() as { werkzaamheid_id: string; materiaal_id: string; standaard: number }[];
  const soortVolgorde = new Map(soorten.map((s, i) => [s.sleutel, i]));

  return {
    soortenWerk: soorten.map((soort) => ({
      sleutel: soort.sleutel,
      label: soort.label,
      verborgen: soort.verborgen === 1,
      werkzaamheden: werken
        .filter((w) =>
          soortKoppelingen.some((k) => k.werkzaamheid_id === w.id && k.soort_werk === soort.sleutel),
        )
        .map((w) => w.id),
    })),
    werkzaamheden: werken.map((w) => ({
      id: w.id,
      sleutel: w.sleutel,
      label: w.label,
      eenheid: w.eenheid,
      prijsCent: prijs.get(werkPrijsSleutel(w.sleutel)) ?? null,
      verborgen: w.verborgen === 1,
      standaard: w.standaard === 1,
      inGebruik: gebruik.werkzaamheden.has(w.sleutel),
      soortenWerk: soortKoppelingen
        .filter((k) => k.werkzaamheid_id === w.id)
        .map((k) => k.soort_werk)
        .sort((a, b) => (soortVolgorde.get(a) ?? 0) - (soortVolgorde.get(b) ?? 0)),
      opties: opties
        .filter((o) => o.werkzaamheid_id === w.id)
        .map((o) => ({
          id: o.id,
          sleutel: o.sleutel,
          label: o.label,
          eenheid: o.eenheid,
          prijsCent: prijs.get(optiePrijsSleutel(w.sleutel, o.sleutel)) ?? null,
          verborgen: o.verborgen === 1,
          inGebruik: gebruik.opties.has(o.sleutel),
        })),
      materialen: materialen.flatMap((m) => {
        const koppeling = materiaalKoppelingen.find(
          (k) => k.werkzaamheid_id === w.id && k.materiaal_id === m.id,
        );
        return koppeling ? [{ materiaalId: m.id, standaard: koppeling.standaard === 1 }] : [];
      }),
    })),
    materialen: materialen.map((m) => ({
      id: m.id,
      sleutel: m.sleutel,
      label: m.label,
      eenheid: m.eenheid,
      prijsCent: prijs.get(materiaalPrijsSleutel(m.sleutel)) ?? null,
      verborgen: m.verborgen === 1,
      standaard: m.standaard === 1,
      inGebruik: gebruik.materialen.has(m.sleutel),
    })),
  };
}

/** `werkzaamheden:haal`: soorten werk, werkzaamheden (met opties en materialen) en materialen. */
export function haalWerkzaamheden(): WerkzaamhedenSet {
  return haalSet(database());
}

// ---------- Bewaren ----------

function controleer(db: Db, invoer: WerkzaamhedenBewaar): void {
  const opties = invoer.werkzaamheden.flatMap((w) => w.opties);
  const labels = [...invoer.werkzaamheden, ...opties, ...invoer.materialen].map((i) => i.label.trim());
  if (labels.some((l) => l === '')) throw ongeldig(VALIDATIE_MELDINGEN.werkLeegLabel);

  const uniek = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    !uniek(invoer.werkzaamheden.map((w) => w.id)) ||
    !uniek(opties.map((o) => o.id)) ||
    !uniek(invoer.materialen.map((m) => m.id))
  ) {
    throw ongeldig(VALIDATIE_MELDINGEN.werkDubbel);
  }

  const soorten = new Set(
    (
      db.prepare("SELECT sleutel FROM keuzeopties WHERE lijst = 'soortWerk'").all() as { sleutel: string }[]
    ).map((r) => r.sleutel),
  );
  const materiaalIds = new Set(invoer.materialen.map((m) => m.id));
  const optieVan = new Map(optieRijen(db).map((o) => [o.id, o.werkzaamheid_id]));
  for (const werk of invoer.werkzaamheden) {
    if (werk.soortenWerk.some((s) => !soorten.has(s)))
      throw ongeldig(VALIDATIE_MELDINGEN.werkOnbekendeKoppeling);
    if (werk.materialen.some((m) => !materiaalIds.has(m.materiaalId))) {
      throw ongeldig(VALIDATIE_MELDINGEN.werkOnbekendeKoppeling);
    }
    // Een bestaande optie hoort bij zijn eigen werkzaamheid; verhuizen kan niet.
    if (werk.opties.some((o) => optieVan.has(o.id) && optieVan.get(o.id) !== werk.id)) {
      throw ongeldig(VALIDATIE_MELDINGEN.werkOnbekendeKoppeling);
    }
    if (!uniek(werk.materialen.map((m) => m.materiaalId))) throw ongeldig(VALIDATIE_MELDINGEN.werkDubbel);
    if (werk.materialen.filter((m) => m.standaard).length > 1) {
      throw ongeldig(VALIDATIE_MELDINGEN.werkEenStandaard);
    }
  }
}

/** Sleutels die al bezet zijn: werkzaamheden, opties en materialen, en de prijsposten van die groepen. */
function bezetteSleutels(db: Db): Set<string> {
  const bezet = new Set<string>();
  for (const tabel of ['werkzaamheden', 'werkzaamheid_opties', 'materialen']) {
    for (const r of db.prepare(`SELECT sleutel FROM ${tabel}`).all() as { sleutel: string }[])
      bezet.add(r.sleutel);
  }
  for (const r of db.prepare('SELECT sleutel FROM prijsposten WHERE sleutel IS NOT NULL').all() as {
    sleutel: string;
  }[]) {
    if (prijsGroep(r.sleutel) !== null) bezet.add(r.sleutel.split(':').at(-1) ?? '');
  }
  return bezet;
}

/**
 * `werkzaamheden:bewaar`: de hele set in de nieuwe volgorde. Een `id` die nog niet bestaat is een nieuw
 * item (sleutel uit het label, prijspost met de opgegeven prijs); een bestaand item dat ontbreekt wordt
 * verwijderd (met zijn prijspost), behalve als het in een niet-verwijderde offerte voorkomt. De
 * koppelingen met soorten werk en materialen worden vervangen. Geeft de bewaarde set terug.
 */
export function bewaarWerkzaamheden(invoer: WerkzaamhedenBewaar): WerkzaamhedenSet {
  const db = database();
  db.transaction(() => {
    controleer(db, invoer);
    const gebruik = inGebruik(db);
    const werken = new Map(werkRijen(db).map((r) => [r.id, r]));
    const materialen = new Map(materiaalRijen(db).map((r) => [r.id, r]));
    const opties = new Map(optieRijen(db).map((r) => [r.id, r]));
    const werkIds = new Set(invoer.werkzaamheden.map((w) => w.id));
    const optieIds = new Set(invoer.werkzaamheden.flatMap((w) => w.opties.map((o) => o.id)));
    const materiaalIds = new Set(invoer.materialen.map((m) => m.id));

    // Verwijderen (eerst controleren, dan pas iets wijzigen).
    const weg = {
      werken: [...werken.values()].filter((r) => !werkIds.has(r.id)),
      opties: [...opties.values()].filter((r) => !optieIds.has(r.id)),
      materialen: [...materialen.values()].filter((r) => !materiaalIds.has(r.id)),
    };
    if (
      weg.werken.some((r) => gebruik.werkzaamheden.has(r.sleutel)) ||
      weg.opties.some((r) => gebruik.opties.has(r.sleutel)) ||
      weg.materialen.some((r) => gebruik.materialen.has(r.sleutel))
    ) {
      throw ongeldig(VALIDATIE_MELDINGEN.werkInGebruik);
    }
    const sleutelVanWerk = (id: string) => werken.get(id)?.sleutel ?? '';
    for (const r of weg.opties) {
      verwijderPrijspost(db, optiePrijsSleutel(sleutelVanWerk(r.werkzaamheid_id), r.sleutel));
      db.prepare('DELETE FROM werkzaamheid_opties WHERE id = ?').run(r.id);
    }
    for (const r of weg.werken) {
      verwijderPrijspost(db, werkPrijsSleutel(r.sleutel));
      db.prepare('DELETE FROM werkzaamheden WHERE id = ?').run(r.id);
    }
    for (const r of weg.materialen) {
      verwijderPrijspost(db, materiaalPrijsSleutel(r.sleutel));
      db.prepare('DELETE FROM materialen WHERE id = ?').run(r.id);
    }

    const bezet = bezetteSleutels(db);
    const nieuweSleutel = (label: string) => {
      const sleutel = maakSleutel(label, bezet);
      bezet.add(sleutel);
      return sleutel;
    };

    // Materialen.
    const materiaalSleutel = new Map<string, string>();
    invoer.materialen.forEach((m, index) => {
      const label = m.label.trim();
      const rij = materialen.get(m.id);
      const sleutel = rij?.sleutel ?? nieuweSleutel(label);
      if (rij) {
        db.prepare(
          'UPDATE materialen SET label = ?, eenheid = ?, volgorde = ?, verborgen = ? WHERE id = ?',
        ).run(label, m.eenheid, (index + 1) * 10, m.verborgen ? 1 : 0, m.id);
      } else {
        db.prepare(
          'INSERT INTO materialen (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, ?, 0)',
        ).run(m.id, sleutel, label, m.eenheid, (index + 1) * 10, m.verborgen ? 1 : 0);
      }
      materiaalSleutel.set(m.id, sleutel);
      zetPrijspost(db, materiaalPrijsSleutel(sleutel), label, m.eenheid, m.prijsCent);
    });

    // Werkzaamheden met opties en koppelingen.
    invoer.werkzaamheden.forEach((w, index) => {
      const label = w.label.trim();
      const rij = werken.get(w.id);
      const sleutel = rij?.sleutel ?? nieuweSleutel(label);
      if (rij) {
        db.prepare(
          'UPDATE werkzaamheden SET label = ?, eenheid = ?, volgorde = ?, verborgen = ? WHERE id = ?',
        ).run(label, w.eenheid, (index + 1) * 10, w.verborgen ? 1 : 0, w.id);
      } else {
        db.prepare(
          'INSERT INTO werkzaamheden (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, ?, 0)',
        ).run(w.id, sleutel, label, w.eenheid, (index + 1) * 10, w.verborgen ? 1 : 0);
      }
      zetPrijspost(db, werkPrijsSleutel(sleutel), label, w.eenheid, w.prijsCent);

      w.opties.forEach((o, optieIndex) => {
        const optieLabel = o.label.trim();
        const optieRij = opties.get(o.id);
        const optieSleutel = optieRij?.sleutel ?? nieuweSleutel(optieLabel);
        if (optieRij) {
          db.prepare(
            'UPDATE werkzaamheid_opties SET label = ?, eenheid = ?, volgorde = ?, verborgen = ? WHERE id = ?',
          ).run(optieLabel, o.eenheid, (optieIndex + 1) * 10, o.verborgen ? 1 : 0, o.id);
        } else {
          db.prepare(
            'INSERT INTO werkzaamheid_opties (id, werkzaamheid_id, sleutel, label, eenheid, volgorde, verborgen) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).run(o.id, w.id, optieSleutel, optieLabel, o.eenheid, (optieIndex + 1) * 10, o.verborgen ? 1 : 0);
        }
        zetPrijspost(
          db,
          optiePrijsSleutel(sleutel, optieSleutel),
          optieOmschrijving(optieLabel, label),
          o.eenheid,
          o.prijsCent,
        );
      });

      db.prepare('DELETE FROM werkzaamheid_soortwerk WHERE werkzaamheid_id = ?').run(w.id);
      for (const soort of new Set(w.soortenWerk)) {
        db.prepare('INSERT INTO werkzaamheid_soortwerk (werkzaamheid_id, soort_werk) VALUES (?, ?)').run(
          w.id,
          soort,
        );
      }
      db.prepare('DELETE FROM werkzaamheid_materiaal WHERE werkzaamheid_id = ?').run(w.id);
      for (const m of w.materialen) {
        db.prepare(
          'INSERT INTO werkzaamheid_materiaal (werkzaamheid_id, materiaal_id, standaard) VALUES (?, ?, ?)',
        ).run(w.id, m.materiaalId, m.standaard ? 1 : 0);
      }
    });
  })();
  return haalSet(db);
}

// ---------- Startset ----------

/** `werkzaamheden:herstel` ("Herstel startset"). */
export function herstelWerkzaamheden(): void {
  const db = database();
  db.transaction(() => zetWerkzaamhedenStartset(db))();
}
