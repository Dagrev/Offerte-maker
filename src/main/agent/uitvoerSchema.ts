import { z } from 'zod';

// Uitvoerschema van de agent (TDO §10.6): het JSON Schema dat met `--json-schema` meegaat, en de
// aanvullende zod-validatie die `taken.ts` op het antwoord toepast (§10.7 stap 4).

/** Letterlijk §10.6. */
export const UITVOER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'titel',
    'inleiding',
    'werkomschrijving',
    'regels',
    'uitvoering',
    'opmerkingen',
    'afsluiting',
    'controlepunten',
  ],
  properties: {
    titel: { type: 'string' },
    inleiding: { type: 'string' },
    werkomschrijving: { type: 'array', items: { type: 'string' } },
    regels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ref',
          'omschrijving',
          'aantal',
          'eenheid',
          'prijsEuro',
          'btwTarief',
          'prijsbron',
          'prijspostId',
        ],
        properties: {
          ref: { type: ['string', 'null'] },
          omschrijving: { type: 'string' },
          aantal: { type: 'number' },
          eenheid: { type: 'string', enum: ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'] },
          prijsEuro: { type: 'number' },
          btwTarief: { type: 'integer', enum: [0, 9, 21] },
          prijsbron: { type: 'string', enum: ['prijslijst', 'voorbeeld', 'schatting', 'handmatig'] },
          prijspostId: { type: ['string', 'null'] },
        },
      },
    },
    uitvoering: { type: 'string' },
    opmerkingen: { type: 'string' },
    afsluiting: { type: 'string' },
    controlepunten: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** Maximaal aantal controlepunten; daarboven afkappen, geen fout (§10.6). */
export const MAX_CONTROLEPUNTEN = 20;

const uitvoerRegelSchema = z.object({
  ref: z.string().nullable(),
  omschrijving: z.string(),
  aantal: z.number().min(0).max(100_000),
  eenheid: z.enum(['m²', 'm¹', 'stuk', 'post', 'uur', 'dag']),
  prijsEuro: z.number().min(0).max(1_000_000),
  btwTarief: z.union([z.literal(0), z.literal(9), z.literal(21)]),
  prijsbron: z.enum(['prijslijst', 'voorbeeld', 'schatting', 'handmatig']),
  prijspostId: z.string().nullable(),
});

/** Zod-validatie van het agentantwoord (§10.6 "Aanvullende zod-validatie"). */
export const agentUitvoerSchema = z.object({
  titel: z.string().min(1).max(150),
  inleiding: z.string(),
  werkomschrijving: z.array(z.string()).min(1).max(40),
  regels: z.array(uitvoerRegelSchema).min(1).max(80),
  uitvoering: z.string(),
  opmerkingen: z.string(),
  afsluiting: z.string(),
  controlepunten: z.array(z.string()).transform((punten) => punten.slice(0, MAX_CONTROLEPUNTEN)),
});

export type AgentUitvoer = z.infer<typeof agentUitvoerSchema>;
export type AgentUitvoerRegel = AgentUitvoer['regels'][number];
