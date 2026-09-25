import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { schoonOp } = await import('./opschonen');

const nu = new Date('2026-09-25T12:00:00.000Z');
const dagenGeleden = (n: number) => new Date(nu.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

function voegOfferteToe(id: string, verwijderdOp: string | null, pdfPad?: string): void {
  t.db
    .prepare(
      `INSERT INTO offertes (id, offertedatum, geldig_tot, klant_json, invoer_json, verwijderd_op, aangemaakt_op, bijgewerkt_op)
       VALUES (?, '2026-01-01', '2026-01-31', '{}', '{}', ?, ?, ?)`,
    )
    .run(id, verwijderdOp, nu.toISOString(), nu.toISOString());
  t.db
    .prepare(
      "INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op) VALUES (?, ?, 1, 'agent', '{}', ?)",
    )
    .run(`${id}-v1`, id, nu.toISOString());
  if (pdfPad) {
    t.db
      .prepare(
        "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES (?, ?, '', ?, ?)",
      )
      .run(`${id}-pdf`, id, pdfPad, nu.toISOString());
  }
}

function voegLogToe(id: string, tijdstip: string): void {
  t.db
    .prepare(
      "INSERT INTO privacylog (id, tijdstip, soort, opdracht, resultaat) VALUES (?, ?, 'maken', 'opdracht', 'ok')",
    )
    .run(id, tijdstip);
}

const aantal = (tabel: string, id: string) =>
  (t.db.prepare(`SELECT COUNT(*) AS n FROM ${tabel} WHERE id = ?`).get(id) as { n: number }).n;

describe('schoonOp (§14.1 stap 5)', () => {
  it('prullenbak: 91 dagen weg (cascade, PDF-bestand blijft), 89 dagen en niet verwijderd blijven', () => {
    const pdf = join(t.map, '2026-001.pdf');
    writeFileSync(pdf, '%PDF');
    voegOfferteToe('oud', dagenGeleden(91), pdf);
    voegOfferteToe('recent', dagenGeleden(89));
    voegOfferteToe('actief', null);

    expect(schoonOp(t.db, nu)).toEqual({ offertes: 1, privacylog: 0 });
    expect(aantal('offertes', 'oud')).toBe(0);
    expect(aantal('offerte_versies', 'oud-v1')).toBe(0);
    expect(aantal('pdf_bestanden', 'oud-pdf')).toBe(0);
    expect(existsSync(pdf)).toBe(true);
    expect(aantal('offertes', 'recent')).toBe(1);
    expect(aantal('offertes', 'actief')).toBe(1);
  });

  it('privacylog: 366 dagen weg, 364 dagen blijft', () => {
    voegLogToe('oud', dagenGeleden(366));
    voegLogToe('recent', dagenGeleden(364));
    expect(schoonOp(t.db, nu)).toEqual({ offertes: 0, privacylog: 1 });
    expect(aantal('privacylog', 'oud')).toBe(0);
    expect(aantal('privacylog', 'recent')).toBe(1);
  });

  it('gebruikt standaard de huidige tijd', () => {
    expect(schoonOp(t.db)).toEqual({ offertes: 0, privacylog: 0 });
  });
});
