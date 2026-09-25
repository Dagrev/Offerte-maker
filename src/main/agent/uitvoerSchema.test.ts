import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentUitvoerSchema, MAX_CONTROLEPUNTEN, UITVOER_SCHEMA } from './uitvoerSchema';

const fixture = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../test/fake-claude/fixtures/offerte-ok.json'), 'utf8'),
  ) as Record<string, unknown>;

const geldig = () => {
  const f = fixture();
  return { ...f, regels: [...(f['regels'] as Record<string, unknown>[])] };
};
const regel = (deel: Record<string, unknown> = {}) => ({ ...(fixture()['regels'] as object[])[0], ...deel });

describe('UITVOER_SCHEMA (§10.6)', () => {
  it('heeft de verplichte velden, ref als string|null en handmatig in de prijsbronnen', () => {
    expect(UITVOER_SCHEMA.required).toEqual([
      'titel',
      'inleiding',
      'werkomschrijving',
      'regels',
      'uitvoering',
      'opmerkingen',
      'afsluiting',
      'controlepunten',
    ]);
    const r = UITVOER_SCHEMA.properties.regels.items;
    expect(r.required).toContain('ref');
    expect(r.properties.ref.type).toEqual(['string', 'null']);
    expect(r.properties.prijsbron.enum).toEqual(['prijslijst', 'voorbeeld', 'schatting', 'handmatig']);
    expect(r.properties.btwTarief).toEqual({ type: 'integer', enum: [0, 9, 21] });
    expect(UITVOER_SCHEMA.additionalProperties).toBe(false);
    expect(r.additionalProperties).toBe(false);
  });
});

describe('agentUitvoerSchema (zod)', () => {
  it('accepteert de fixture', () => {
    expect(agentUitvoerSchema.safeParse(geldig()).success).toBe(true);
  });

  it.each([
    ['titel leeg', { titel: '' }],
    ['titel te lang', { titel: 'x'.repeat(151) }],
    ['geen werkomschrijving', { werkomschrijving: [] }],
    ['te veel werkomschrijving', { werkomschrijving: Array.from({ length: 41 }, () => 'stap') }],
    ['geen regels', { regels: [] }],
    ['te veel regels', { regels: Array.from({ length: 81 }, () => regel()) }],
    ['aantal negatief', { regels: [regel({ aantal: -1 })] }],
    ['aantal te groot', { regels: [regel({ aantal: 100_001 })] }],
    ['prijs te groot', { regels: [regel({ prijsEuro: 1_000_001 })] }],
    ['onbekende eenheid', { regels: [regel({ eenheid: 'kg' })] }],
    ['btw 6', { regels: [regel({ btwTarief: 6 })] }],
    ['onbekende prijsbron', { regels: [regel({ prijsbron: 'gok' })] }],
    ['ref ontbreekt', { regels: [{ ...regel(), ref: undefined }] }],
    ['uitvoering ontbreekt', { uitvoering: undefined }],
    ['geen object', null],
  ])('weigert: %s', (_, deel) => {
    const invoer = deel === null ? 'geen json' : { ...geldig(), ...deel };
    expect(agentUitvoerSchema.safeParse(invoer).success).toBe(false);
  });

  it('grenzen zijn toegestaan', () => {
    const r = agentUitvoerSchema.safeParse({
      ...geldig(),
      titel: 'x'.repeat(150),
      werkomschrijving: Array.from({ length: 40 }, () => 'stap'),
      regels: [
        regel({ aantal: 0, prijsEuro: 0 }),
        regel({ aantal: 100_000, prijsEuro: 1_000_000, ref: 'r1' }),
      ],
    });
    expect(r.success).toBe(true);
  });

  it('kapt meer dan 20 controlepunten af, zonder fout', () => {
    const r = agentUitvoerSchema.parse({
      ...geldig(),
      controlepunten: Array.from({ length: 25 }, (_, i) => `p${i}`),
    });
    expect(r.controlepunten).toHaveLength(MAX_CONTROLEPUNTEN);
    expect(r.controlepunten.at(-1)).toBe('p19');
  });
});
