import { randomUUID } from 'node:crypto';
import { AppFout } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { BtwTarief, Eenheid, Prijspost } from '@shared/types';
import { prijsGroep } from '@shared/werkzaamheden';
import { database } from '../verbinding';

// Prijsposten (TDO §4.2, V-15) voor de kanalen `prijzen:*` (OFM-018) en de startposten (OFM-025).

interface PrijspostRij {
  id: string;
  sleutel: string | null;
  omschrijving: string;
  eenheid: Eenheid;
  prijs_cent: number | null;
  btw_tarief: BtwTarief;
  volgorde: number;
}

function naarPrijspost(rij: PrijspostRij): Prijspost {
  return {
    id: rij.id,
    sleutel: rij.sleutel,
    omschrijving: rij.omschrijving,
    eenheid: rij.eenheid,
    prijsCent: rij.prijs_cent,
    btwTarief: rij.btw_tarief,
    volgorde: rij.volgorde,
  };
}

export function lijstPrijsposten(): Prijspost[] {
  const rijen = database().prepare('SELECT * FROM prijsposten ORDER BY volgorde, id').all() as PrijspostRij[];
  return rijen.map(naarPrijspost);
}

/**
 * De prijslijst voor de agentopdracht (§10.5). Sinds OFM-044 met de posten van werkzaamheden, opties
 * en materialen (in OFM-043 bleven die nog weg, toen de wizard ze niet kende).
 */
export function prijslijstVoorAgent(): Prijspost[] {
  return lijstPrijsposten();
}

export function haalPrijspost(id: string): Prijspost | null {
  const rij = database().prepare('SELECT * FROM prijsposten WHERE id = ?').get(id) as
    PrijspostRij | undefined;
  return rij ? naarPrijspost(rij) : null;
}

/** Startpost opzoeken op sleutel (§9.3); `null` als de gebruiker hem heeft verwijderd. */
export function haalPrijspostOpSleutel(sleutel: string): Prijspost | null {
  const rij = database().prepare('SELECT * FROM prijsposten WHERE sleutel = ?').get(sleutel) as
    PrijspostRij | undefined;
  return rij ? naarPrijspost(rij) : null;
}

/**
 * Lege `id` = nieuw: nieuwe UUID, `sleutel` NULL en `volgorde = max + 10` (V-15). Anders bijwerken;
 * de `sleutel` van een bestaande post blijft ongewijzigd. Onbekende id → `VALIDATIE`.
 */
export function bewaarPrijspost(post: Prijspost): { id: string } {
  const db = database();
  if (post.id === '') {
    const id = randomUUID();
    const { hoogste } = db.prepare('SELECT COALESCE(MAX(volgorde), 0) AS hoogste FROM prijsposten').get() as {
      hoogste: number;
    };
    db.prepare(
      'INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, NULL, ?, ?, ?, ?, ?)',
    ).run(id, post.omschrijving, post.eenheid, post.prijsCent, post.btwTarief, hoogste + 10);
    return { id };
  }

  // Een post van een werkzaamheid, optie of materiaal (OFM-043) houdt de naam en eenheid van dat item:
  // alleen prijs, btw en volgorde komen uit de prijslijst.
  const vast = haalPrijspost(post.id);
  const alsItem = vast !== null && prijsGroep(vast.sleutel) !== null;
  const resultaat = db
    .prepare(
      'UPDATE prijsposten SET omschrijving = ?, eenheid = ?, prijs_cent = ?, btw_tarief = ?, volgorde = ? WHERE id = ?',
    )
    .run(
      alsItem ? vast.omschrijving : post.omschrijving,
      alsItem ? vast.eenheid : post.eenheid,
      post.prijsCent,
      post.btwTarief,
      post.volgorde,
      post.id,
    );
  if (resultaat.changes === 0) throw new AppFout('VALIDATIE');
  return { id: post.id };
}

/** Een post van een werkzaamheid, optie of materiaal verdwijnt alleen met dat item (OFM-043). */
export function verwijderPrijspost(id: string): void {
  const post = haalPrijspost(id);
  if (post !== null && prijsGroep(post.sleutel) !== null) {
    throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.werkPrijspostVast);
  }
  database().prepare('DELETE FROM prijsposten WHERE id = ?').run(id);
}
