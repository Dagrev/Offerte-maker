import { randomUUID } from 'node:crypto';
import type { Eenheid } from '../../shared/types';
import {
  MATERIALEN_STARTSET,
  WERKZAAMHEDEN_STARTSET,
  materiaalPrijsSleutel,
  optiePrijsSleutel,
  werkPrijsSleutel,
} from '../../shared/werkzaamheden';
import type { Db } from './verbinding';

// Startset van de werkzaamheden, opties en materialen (OFM-043, V-13) en het bijhouden van hun
// prijsposten. Los van de repository en zonder `database()` of Electron, zodat `migreer()` en het
// seed-script (scripts/seedGegevens.ts) dit met hun eigen verbinding kunnen gebruiken (daarom relatieve
// imports: tsx kent de alias `@shared` niet).

export interface ItemRij {
  id: string;
  sleutel: string;
  label: string;
  eenheid: Eenheid;
  volgorde: number;
  verborgen: number;
  standaard: number;
}

export interface OptieRij {
  id: string;
  werkzaamheid_id: string;
  sleutel: string;
  label: string;
  eenheid: Eenheid;
  volgorde: number;
  verborgen: number;
}

export const werkRijen = (db: Db) =>
  db.prepare('SELECT * FROM werkzaamheden ORDER BY volgorde, id').all() as ItemRij[];
export const materiaalRijen = (db: Db) =>
  db.prepare('SELECT * FROM materialen ORDER BY volgorde, id').all() as ItemRij[];
export const optieRijen = (db: Db) =>
  db.prepare('SELECT * FROM werkzaamheid_opties ORDER BY volgorde, id').all() as OptieRij[];

/** Omschrijving van de prijspost van een optie: "Afvalcontainer (Slopen)". */
export const optieOmschrijving = (optie: string, werkzaamheid: string) => `${optie} (${werkzaamheid})`;

/**
 * Maakt de prijspost met deze sleutel aan (btw 21 %, achteraan) of werkt omschrijving en eenheid bij.
 * `prijsCent` weglaten = de prijs niet aanraken (een nieuwe post krijgt dan geen prijs).
 */
export function zetPrijspost(
  db: Db,
  sleutel: string,
  omschrijving: string,
  eenheid: Eenheid,
  prijsCent?: number | null,
): void {
  const bestaand = db.prepare('SELECT id FROM prijsposten WHERE sleutel = ?').get(sleutel) as
    { id: string } | undefined;
  if (bestaand) {
    db.prepare('UPDATE prijsposten SET omschrijving = ?, eenheid = ? WHERE id = ?').run(
      omschrijving,
      eenheid,
      bestaand.id,
    );
    if (prijsCent !== undefined) {
      db.prepare('UPDATE prijsposten SET prijs_cent = ? WHERE id = ?').run(prijsCent, bestaand.id);
    }
    return;
  }
  const { hoogste } = db.prepare('SELECT COALESCE(MAX(volgorde), 0) AS hoogste FROM prijsposten').get() as {
    hoogste: number;
  };
  // Een post uit de startset (zonder prijs) krijgt een vaste id, zoals §9.3; dat houdt de seed gelijk.
  const startId = `start-${sleutel}`;
  const vrij = prijsCent === undefined && !db.prepare('SELECT 1 FROM prijsposten WHERE id = ?').get(startId);
  db.prepare(
    'INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, ?, ?, ?, ?, 21, ?)',
  ).run(vrij ? startId : randomUUID(), sleutel, omschrijving, eenheid, prijsCent ?? null, hoogste + 10);
}

/** Eigen items achter de startitems, in hun huidige volgorde. */
function hernummer(db: Db, tabel: 'werkzaamheden' | 'materialen', start: Set<string>): void {
  let volgorde = (start.size + 1) * 10;
  for (const rij of db.prepare(`SELECT id, sleutel FROM ${tabel} ORDER BY volgorde, id`).all() as {
    id: string;
    sleutel: string;
  }[]) {
    if (start.has(rij.sleutel)) continue;
    db.prepare(`UPDATE ${tabel} SET volgorde = ? WHERE id = ?`).run(volgorde, rij.id);
    volgorde += 10;
  }
}

/**
 * Zet de startset (shared/werkzaamheden.ts) in de database: direct na migratie 004 (lege tabellen) en
 * bij "Herstel startset". Startitems krijgen hun oorspronkelijke naam, eenheid en volgorde terug en
 * worden weer getoond; ontbrekende worden teruggezet, eigen items blijven achter de startitems staan.
 * De koppelingen uit de startset worden aangevuld (eigen koppelingen blijven) en het standaardmateriaal
 * wordt teruggezet. Prijzen blijven zoals ze zijn; een ontbrekende prijspost komt terug zonder prijs.
 * Een soort werk die niet (meer) in de keuzelijst staat, wordt overgeslagen.
 */
