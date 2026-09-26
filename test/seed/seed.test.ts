import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { SEED_NAMEN, vulMetSeed } from '../../scripts/seedGegevens';
import { klusInvoerSchema } from '../../src/shared/schemas';

function hoogsteMigratie(): number {
  const map = join(import.meta.dirname, '../../src/main/db/migraties');
  return Math.max(...readdirSync(map).map((n) => Number(/^(\d{3})_/.exec(n)?.[1] ?? 0)));
}

// Seed-script (OFM-027, TDO §15.4): 5.000 offertes, random-seed 42, 10 % concept, 1–8 regels,
// namen uit een vaste lijst van 200, 2022–2026, en twee runs geven dezelfde gegevens.

const mappen: string[] = [];
const databases: Database.Database[] = [];

function nieuweDb(): Database.Database {
  const map = mkdtempSync(join(tmpdir(), 'ofm-seed-'));
  mappen.push(map);
  const db = new Database(join(map, 'offerte-maker.sqlite'));
  databases.push(db);
  return db;
}

function inhoudHash(db: Database.Database): string {
  const hash = createHash('sha256');
  for (const tabel of ['offertes', 'offerte_versies', 'pdf_bestanden', 'prijsposten']) {
    for (const rij of db.prepare(`SELECT * FROM ${tabel} ORDER BY id`).all())
      hash.update(JSON.stringify(rij));
  }
  return hash.digest('hex');
}

afterEach(() => {
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const map of mappen.splice(0)) rmSync(map, { recursive: true, force: true });
});

describe('vulMetSeed', () => {
  it('maakt 5.000 offertes volgens §15.4', () => {
    const db = nieuweDb();
    const uitkomst = vulMetSeed(db);
    expect(uitkomst.aantal).toBe(5000);
    expect(uitkomst.perStatus).toEqual({
      concept: 500,
      klaar: 1125,
      verstuurd: 1125,
      akkoord: 1125,
      afgewezen: 1125,
    });

    const jaren = db
      .prepare('SELECT substr(offertedatum, 1, 4) AS j, COUNT(*) AS n FROM offertes GROUP BY j ORDER BY j')
      .all() as { j: string; n: number }[];
    expect(jaren.map((j) => j.j)).toEqual(['2022', '2023', '2024', '2025', '2026']);
    for (const j of jaren) expect(j.n).toBeGreaterThan(900);

    const rijen = db
      .prepare('SELECT status, nummer, klant_json, invoer_json, inhoud_json, totaal_incl_cent FROM offertes')
      .all() as {
      status: string;
      nummer: string | null;
      klant_json: string;
      invoer_json: string;
      inhoud_json: string;
      totaal_incl_cent: number;
    }[];
    const namen = new Set(SEED_NAMEN.map((n) => `${n.voornaam} ${n.achternaam}`));
    expect(namen.size).toBe(200);
    const soorten = new Set<string>();
    for (const r of rijen) {
      const regels = (JSON.parse(r.inhoud_json) as { regels: unknown[] }).regels.length;
      expect(regels).toBeGreaterThanOrEqual(1);
      expect(regels).toBeLessThanOrEqual(8);
      // OFM-045: 1–4 werkzaamheden, geen velden van de oude stap Extra's.
      const invoer = klusInvoerSchema.parse(JSON.parse(r.invoer_json));
      expect(invoer.werkzaamheden.length).toBeGreaterThanOrEqual(1);
      expect(invoer.werkzaamheden.length).toBeLessThanOrEqual(4);
      expect(JSON.parse(r.invoer_json)).not.toHaveProperty('bedekking');
      soorten.add(invoer.soortWerk ?? '');
      const k = JSON.parse(r.klant_json) as { voornaam: string; achternaam: string };
      expect(namen.has(`${k.voornaam} ${k.achternaam}`)).toBe(true);
      expect(r.nummer === null).toBe(r.status === 'concept');
      expect(r.totaal_incl_cent).toBeGreaterThan(0);
    }
    expect(soorten.size).toBe(6);
    // Nummers per jaar doorlopend vanaf 001, met de datum ervoor (OFM-033).
    const eerste = db.prepare('SELECT nummer FROM offertes WHERE jaar = 2024 AND volgnummer = 1').get() as {
      nummer: string;
    };
    expect(eerste.nummer).toMatch(/^2024-01-\d{2}-001$/);
  });

  it('geeft bij twee runs dezelfde gegevens, ook opnieuw in dezelfde database', () => {
    const a = nieuweDb();
    const b = nieuweDb();
    vulMetSeed(a);
    vulMetSeed(b);
    const hash = inhoudHash(a);
    expect(inhoudHash(b)).toBe(hash);
    vulMetSeed(a);
    expect(inhoudHash(a)).toBe(hash);
    expect((a.prepare('SELECT COUNT(*) AS n FROM offertes').get() as { n: number }).n).toBe(5000);
    // Hoogste migratie (OFM-049: 007); niet hardgecodeerd, zodat een nieuwe migratie deze test niet breekt.
    expect(a.pragma('user_version', { simple: true })).toBe(hoogsteMigratie());
    // OFM-049: de standaardkeuzes van de startset (hoogte 1, garantie 10), net als na migratie 007.
    expect(
      a.prepare('SELECT lijst, sleutel FROM keuzeopties WHERE standaardkeuze = 1 ORDER BY lijst').all(),
    ).toEqual([
      { lijst: 'garantie', sleutel: '10' },
      { lijst: 'hoogte', sleutel: '1' },
    ]);
  });
});
