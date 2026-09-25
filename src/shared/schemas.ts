import { z } from 'zod';
import { FOUT_CODES } from './fouten';
import type { Kanaal } from './ipcKanalen';

// Zod-schema's: de bron voor alle domeintypes (TDO §5, §6.3, §4.3, V-15) en de invoer van elk
// IPC-kanaal (§6.2, V-03). Types staan in types.ts en worden hier met z.infer van afgeleid.

// ---------- Basis ----------

export const idSchema = z.string().min(1).max(100);
/** Datum als `YYYY-MM-DD`. */
export const datumSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nietNegatief = z.number().finite().nonnegative();
const aantal = z.number().int().nonnegative();
export const foutCodeSchema = z.enum(FOUT_CODES);

// ---------- §5 Domeintypes ----------

export const aanhefSchema = z.enum(['dhr', 'mevr', 'fam', 'bedrijf']);

export const adresSchema = z.object({
  straatHuisnummer: z.string(),
  postcode: z.string(),
  plaats: z.string(),
});

/** Tekstvelden mogen leeg zijn: een half ingevuld concept wordt ook bewaard (FE-025). */
export const klantSchema = z.object({
  aanhef: aanhefSchema,
  naam: z.string(),
  bedrijfsnaam: z.string(),
  adres: adresSchema,
  telefoon: z.string(),
  email: z.string(),
  heeftWerkadres: z.boolean(),
  werkadres: adresSchema,
});

export const soortWerkSchema = z.enum([
  'nieuw_dak',
  'dak_vervangen',
  'reparatie',
  'dakgoten',
  'isolatie',
  'onderhoud',
]);
export const soortDakSchema = z.enum(['plat', 'hellend']);
export const bedekkingSchema = z.enum(['epdm_11', 'epdm_15', 'resitrix', 'bitumen', 'anders']);
export const huidigeBedekkingSchema = z.enum(['bitumen', 'epdm', 'grind_op_bitumen', 'onbekend']);
export const ondergrondSchema = z.enum(['hout', 'beton', 'staal', 'onbekend']);
export const isolatieSchema = z.enum(['geen', '80', '100', '120', 'anders']);
export const afwerkingSchema = z.enum(['geen', 'grind', 'sedum']);
export const hoogteSchema = z.enum(['1', '2', '3plus']);

/** Maten en m² zijn nooit negatief (FE-024). */
export const dakvlakSchema = z.object({
  id: idSchema,
  naam: z.string(),
  modus: z.enum(['lxb', 'm2']),
  lengteM: nietNegatief.nullable(),
  breedteM: nietNegatief.nullable(),
  m2: nietNegatief.nullable(),
});

/** Maximaal 20 dakvlakken (V-16). */
export const klusInvoerSchema = z.object({
  soortWerk: soortWerkSchema.nullable(),
  soortDak: soortDakSchema.nullable(),
  dakvlakken: z.array(dakvlakSchema).max(20),
  bedekking: bedekkingSchema.nullable(),
  bedekkingAnders: z.string(),
  huidigeBedekking: huidigeBedekkingSchema.nullable(),
  ondergrond: ondergrondSchema.nullable(),
  slopenEnAfvoeren: z.boolean(),
  isolatie: isolatieSchema,
  isolatieAndersMm: nietNegatief.nullable(),
  daktrimM1: nietNegatief,
  dakgootM1: nietNegatief,
  hwaAantal: aantal,
  noodoverloopAantal: aantal,
  doorvoerAantal: aantal,
  lichtkoepelAantal: aantal,
  afwerking: afwerkingSchema,
  hoogte: hoogteSchema,
  steigerNodig: z.boolean(),
  garantieJaren: z.union([z.literal(10), z.literal(20)]),
  gewensteUitvoering: z.string(),
  overig: z.string(),
});

export const eenheidSchema = z.enum(['m²', 'm¹', 'stuk', 'post', 'uur', 'dag']);
export const btwTariefSchema = z.union([z.literal(0), z.literal(9), z.literal(21)]);
export const prijsbronSchema = z.enum(['prijslijst', 'voorbeeld', 'schatting', 'handmatig']);

/** Bedragen en aantallen als integers (§7): 34,8 → `aantalHonderdsten` 3480. */
export const offerteregelSchema = z.object({
  id: idSchema,
  omschrijving: z.string(),
  aantalHonderdsten: z.number().int(),
  eenheid: eenheidSchema,
  prijsCent: z.number().int(),
  btwTarief: btwTariefSchema,
  prijsbron: prijsbronSchema,
  prijspostId: idSchema.nullable(),
});