export function zetWerkzaamhedenStartset(db: Db): void {
  const materiaalId = new Map<string, string>();
  const materialen = new Map(materiaalRijen(db).map((r) => [r.sleutel, r]));
  MATERIALEN_STARTSET.forEach((m, index) => {
    const rij = materialen.get(m.sleutel);
    const id = rij?.id ?? `start-mat-${m.sleutel}`;
    if (rij) {
      db.prepare(
        'UPDATE materialen SET label = ?, eenheid = ?, volgorde = ?, verborgen = 0, standaard = 1 WHERE id = ?',
      ).run(m.label, m.eenheid, (index + 1) * 10, id);
    } else {
      db.prepare(
        'INSERT INTO materialen (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, 1)',
      ).run(id, m.sleutel, m.label, m.eenheid, (index + 1) * 10);
    }
    materiaalId.set(m.sleutel, id);
    zetPrijspost(db, materiaalPrijsSleutel(m.sleutel), m.label, m.eenheid);
  });
  hernummer(db, 'materialen', new Set(MATERIALEN_STARTSET.map((m) => m.sleutel)));

  const soorten = new Set(
    (
      db.prepare("SELECT sleutel FROM keuzeopties WHERE lijst = 'soortWerk'").all() as { sleutel: string }[]
    ).map((r) => r.sleutel),
  );
  const werken = new Map(werkRijen(db).map((r) => [r.sleutel, r]));
  WERKZAAMHEDEN_STARTSET.forEach((w, index) => {
    const rij = werken.get(w.sleutel);
    const id = rij?.id ?? `start-werk-${w.sleutel}`;
    if (rij) {
      db.prepare(
        'UPDATE werkzaamheden SET label = ?, eenheid = ?, volgorde = ?, verborgen = 0, standaard = 1 WHERE id = ?',
      ).run(w.label, w.eenheid, (index + 1) * 10, id);
    } else {
      db.prepare(
        'INSERT INTO werkzaamheden (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, 1)',
      ).run(id, w.sleutel, w.label, w.eenheid, (index + 1) * 10);
    }
    zetPrijspost(db, werkPrijsSleutel(w.sleutel), w.label, w.eenheid);

    const opties = new Map(
      (db.prepare('SELECT * FROM werkzaamheid_opties WHERE werkzaamheid_id = ?').all(id) as OptieRij[]).map(
        (o) => [o.sleutel, o],
      ),
    );
    w.opties.forEach((o, optieIndex) => {
      const optie = opties.get(o.sleutel);
      if (optie) {
        db.prepare(
          'UPDATE werkzaamheid_opties SET label = ?, eenheid = ?, volgorde = ?, verborgen = 0 WHERE id = ?',
        ).run(o.label, o.eenheid, (optieIndex + 1) * 10, optie.id);
      } else {
        db.prepare(
          'INSERT INTO werkzaamheid_opties (id, werkzaamheid_id, sleutel, label, eenheid, volgorde, verborgen) VALUES (?, ?, ?, ?, ?, ?, 0)',
        ).run(
          `start-optie-${w.sleutel}-${o.sleutel}`,
          id,
          o.sleutel,
          o.label,
          o.eenheid,
          (optieIndex + 1) * 10,
        );
      }
      zetPrijspost(
        db,
        optiePrijsSleutel(w.sleutel, o.sleutel),
        optieOmschrijving(o.label, w.label),
        o.eenheid,
      );
    });

    for (const soort of w.soortenWerk) {
      if (!soorten.has(soort)) continue;
      db.prepare(
        'INSERT OR IGNORE INTO werkzaamheid_soortwerk (werkzaamheid_id, soort_werk) VALUES (?, ?)',
      ).run(id, soort);
    }
    db.prepare('UPDATE werkzaamheid_materiaal SET standaard = 0 WHERE werkzaamheid_id = ?').run(id);
    for (const sleutel of w.materialen) {
      db.prepare(
        'INSERT INTO werkzaamheid_materiaal (werkzaamheid_id, materiaal_id, standaard) VALUES (?, ?, ?) ' +
          'ON CONFLICT (werkzaamheid_id, materiaal_id) DO UPDATE SET standaard = excluded.standaard',
      ).run(id, materiaalId.get(sleutel), sleutel === w.standaardMateriaal ? 1 : 0);
    }
  });
  hernummer(db, 'werkzaamheden', new Set(WERKZAAMHEDEN_STARTSET.map((w) => w.sleutel)));
}
