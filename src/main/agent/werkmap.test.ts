import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { CLAUDE_MD_TEKST, schrijfSysteemprompt, synchroniseerWerkmap, voorbeeldBestandsnaam } =
  await import('./werkmap');

let db: TestDatabase;
let map: string;
beforeEach(async () => {
  db = await maakTestDatabase();
  map = join(mkdtempSync(join(tmpdir(), 'ofm-werkmap-')), 'agent');
});
afterEach(() => {
  db.opruimen();
  rmSync(join(map, '..'), { recursive: true, force: true });
});

function voegVoorbeeldToe(
  id: string,
  bestandsnaam: string,
  tekst: string,
  status: string,
  template: boolean,
  op: string,
) {
  db.db
    .prepare("INSERT OR IGNORE INTO bestanden (id, naam, mime, inhoud) VALUES ('b', 'x', 'x', x'00')")
    .run();
  db.db
    .prepare(
      "INSERT INTO voorbeelden (id, bestandsnaam, bestand_id, tekst_geanonimiseerd, status, is_template, aangemaakt_op) VALUES (?, ?, 'b', ?, ?, ?, ?)",
    )
    .run(id, bestandsnaam, tekst, status, template ? 1 : 0, op);
}

describe('agentwerkmap (§10.3, V-16)', () => {
  it('lege tabel: vaste bestanden, geen template.md, lege voorbeelden\\', () => {
    expect(synchroniseerWerkmap(map)).toEqual({ voorbeelden: 0, template: false });
    expect(readFileSync(join(map, 'CLAUDE.md'), 'utf8')).toBe(CLAUDE_MD_TEKST);
    expect(readFileSync(join(map, 'mcp-leeg.json'), 'utf8')).toBe('{"mcpServers":{}}');
    expect(existsSync(join(map, 'template.md'))).toBe(false);
    expect(readdirSync(join(map, 'voorbeelden'))).toEqual([]);
  });

  it('2 goedgekeurd + 1 te controleren + 1 template: precies voorbeeld-01, -02 en template.md', () => {
    voegVoorbeeldToe(
      'v2',
      'Jansen Dakwerk 2025.pdf',
      'Tekst nieuw',
      'goedgekeurd',
      false,
      '2026-03-01T10:00:00.000Z',
    );
    voegVoorbeeldToe(
      'v1',
      'Offerte Pietersen.docx',
      'Tekst oud',
      'goedgekeurd',
      false,
      '2026-01-01T10:00:00.000Z',
    );
    voegVoorbeeldToe(
      'v3',
      'nog nakijken.pdf',
      'Niet klaar',
      'te_controleren',
      false,
      '2026-02-01T10:00:00.000Z',
    );
    voegVoorbeeldToe(
      't',
      'template de Vries.docx',
      'Indeling',
      'goedgekeurd',
      true,
      '2026-04-01T10:00:00.000Z',
    );

    expect(synchroniseerWerkmap(map)).toEqual({ voorbeelden: 2, template: true });
    expect(readdirSync(join(map, 'voorbeelden'))).toEqual(['voorbeeld-01.md', 'voorbeeld-02.md']);
    expect(readFileSync(join(map, 'voorbeelden', 'voorbeeld-01.md'), 'utf8')).toBe(
      '# Voorbeeldofferte 1\n\nTekst oud',
    );
    expect(readFileSync(join(map, 'voorbeelden', 'voorbeeld-02.md'), 'utf8')).toBe(
      '# Voorbeeldofferte 2\n\nTekst nieuw',
    );
    expect(readFileSync(join(map, 'template.md'), 'utf8')).toBe('# Template\n\nIndeling');

    const alles = [...readdirSync(map), ...readdirSync(join(map, 'voorbeelden'))].join(' ');
    for (const naam of ['Jansen', 'Pietersen', 'Vries', 'nakijken']) expect(alles).not.toContain(naam);
  });

  it('maakt de map volledig opnieuw: verwijderde voorbeelden en template verdwijnen', () => {
    voegVoorbeeldToe('t', 't.docx', 'Indeling', 'goedgekeurd', true, '2026-04-01T10:00:00.000Z');
    voegVoorbeeldToe('v1', 'a.pdf', 'A', 'goedgekeurd', false, '2026-01-01T10:00:00.000Z');
    synchroniseerWerkmap(map);
    db.db.prepare('DELETE FROM voorbeelden').run();
    synchroniseerWerkmap(map);
    expect(existsSync(join(map, 'template.md'))).toBe(false);
    expect(readdirSync(join(map, 'voorbeelden'))).toEqual([]);
  });

  it('schrijfSysteemprompt en bestandsnamen', () => {
    const pad = schrijfSysteemprompt('Je bent …', map);
    expect(readFileSync(pad, 'utf8')).toBe('Je bent …');
    expect(voorbeeldBestandsnaam(3)).toBe('voorbeeld-03.md');
    expect(voorbeeldBestandsnaam(120)).toBe('voorbeeld-120.md');
  });
});
