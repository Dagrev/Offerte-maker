import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// De fixtures van de nep-CLI valideren tegen het uitvoerschema §10.6 (plus de aanvullende zod-grenzen)
// en het template_teksten-schema §10.5. OFM-013 bouwt het echte schema in agent/uitvoerSchema.ts.

const lees = (naam: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', naam), 'utf8'));

const regel = z.strictObject({
  ref: z.string().nullable(),
  omschrijving: z.string(),
  aantal: z.number().min(0).max(100_000),
  eenheid: z.enum(['m²', 'm¹', 'stuk', 'post', 'uur', 'dag']),
  prijsEuro: z.number().min(0).max(1_000_000),
  btwTarief: z.union([z.literal(0), z.literal(9), z.literal(21)]),
  prijsbron: z.enum(['prijslijst', 'voorbeeld', 'schatting', 'handmatig']),
  prijspostId: z.string().nullable(),
  // OFM-044: volgnummer van de werkzaamheidregel erboven, of null.
  onderdeelVan: z.number().int().nullable(),
});

const uitvoer = z.strictObject({
  titel: z.string().min(1).max(150),
  inleiding: z.string(),
  werkomschrijving: z.array(z.string()).min(1).max(40),
  regels: z.array(regel).min(1).max(80),
  uitvoering: z.string(),
  opmerkingen: z.string(),
  afsluiting: z.string(),
  controlepunten: z.array(z.string()),
});

const templateTeksten = z.strictObject({
  inleiding: z.string().optional(),
  afsluiting: z.string().optional(),
  betalingsvoorwaarden: z.string().optional(),
  garantie10: z.string().optional(),
  garantie20: z.string().optional(),
  voetnoot: z.string().optional(),
});

describe('offerte-ok.json', () => {
  const offerte = uitvoer.parse(lees('offerte-ok.json'));

  it('valideert tegen §10.6 met ref null bij maken', () => {
    expect(offerte.regels.every((r) => r.ref === null)).toBe(true);
  });

  it('1 schattingsregel, 2 controlepunten die de schatting niet noemen, [KLANT_NAAM] in de inleiding', () => {
    const schattingen = offerte.regels.filter((r) => r.prijsbron === 'schatting');
    expect(schattingen).toHaveLength(1);
    expect(offerte.controlepunten).toHaveLength(2);
    const schatting = schattingen[0]!.omschrijving.toLowerCase();
    for (const punt of offerte.controlepunten) expect(punt.toLowerCase()).not.toContain(schatting);
    expect(offerte.inleiding).toContain('[KLANT_NAAM]');
    expect(offerte.inleiding).not.toMatch(/^\s*(geachte|beste)\b/i);
  });
});

describe('template-teksten-ok.json', () => {
  it('valideert tegen het template_teksten-schema (§10.5)', () => {
    expect(templateTeksten.safeParse(lees('template-teksten-ok.json')).success).toBe(true);
  });
});
