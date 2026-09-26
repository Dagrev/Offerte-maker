import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { berekenTotalen, bedragWerkzaamheidCent } from '@shared/calc/bedragen';
import { klusInvoerSchema, offerteInhoudSchema } from '@shared/schemas';

// OFM-045: migratie 005 op de fixture met schemaversie 3 (test/fixtures/schema3, oude invoer).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { SCHEMA_VERSIE, migreer } = await import('./migraties');
const { openDatabase } = await import('./verbinding');
const { zetOffertesOm } = await import('./omzettingWerkzaamheden');

const FIXTURE = resolve(import.meta.dirname, '../../../test/fixtures/schema3/offerte-maker-schema3.sqlite');

const mappen: string[] = [];
afterEach(() => {
  for (const m of mappen.splice(0)) rmSync(m, { recursive: true, force: true });
});

function kopie() {
  const map = mkdtempSync(join(tmpdir(), 'ofm-omzet-'));
  mappen.push(map);
  const pad = join(map, 'offerte-maker.sqlite');
  copyFileSync(FIXTURE, pad);
  return openDatabase(pad);
}

type Rij = { invoer_json: string; inhoud_json: string | null; totaal_incl_cent: number | null };

describe('migratie 005 op een database van versie 3', () => {
  it('zet beide offertes om; inhoud, totaal en versies blijven; oude keuzelijsten weg', async () => {
    const db = kopie();
    try {
      const rij = (id: string) =>
        db
          .prepare('SELECT invoer_json, inhoud_json, totaal_incl_cent FROM offertes WHERE id = ?')
          .get(id) as Rij;
      const voor = rij('fixture-a');
      const versieVoor = db.prepare('SELECT * FROM offerte_versies').all();

      expect(await migreer(db, { backup: () => Promise.resolve() })).toMatchObject({
        van: 3,
        naar: SCHEMA_VERSIE,
      });

      const na = rij('fixture-a');
      expect(na.inhoud_json).toBe(voor.inhoud_json);
      expect(na.totaal_incl_cent).toBe(voor.totaal_incl_cent);
      expect(db.prepare('SELECT * FROM offerte_versies').all()).toEqual(versieVoor);

      const invoer = klusInvoerSchema.parse(JSON.parse(na.invoer_json));
      expect(JSON.parse(na.invoer_json)).not.toHaveProperty('bedekking');
      expect(invoer.werkzaamheden.map((w) => w.sleutel ?? w.eenmalig?.label)).toEqual([
        'slopen',
        'isoleren',
        'nieuwe_bedekking',
        'Aluminium daktrim',
        'Hemelwaterafvoer aansluiten',
        'dakrand_afwerking',
      ]);
      // Werkzaamheden + steiger + voorrijkosten = het oude subtotaal (de hand-prijs van epdm blijft).
      const inhoud = offerteInhoudSchema.parse(JSON.parse(na.inhoud_json ?? ''));
      const rest = inhoud.regels.filter((r) =>
        ['start-steiger', 'start-voorrijkosten'].includes(r.prijspostId ?? ''),
      );
      const werk = invoer.werkzaamheden.reduce((som, w) => som + bedragWerkzaamheidCent(w), 0);
      expect(werk + berekenTotalen(rest).subtotaalCent).toBe(berekenTotalen(inhoud.regels).subtotaalCent);

      const b = klusInvoerSchema.parse(JSON.parse(rij('fixture-b').invoer_json));
      expect(b.werkzaamheden.map((w) => w.sleutel ?? w.eenmalig?.label)).toEqual([
        'isoleren',
        'nieuwe_bedekking',
        'EPDM dakgoot',
        'Dakdoorvoer inwerken',
        'Zonnepaneelbeugel',
        'dakrand_afwerking',
      ]);
      expect(b.werkzaamheden[4]).toMatchObject({ aantal: 4, prijsCent: 2500 });

      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM keuzeopties WHERE lijst IN ('bedekking','isolatie','extras','afwerking')",
          )
          .get(),
      ).toEqual({ n: 0 });
      // Een tweede keer omzetten doet niets meer.
      expect(zetOffertesOm(db)).toBe(0);
    } finally {
      db.close();
    }
  });
});
