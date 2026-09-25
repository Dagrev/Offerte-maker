import { randomUUID } from 'node:crypto';
import type { VoorbeeldItem, VoorbeeldStatus } from '@shared/types';
import { database } from '../verbinding';

// Voorbeelden (TDO §4.2, V-15, V-16). OFM-012 leverde `haalGoedgekeurdeVoorbeelden` voor de
// agentwerkmap; OFM-019 de rest. De beheerlogica (extractie, redactie, werkmap) staat in
// `voorbeelden/beheer.ts`; dit bestand doet alleen SQL.

export interface GoedgekeurdVoorbeeld {
  id: string;
  tekst: string;
  isTemplate: boolean;
  aangemaaktOp: string;
}

/** Goedgekeurde voorbeelden (incl. template), oudste eerst. Geen bestandsnamen (§10.3). */
export function haalGoedgekeurdeVoorbeelden(): GoedgekeurdVoorbeeld[] {
  const rijen = database()
    .prepare(
      "SELECT id, tekst_geanonimiseerd, is_template, aangemaakt_op FROM voorbeelden WHERE status = 'goedgekeurd' ORDER BY aangemaakt_op, id",
    )
    .all() as { id: string; tekst_geanonimiseerd: string; is_template: number; aangemaakt_op: string }[];
  return rijen.map((r) => ({
    id: r.id,
    tekst: r.tekst_geanonimiseerd,
    isTemplate: r.is_template === 1,
    aangemaaktOp: r.aangemaakt_op,
  }));
}

interface Rij {
  id: string;
  bestandsnaam: string;
  bestand_id: string;
  tekst_geanonimiseerd: string;
  handmatige_redacties: string;
  status: VoorbeeldStatus;
  is_template: number;
  aangemaakt_op: string;
}

export interface Voorbeeld extends VoorbeeldItem {
  bestandId: string;
  tekst: string;
  handmatigeRedacties: string[];
}

/** `handmatige_redacties` is JSON `string[]`; iets anders telt als leeg. */
export function leesRedacties(json: string): string[] {
  try {
    const waarde: unknown = JSON.parse(json);
    return Array.isArray(waarde) ? waarde.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

function naarItem(r: Rij): VoorbeeldItem {
  return {
    id: r.id,
    bestandsnaam: r.bestandsnaam,
    status: r.status,
    isTemplate: r.is_template === 1,
    aangemaaktOp: r.aangemaakt_op,
  };
}

/** Alle voorbeelden voor de tab, in dezelfde volgorde als de nummering in de werkmap (V-16). */
export function lijstVoorbeelden(): VoorbeeldItem[] {
  const rijen = database().prepare('SELECT * FROM voorbeelden ORDER BY aangemaakt_op, id').all() as Rij[];
  return rijen.map(naarItem);
}

/** Eén voorbeeld, of `null` als het niet (meer) bestaat. */
export function haalVoorbeeld(id: string): Voorbeeld | null {
  const r = database().prepare('SELECT * FROM voorbeelden WHERE id = ?').get(id) as Rij | undefined;
  if (!r) return null;
  return {
    ...naarItem(r),
    bestandId: r.bestand_id,
    tekst: r.tekst_geanonimiseerd,
    handmatigeRedacties: leesRedacties(r.handmatige_redacties),
  };
}

/** Het originele bestand (BLOB) van een voorbeeld: de bron voor elke nieuwe redactie (§11.5). */
export function haalOrigineel(id: string): { bestandsnaam: string; inhoud: Uint8Array } | null {
  const rij = database()
    .prepare(
      'SELECT v.bestandsnaam, b.inhoud FROM voorbeelden v JOIN bestanden b ON b.id = v.bestand_id WHERE v.id = ?',
    )
    .get(id) as { bestandsnaam: string; inhoud: Uint8Array } | undefined;
  return rij ?? null;
}

/** Laatste `aangemaakt_op`, zodat een nieuw voorbeeld altijd later komt (stabiele nummering). */
function laatsteAangemaaktOp(): string | null {
  const rij = database().prepare('SELECT MAX(aangemaakt_op) AS m FROM voorbeelden').get() as {
    m: string | null;
  };
  return rij.m;
}

export interface NieuwVoorbeeld {
  bestandsnaam: string;
  mime: string;
  inhoud: Uint8Array;
  tekst: string;
  /** Standaard nu; altijd minstens 1 ms na het laatste voorbeeld. */
  nu?: Date;
}

/** Origineel in `bestanden` plus het voorbeeld met status `te_controleren`, in één transactie. */
export function voegVoorbeeldToe(n: NieuwVoorbeeld): string {
  const db = database();
  const id = randomUUID();
  const bestandId = randomUUID();
  db.transaction(() => {
    let tijd = (n.nu ?? new Date()).getTime();
    const laatste = laatsteAangemaaktOp();
    if (laatste !== null && tijd <= Date.parse(laatste)) tijd = Date.parse(laatste) + 1;
    db.prepare('INSERT INTO bestanden (id, naam, mime, inhoud) VALUES (?, ?, ?, ?)').run(
      bestandId,
      n.bestandsnaam,
      n.mime,
      n.inhoud,
    );
    db.prepare(
      `INSERT INTO voorbeelden (id, bestandsnaam, bestand_id, tekst_geanonimiseerd, handmatige_redacties, status, is_template, aangemaakt_op)
       VALUES (?, ?, ?, ?, '[]', 'te_controleren', 0, ?)`,
    ).run(id, n.bestandsnaam, bestandId, n.tekst, new Date(tijd).toISOString());
  })();
  return id;
}

/** Nieuwe geanonimiseerde tekst en handmatige redacties; de status blijft ongewijzigd (V-16). */
export function zetRedactie(id: string, tekst: string, handmatigeRedacties: readonly string[]): void {
  database()
    .prepare('UPDATE voorbeelden SET tekst_geanonimiseerd = ?, handmatige_redacties = ? WHERE id = ?')
    .run(tekst, JSON.stringify(handmatigeRedacties), id);
}

export function zetGoedgekeurd(id: string): void {
  database().prepare("UPDATE voorbeelden SET status = 'goedgekeurd' WHERE id = ?").run(id);
}

/** Maximaal één template (`idx_een_template`): eerst alle markeringen weg, dan de nieuwe. */
export function zetTemplateMarkering(id: string | null): void {
  const db = database();
  db.transaction(() => {
    db.prepare('UPDATE voorbeelden SET is_template = 0 WHERE is_template = 1').run();
    if (id !== null) db.prepare('UPDATE voorbeelden SET is_template = 1 WHERE id = ?').run(id);
  })();
}

/** Voorbeeld én zijn `bestanden`-regel weg (V-16). `false` als het voorbeeld niet bestond. */
export function verwijderVoorbeeldRij(id: string): boolean {
  const db = database();
  return db.transaction(() => {
    const rij = db.prepare('SELECT bestand_id FROM voorbeelden WHERE id = ?').get(id) as
      { bestand_id: string } | undefined;
    if (!rij) return false;
    db.prepare('DELETE FROM voorbeelden WHERE id = ?').run(id);
    db.prepare('DELETE FROM bestanden WHERE id = ?').run(rij.bestand_id);
    return true;
  })();
}
