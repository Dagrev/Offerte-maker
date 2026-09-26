import type { Categorie } from '../../shared/types';
import {
  CATEGORIEEN_STARTSET,
  CATEGORIE_OVERIG,
  MATERIALEN_STARTSET,
  MIGRATIE_CATEGORIE,
  categorieIdVan,
} from '../../shared/werkzaamheden';
import type { Db } from './verbinding';

// Categorieën van materialen (OFM-057, TDO §4.2 migratie 012, §9.7). Lezen, de startset en Herstel
// startset. Zonder `database()` of Electron (relatieve imports), zodat `migreer()` en het seed-script dit
// met hun eigen verbinding kunnen gebruiken.

interface CategorieRij {
  id: string;
  naam: string;
  volgorde: number;
  standaard: number;
}

/** Alle categorieën in volgorde (Overig inbegrepen). */
export function categorieenVan(db: Db): Categorie[] {
  return (
    db.prepare('SELECT * FROM materiaal_categorieen ORDER BY volgorde, id').all() as CategorieRij[]
  ).map((r) => ({ id: r.id, naam: r.naam, standaard: r.standaard === 1 }));
}

/**
 * Volgorde opnieuw nummeren: de gegeven id's eerst in deze volgorde, dan de rest in de huidige volgorde,
 * Overig altijd als laatste. Zo komt een eigen categorie nooit onder Overig terecht.
 */
export function hernummerCategorieen(db: Db, eerst: readonly string[] = []): void {
  const rest = categorieenVan(db)
    .map((c) => c.id)
    .filter((id) => !eerst.includes(id));
  const volgorde = [...eerst, ...rest].filter((id) => id !== CATEGORIE_OVERIG);
  const zet = db.prepare('UPDATE materiaal_categorieen SET volgorde = ? WHERE id = ?');
  volgorde.forEach((id, index) => zet.run((index + 1) * 10, id));
  zet.run((volgorde.length + 1) * 10, CATEGORIE_OVERIG);
}

/**
 * Startcategorieën (migratie 012 en Herstel startset): ontbrekende terugzetten, bestaande hun naam terug
 * en vooraan in de startvolgorde; eigen categorieën blijven, tussen de startcategorieën en Overig. De
 * startmaterialen krijgen hun categorie terug. Bij de migratie (`migratie`) krijgen ook houtschroeven en
 * betonpluggen (als ze bestaan) een categorie.
 */
export function zetCategorieenStartset(db: Db, { migratie = false } = {}): void {
  const invoegen = db.prepare(
    'INSERT INTO materiaal_categorieen (id, naam, volgorde, standaard) VALUES (?, ?, 0, 1) ' +
      'ON CONFLICT (id) DO UPDATE SET naam = excluded.naam, standaard = 1',
  );
  for (const c of CATEGORIEEN_STARTSET) invoegen.run(categorieIdVan(c.sleutel), c.naam);
  hernummerCategorieen(
    db,
    CATEGORIEEN_STARTSET.map((c) => categorieIdVan(c.sleutel)),
  );

  const zet = db.prepare('UPDATE materialen SET categorie_id = ? WHERE sleutel = ?');
  const categorieVoor = (sleutel: string) => (sleutel === 'overig' ? null : categorieIdVan(sleutel));
  for (const m of MATERIALEN_STARTSET) zet.run(categorieVoor(m.categorie), m.sleutel);
  if (migratie) {
    for (const [sleutel, categorie] of Object.entries(MIGRATIE_CATEGORIE)) {
      zet.run(categorieVoor(categorie), sleutel);
    }
  }
}
