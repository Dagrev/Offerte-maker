import {
  heeftOudeVelden,
  zetOmNaarWerkzaamheden,
  type OpgeslagenInvoer,
  type OudeLijst,
} from '../../shared/omzetting';
import type { Eenheid, Offerteregel } from '../../shared/types';
import type { Db } from './verbinding';
import { materiaalRijen, werkRijen } from './werkzaamhedenStartset';

// Omzetting van oude offertes (OFM-045, TDO §9.7). Draait in `migreer()` in de transactie van migratie
// 005, vóór de SQL van die migratie: die verwijdert de oude keuzelijsten, en de labels daarvan zijn
// hier nog nodig. Alle offertes (ook in de prullenbak en definitieve) krijgen een nieuwe
// `invoer_json`; `inhoud_json`, versies en PDF's blijven precies zoals ze zijn.

const OUDE_LIJSTEN: readonly OudeLijst[] = ['bedekking', 'isolatie', 'extras', 'afwerking'];

function regelsVan(inhoudJson: string | null): Offerteregel[] {
  if (inhoudJson === null) return [];
  const inhoud = JSON.parse(inhoudJson) as { regels?: Offerteregel[] };
  return inhoud.regels ?? [];
}

/** Zet alle offertes met oude velden om; geeft het aantal omgezette offertes. */
export function zetOffertesOm(db: Db): number {
  const labels: Partial<Record<OudeLijst, { sleutel: string; label: string }[]>> = {};
  const keuzes = db
    .prepare(
      `SELECT lijst, sleutel, label FROM keuzeopties WHERE lijst IN (${OUDE_LIJSTEN.map(() => '?').join(',')})
       ORDER BY volgorde, id`,
    )
    .all(...OUDE_LIJSTEN) as { lijst: OudeLijst; sleutel: string; label: string }[];
  for (const k of keuzes) (labels[k.lijst] ??= []).push({ sleutel: k.sleutel, label: k.label });

  const prijsposten = (
    db.prepare('SELECT id, sleutel, omschrijving, eenheid, prijs_cent FROM prijsposten').all() as {
      id: string;
      sleutel: string | null;
      omschrijving: string;
      eenheid: Eenheid;
      prijs_cent: number | null;
    }[]
  ).map((p) => ({ ...p, prijsCent: p.prijs_cent }));
  const catalogus = { werkzaamheden: werkRijen(db), materialen: materiaalRijen(db) };

  const offertes = db.prepare('SELECT id, invoer_json, inhoud_json FROM offertes').all() as {
    id: string;
    invoer_json: string;
    inhoud_json: string | null;
  }[];
  const bijwerken = db.prepare('UPDATE offertes SET invoer_json = ? WHERE id = ?');
  let aantal = 0;
  for (const rij of offertes) {
    const invoer = JSON.parse(rij.invoer_json) as OpgeslagenInvoer;
    if (!heeftOudeVelden(invoer)) continue;
    const nieuw = zetOmNaarWerkzaamheden(invoer, {
      catalogus,
      labels,
      prijsposten,
      regels: regelsVan(rij.inhoud_json),
    });
    bijwerken.run(JSON.stringify(nieuw), rij.id);
    aantal += 1;
  }
  return aantal;
}