export const offerteInhoudSchema = z.object({
  titel: z.string(),
  inleiding: z.string(),
  werkomschrijving: z.array(z.string()),
  regels: z.array(offerteregelSchema),
  uitvoering: z.string(),
  opmerkingen: z.string(),
  afsluiting: z.string(),
  controlepunten: z.array(z.string()),
});

export const statusSchema = z.enum(['concept', 'klaar', 'verstuurd', 'akkoord', 'afgewezen']);

export const totalenSchema = z.object({
  subtotaalCent: z.number().int(),
  btw: z.array(
    z.object({ tarief: btwTariefSchema, grondslagCent: z.number().int(), bedragCent: z.number().int() }),
  ),
  totaalCent: z.number().int(),
});

// ---------- §6.3 Samengestelde typen ----------

export const offerteLijstItemSchema = z.object({
  id: idSchema,
  nummer: z.string().nullable(),
  status: statusSchema,
  klantWeergave: z.string(),
  plaats: z.string(),
  omschrijvingKort: z.string(),
  totaalInclCent: z.number().int().nullable(),
  offertedatum: datumSchema,
});

export const overzichtResultaatSchema = z.object({
  periode: z.object({ van: datumSchema, tot: datumSchema, label: z.string() }),
  items: z.array(offerteLijstItemSchema),
  groepen: z
    .array(
      z.object({
        maand: z.number().int().min(1).max(12),
        label: z.string(),
        items: z.array(offerteLijstItemSchema),
        subtotaalCent: z.number().int(),
      }),
    )
    .nullable(),
  samenvatting: z.object({ aantal: aantal, totaalCent: z.number().int(), aantalAkkoord: aantal }),
});

export const offerteDetailSchema = z.object({
  id: idSchema,
  status: statusSchema,
  nummer: z.string().nullable(),
  offertedatum: datumSchema,
  geldigTot: datumSchema,
  wizardStap: z.number().int(),
  klant: klantSchema,
  invoer: klusInvoerSchema,
  inhoud: offerteInhoudSchema.nullable(),
  totalen: totalenSchema.nullable(),
  versies: z.array(
    z.object({ id: idSchema, versieNr: z.number().int(), bron: z.string(), aangemaaktOp: z.string() }),
  ),
  pdfs: z.array(z.object({ versieletter: z.string(), pad: z.string(), aangemaaktOp: z.string() })),
  gewijzigdNaDefinitief: z.boolean(),
});

// ---------- §4.3 Instellingen (met standaardwaarden; ontbrekend = standaard) ----------

export const bedrijfSchema = z.object({
  naam: z.string().default(''),
  contactpersoon: z.string().default(''),
  adres: z.string().default(''),
  postcode: z.string().default(''),
  plaats: z.string().default(''),
  telefoon: z.string().default(''),
  email: z.string().default(''),
  website: z.string().default(''),
  kvk: z.string().default(''),
  btwNummer: z.string().default(''),
  iban: z.string().default(''),
  logoBestandId: idSchema.nullable().default(null),
});

export const ACCENTKLEUREN = ['#1F4E79', '#2E7D32', '#B71C1C', '#E65100', '#37474F', '#6A1B9A'] as const;

export const opmaakSchema = z.object({
  layout: z.enum(['klassiek', 'modern', 'compact']).default('klassiek'),
  accentkleur: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#1F4E79'),
  lettertype: z.enum(['inter', 'merriweather', 'source-sans-3']).default('inter'),
});

/** Startwaarden letterlijk uit §9.4 (V-13: schema-standaardwaarden, pas opgeslagen na wijzigen). */
export const tekstenSchema = z.object({
  inleiding: z
    .string()
    .default(
      'Naar aanleiding van uw aanvraag doen wij u hierbij graag een offerte toekomen voor de onderstaande werkzaamheden.',
    ),
  garantie10: z
    .string()
    .default(
      'Op de uitgevoerde werkzaamheden geven wij 10 jaar schriftelijke garantie op waterdichtheid, zonder verplicht onderhoudscontract.',
    ),
  garantie20: z
    .string()
    .default('Op de uitgevoerde werkzaamheden geven wij 20 jaar verzekerde garantie op waterdichtheid.'),
  betalingsvoorwaarden: z
    .string()
    .default('Betaling binnen 14 dagen na oplevering en ontvangst van de factuur.'),
  afsluiting: z
    .string()
    .default(
      'Wij vertrouwen erop u hiermee een passende aanbieding te hebben gedaan. Heeft u vragen, neem dan gerust contact met ons op.',
    ),
  voetnoot: z.string().default(''),
  geldigheidDagen: z.number().int().min(1).max(365).default(30),
});

export const effortSchema = z.enum(['low', 'medium', 'high']);

