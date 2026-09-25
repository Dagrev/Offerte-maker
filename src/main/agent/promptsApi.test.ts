import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// API-modus van de prompts (§10.5, V-17, OFM-020).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { API_MAX_TEKENS, bouwOpdrachtMaken, bouwSysteemprompt, voorbeeldenSectieApi, WERKWIJZE_API } =
  await import('./prompts');
const { voorbeeldenVoorApi } = await import('./werkmap');

describe('systeemprompt in API-modus (V-17)', () => {
  it('vervangt alleen de eerste Werkwijze-bullet', () => {
    const cli = bouwSysteemprompt({ template: true });
    const api = bouwSysteemprompt({ template: true, api: true });
    expect(api).toContain(
      '- De geanonimiseerde voorbeeldoffertes en het template staan hieronder in de opdracht. Gebruik ze als voorbeeld.',
    );
    expect(api).not.toContain('In de map waarin je werkt');
    expect(cli).toContain('In de map waarin je werkt');
    // Verder gelijk: alleen die ene regel verschilt.
    const verschil = cli.split('\n').filter((r, i) => r !== api.split('\n')[i]);
    expect(verschil).toHaveLength(1);
    expect(bouwSysteemprompt({ template: false, api: true })).toContain(
      '- De geanonimiseerde voorbeeldoffertes staan hieronder in de opdracht. Gebruik ze als voorbeeld.',
    );
    expect(WERKWIJZE_API).toContain('{{#template}}');
  });
});

describe('sectie Voorbeelden in API-modus', () => {
  it('volledige teksten, template eerst, geen zin over de map', () => {
    const sectie = voorbeeldenSectieApi({ template: 'TEMPLATE', voorbeelden: ['nieuw', 'oud'] });
    expect(sectie).toBe(
      'Volg de indeling en toon van het template.\n\n### Template\n\nTEMPLATE\n\n' +
        '### Voorbeeldofferte 1\n\nnieuw\n\n### Voorbeeldofferte 2\n\noud',
    );
    expect(sectie).not.toContain('voorbeelden/');
    expect(voorbeeldenSectieApi({ template: null, voorbeelden: [] })).toBe(
      'Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl.',
    );
  });

  it('maximaal 10 voorbeelden', () => {
    const sectie = voorbeeldenSectieApi({
      template: null,
      voorbeelden: Array.from({ length: 12 }, (_, i) => `v${i}`),
    });
    expect(sectie).toContain('### Voorbeeldofferte 10');
    expect(sectie).not.toContain('### Voorbeeldofferte 11');
  });

  it('200.000 tekens voor template + voorbeelden samen, voorbeelden tot de grens', () => {
    const template = 'T'.repeat(120_000);
    const groot = 'V'.repeat(50_000);
    const sectie = voorbeeldenSectieApi({ template, voorbeelden: [groot, groot, 'klein'] });
    expect(sectie).toContain('### Voorbeeldofferte 1');
    expect(sectie).not.toContain('### Voorbeeldofferte 2');
    expect(sectie.length).toBeLessThan(API_MAX_TEKENS + 500);
  });

  it('bouwOpdrachtMaken gebruikt de API-sectie als die is meegegeven', () => {
    const basis = {
      klus: {} as never,
      prijslijst: [],
      teksten: { inleiding: 'i', afsluiting: 'a' },
      aantalVoorbeelden: 2,
      template: false,
    };
    expect(bouwOpdrachtMaken(basis)).toContain('Er zijn 2 goedgekeurde voorbeeldoffertes in voorbeelden/.');
    const api = bouwOpdrachtMaken({ ...basis, api: { template: null, voorbeelden: ['A', 'B'] } });
    expect(api).toContain('## Voorbeelden\n### Voorbeeldofferte 1\n\nA');
    expect(api).not.toContain('voorbeelden/');
  });
});

describe('voorbeeldenVoorApi', () => {
  let t: TestDatabase;
  beforeEach(async () => {
    t = await maakTestDatabase();
  });
  afterEach(() => t.opruimen());

  it('goedgekeurde teksten, template apart, voorbeelden nieuwste eerst', () => {
    t.db.prepare("INSERT INTO bestanden (id, naam, mime, inhoud) VALUES ('b', 'x', 'x', x'00')").run();
    const voeg = t.db.prepare(
      "INSERT INTO voorbeelden (id, bestandsnaam, bestand_id, tekst_geanonimiseerd, status, is_template, aangemaakt_op) VALUES (?, 'x', 'b', ?, ?, ?, ?)",
    );
    voeg.run('1', 'oud', 'goedgekeurd', 0, '2026-01-01');
    voeg.run('2', 'nieuw', 'goedgekeurd', 0, '2026-03-01');
    voeg.run('3', 'tpl', 'goedgekeurd', 1, '2026-02-01');
    voeg.run('4', 'niet goedgekeurd', 'te_controleren', 0, '2026-04-01');
    expect(voorbeeldenVoorApi()).toEqual({ template: 'tpl', voorbeelden: ['nieuw', 'oud'] });
  });
});