/** Pad naar claude.exe (§10.2); `null` = automatisch zoeken. */
const claudePadSchema = z
  .string()
  .regex(/\.exe$/i)
  .nullable();

/** Zoals opgeslagen in de database (met versleutelde API-sleutel, base64). */
export const claudeInstellingSchema = z.object({
  pad: claudePadSchema.default(null),
  model: z.string().min(1).default('opus'),
  effort: effortSchema.default('medium'),
  apiSleutelVersleuteld: z.string().nullable().default(null),
});

export const appInstellingSchema = z.object({
  welkomVoltooid: z.boolean().default(false),
  laatsteBackupDatum: datumSchema.nullable().default(null),
  laatsteClaudeFout: z.object({ code: foutCodeSchema, tijdstip: z.string() }).nullable().default(null),
});

/** Schema per instellingssleutel (§4.3). OFM-003 leest en valideert de instellingen hiermee. */
export const instellingSchemas = {
  bedrijf: bedrijfSchema,
  opmaak: opmaakSchema,
  teksten: tekstenSchema,
  claude: claudeInstellingSchema,
  app: appInstellingSchema,
} as const;

export type InstellingSleutel = keyof typeof instellingSchemas;

/** Standaardwaarde per sleutel (`schema.parse({})`). */
export function standaardInstelling<S extends InstellingSleutel>(
  sleutel: S,
): z.infer<(typeof instellingSchemas)[S]> {
  return instellingSchemas[sleutel].parse({}) as z.infer<(typeof instellingSchemas)[S]>;
}

/** Wat de renderer krijgt via `instellingen:haal` (V-15). */
export const instellingenSchema = z.object({
  bedrijf: bedrijfSchema.extend({ logoDataUri: z.string().nullable() }),
  opmaak: opmaakSchema,
  teksten: tekstenSchema,
  claude: z.object({
    pad: claudePadSchema,
    model: z.string(),
    effort: effortSchema,
    apiSleutelIngevuld: z.boolean(),
  }),
  app: z.object({ welkomVoltooid: z.boolean() }),
});

// ---------- V-15 en overige typen ----------

/** `id` leeg = nieuwe prijspost (`prijzen:bewaar`). */
export const prijspostSchema = z.object({
  id: z.string().max(100),
  sleutel: z.string().nullable(),
  omschrijving: z.string().trim().min(1),
  eenheid: eenheidSchema,
  prijsCent: z.number().int().nonnegative().nullable(),
  btwTarief: btwTariefSchema,
  volgorde: z.number().int(),
});

export const voorbeeldStatusSchema = z.enum(['te_controleren', 'goedgekeurd']);

export const voorbeeldItemSchema = z.object({
  id: idSchema,
  bestandsnaam: z.string(),
  status: voorbeeldStatusSchema,
  isTemplate: z.boolean(),
  aangemaaktOp: z.string(),
});

export const claudeStatusSchema = z.discriminatedUnion('toestand', [
  z.object({ toestand: z.literal('gekoppeld'), versie: z.string(), via: z.enum(['account', 'api-sleutel']) }),
  z.object({
    toestand: z.literal('fout'),
    code: z.enum(['CLAUDE_NIET_GEINSTALLEERD', 'CLAUDE_TE_OUD', 'CLAUDE_NIET_INGELOGD', 'GEEN_INTERNET']),
    versie: z.string().nullable(),
  }),
]);

export const appInfoSchema = z.object({
  versie: z.string(),
  welkomVoltooid: z.boolean(),
  vandaag: datumSchema,
  dataMap: z.string(),
  documentenMap: z.string(),
});

export const privacylogItemSchema = z.object({
  id: idSchema,
  tijdstip: z.string(),
  offerteNummer: z.string().nullable(),
  soort: z.enum(['maken', 'aanpassen', 'template_teksten', 'test']),
  resultaat: z.enum(['ok', 'fout', 'afgebroken']),
  foutcode: z.string().nullable(),
});

export const privacylogDetailSchema = privacylogItemSchema.extend({
  opdracht: z.string(),
  antwoord: z.string().nullable(),
});

/** Bestandsnaam van een back-up (V-19); alleen de naam, gezocht in `backupMap`. */
export const backupBestandSchema = z
  .string()
  .regex(/^offerte-maker-\d{4}-\d{2}-\d{2}-\d{6}-(dagelijks|handmatig|voor-migratie|voor-herstel)\.sqlite$/);

export const backupItemSchema = z.object({
  bestand: backupBestandSchema,
  tijdstip: z.string(),
  grootteBytes: aantal,
});

/** Event `offerte:voortgang`; `id` is een offerte-ID of `'template_teksten'` (V-08). */
export const voortgangSchema = z.object({
  id: z.string(),
  fase: z.enum(['controleren', 'versturen', 'schrijven', 'verwerken', 'klaar', 'fout']),
  verstrekenS: aantal,
});

// ---------- §6.2 Invoer per kanaal ----------

const geenInvoer = z.undefined();
const metId = z.object({ id: idSchema });

export const invoerSchemas = {
  'app:info': geenInvoer,
  'app:openMap': z.object({ welke: z.enum(['log', 'offertes']) }),
  'welkom:voltooi': geenInvoer,

  'overzicht:lijst': z.object({ weergave: z.enum(['dag', 'week', 'maand', 'jaar']), datum: datumSchema }),
  'overzicht:zoek': z.object({ tekst: z.string().min(1).max(100) }),

  'offerte:nieuw': z.object({ bronId: idSchema.optional(), zelfdeKlant: z.boolean().optional() }),
  'offerte:haal': metId,
  'offerte:bewaarInvoer': z.object({
    id: idSchema,
    klant: klantSchema.optional(),
    invoer: klusInvoerSchema.optional(),
    wizardStap: z.number().int().min(1).max(4).optional(),
    offertedatum: datumSchema.optional(),
  }),

  'offerte:maak': metId,
  'offerte:stop': z.object({ id: z.union([z.literal('template_teksten'), idSchema]) }),
  'offerte:pasAanMetClaude': z.object({ id: idSchema, instructie: z.string().min(1).max(2000) }),
  'offerte:zetVersieTerug': z.object({ id: idSchema, versieId: idSchema }),
  'offerte:maakZonderClaude': metId,

  'offerte:bewaarInhoud': z.object({ id: idSchema, inhoud: offerteInhoudSchema }),
  'offerte:voorbeeldHtml': metId,

  'offerte:maakDefinitief': metId,
  'offerte:openPdf': metId,
  'offerte:afdrukken': metId,
  'offerte:toonInMap': metId,

  'offerte:zetStatus': z.object({
    id: idSchema,
    status: z.enum(['klaar', 'verstuurd', 'akkoord', 'afgewezen']),
  }),
  'offerte:verwijder': metId,
  'offerte:zetTerug': metId,
  'prullenbak:lijst': geenInvoer,

  'instellingen:haal': geenInvoer,
  /** Per sleutel een eigen schema. `bedrijf` zonder `logoBestandId` (logo via kiesLogo/verwijderLogo),
   *  `claude` zonder sleutelveld (API-sleutel via `claude:bewaarApiSleutel`). Defaults gelden hier niet. */
  'instellingen:bewaar': z.discriminatedUnion('sleutel', [
    z.object({
      sleutel: z.literal('bedrijf'),
      waarde: bedrijfSchema.omit({ logoBestandId: true }).required(),
    }),
    z.object({ sleutel: z.literal('opmaak'), waarde: opmaakSchema.required() }),
    z.object({ sleutel: z.literal('teksten'), waarde: tekstenSchema.required() }),
    z.object({
      sleutel: z.literal('claude'),
      waarde: z.object({ pad: claudePadSchema, model: z.string().min(1), effort: effortSchema }),
    }),
  ]),
  'instellingen:kiesLogo': geenInvoer,
  'instellingen:verwijderLogo': geenInvoer,
  'instellingen:opmaakVoorbeeld': z.object({ opmaak: opmaakSchema.required() }),

  'prijzen:lijst': geenInvoer,
  'prijzen:bewaar': prijspostSchema,
  'prijzen:verwijder': metId,

  'voorbeelden:lijst': geenInvoer,
  'voorbeelden:voegToe': z.object({ paden: z.array(z.string().min(1)).max(100).optional() }),
  'voorbeelden:haal': metId,
  'voorbeelden:maakOnleesbaar': z.object({ id: idSchema, fragment: z.string().min(2).max(200) }),
  'voorbeelden:keurGoed': metId,
  'voorbeelden:zetTemplate': z.object({ id: idSchema.nullable() }),
  'voorbeelden:verwijder': metId,
  'voorbeelden:tekstenUitTemplate': geenInvoer,

  'claude:status': geenInvoer,
  'claude:login': geenInvoer,
  'claude:test': geenInvoer,
  'claude:bewaarApiSleutel': z.object({ sleutel: z.string().trim().min(1).nullable() }),
  'claude:kiesPad': geenInvoer,

  'privacylog:lijst': geenInvoer,
  'privacylog:haal': metId,

  'backup:lijst': geenInvoer,
  'backup:maak': geenInvoer,
  'backup:zetTerug': z.object({ bestand: backupBestandSchema }),
} satisfies Record<Kanaal, z.ZodType>;
