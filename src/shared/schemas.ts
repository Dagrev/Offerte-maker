import { z } from 'zod';
import { FOUT_CODES } from './fouten';
import { KEUZE_LIJSTEN, KEUZE_SLEUTEL_PATROON } from './keuzelijsten';
import type { Kanaal } from './ipcKanalen';
import { controleerPostcode, ontleedHuisnummer } from './validatie';
import { STANDAARD_VERPLICHT, VERPLICHT_VELDEN, type VerplichtVeld } from './verplicht';

// Zod-schema's: de bron voor alle domeintypes (TDO §5, §6.3, §4.3, V-15) en de invoer van elk
// IPC-kanaal (§6.2, V-03). Types staan in types.ts en worden hier met z.infer van afgeleid.

// ---------- Basis ----------

export const idSchema = z.string().min(1).max(100);
/** `adres:zoek` (OFM-031/040): een huisnummer dat `ontleedHuisnummer` begrijpt. */
const huisnummerZoekSchema = z
  .string()
  .max(20)
  .refine((h) => ontleedHuisnummer(h) !== null);
/** `adres:zoek` (OFM-040): straat of plaats, met minstens één letter. */
const adresTekstSchema = z
  .string()
  .max(80)
  .refine((t) => /\p{L}/u.test(t));
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

/**
 * Tekstvelden mogen leeg zijn: een half ingevuld concept wordt ook bewaard (FE-025). Sinds OFM-038
 * voor- en achternaam apart (migratie 003 zette de oude `naam` in `achternaam`); bij aanhef `bedrijf`
 * zijn ze de contactpersoon. Het tussenvoegsel (OFM-046) is optioneel en nooit verplicht; een offerte
 * van vóór OFM-046 heeft het veld niet en krijgt bij lezen `''` (geen migratie).
 */
export const klantSchema = z.object({
  aanhef: aanhefSchema,
  voornaam: z.string(),
  tussenvoegsel: z.string().default(''),
  achternaam: z.string(),
  bedrijfsnaam: z.string(),
  adres: adresSchema,
  telefoon: z.string(),
  email: z.string(),
  heeftWerkadres: z.boolean(),
  werkadres: adresSchema,
});

/**
 * Keuzes uit de instelbare keuzelijsten (OFM-034): elke sleutel van de juiste vorm. Of de sleutel in
 * `keuzeopties` bestaat, controleert main bij `offerte:bewaarInvoer` (VALIDATIE bij een onbekende).
 */
export const keuzeSleutelSchema = z.string().regex(KEUZE_SLEUTEL_PATROON);
export const soortWerkSchema = keuzeSleutelSchema;
export const soortDakSchema = keuzeSleutelSchema;
export const huidigeBedekkingSchema = keuzeSleutelSchema;
export const ondergrondSchema = keuzeSleutelSchema;
export const hoogteSchema = keuzeSleutelSchema;
export const garantieSchema = keuzeSleutelSchema;

/** Maten en m² zijn nooit negatief (FE-024). */
export const dakvlakSchema = z.object({
  id: idSchema,
  naam: z.string(),
  modus: z.enum(['lxb', 'm2']),
  lengteM: nietNegatief.nullable(),
  breedteM: nietNegatief.nullable(),
  m2: nietNegatief.nullable(),
});

export const eenheidSchema = z.enum(['m²', 'm¹', 'stuk', 'post', 'uur', 'dag']);

/**
 * Een werkzaamheid, materiaal of optie in de offerte (OFM-044): uit de instellingen (`sleutel`) of
 * alleen voor deze offerte (`eenmalig`, met eigen naam en eenheid). Precies één van de twee is gezet.
 * Een half ingevulde eenmalige (lege naam) mag bewaard worden.
 */
const eenmaligSchema = z.object({ label: z.string().max(80), eenheid: eenheidSchema });
const eenVanTweeSchema = <T extends { sleutel: string | null; eenmalig: unknown }>(item: T) =>
  (item.sleutel === null) !== (item.eenmalig === null);

/** Prijs per eenheid in centen voor alleen deze offerte; `null` = geen prijs (ook niet in de prijslijst). */
const offertePrijsSchema = z.number().int().nonnegative().nullable();

export const gekozenMateriaalSchema = z
  .object({
    id: idSchema,
    sleutel: keuzeSleutelSchema.nullable(),
    eenmalig: eenmaligSchema.nullable(),
    aantal: nietNegatief,
    prijsCent: offertePrijsSchema,
  })
  .refine(eenVanTweeSchema);

export const gekozenOptieSchema = z.object({
  sleutel: keuzeSleutelSchema,
  prijsCent: offertePrijsSchema,
});

export const gekozenWerkzaamheidSchema = z
  .object({
    id: idSchema,
    sleutel: keuzeSleutelSchema.nullable(),
    eenmalig: eenmaligSchema.nullable(),
    aantal: nietNegatief,
    prijsCent: offertePrijsSchema,
    /**
     * OFM-048: prijs per uur in plaats van per eenheid. Dan is `aantal` het aantal uren, de eenheid op
     * de regel `uur` en de standaardprijs de uurprijs (`werk:<s>:uur`). Oude invoer heeft dit veld niet.
     */
    perUur: z.boolean().default(false),
    notitie: z.string().max(2000),
    materialen: z.array(gekozenMateriaalSchema).max(50),
    opties: z.array(gekozenOptieSchema).max(50),
  })
  .refine(eenVanTweeSchema);

/**
 * Maximaal 20 dakvlakken (V-16). Sinds OFM-044 bestaat een offerte uit `werkzaamheden`; de velden van
 * de oude stap Extra's (bedekking, isolatie, afwerking, slopen, de zes extra's en `extraAantallen`)
 * zijn in OFM-045 met migratie 005 omgezet en bestaan niet meer (`shared/omzetting.ts`).
 */
export const klusInvoerSchema = z.object({
  soortWerk: soortWerkSchema.nullable(),
  soortDak: soortDakSchema.nullable(),
  dakvlakken: z.array(dakvlakSchema).max(20),
  huidigeBedekking: huidigeBedekkingSchema.nullable(),
  ondergrond: ondergrondSchema.nullable(),
  hoogte: hoogteSchema.nullable(),
  werkzaamheden: z.array(gekozenWerkzaamheidSchema).max(40).default([]),
  steigerNodig: z.boolean(),
  /** Sleutel uit de lijst `garantie` ('10', '20', …); vóór migratie 002 een getal. */
  garantieJaren: garantieSchema.nullable(),
  gewensteUitvoering: z.string(),
  overig: z.string(),
});

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
  /**
   * OFM-044: id van de regel van de werkzaamheid waar deze regel (materiaal of optie) onder valt; de PDF
   * toont hem ingesprongen met een subtotaal. Ontbreekt of `null` = gewone regel.
   */
  onderdeelVan: idSchema.nullable().optional(),
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
  /** OFM-047: de invoer is veranderd sinds de inhoud er het laatst uit is gemaakt (gele regel op Detail). */
  invoerGewijzigd: z.boolean(),
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

/** Startwaarde van de e-mailtekst (OFM-041); de app vult de plaatshouders in, zie `main/mail/concept.ts`. */
export const STANDAARD_EMAILTEKST = [
  '{aanhef}',
  '',
  'Hierbij ontvangt u onze offerte {nummer}. U vindt de offerte als PDF in de bijlage. De offerte is geldig tot {geldigTot}.',
  '',
  'Heeft u vragen, neem dan gerust contact met ons op.',
  '',
  'Met vriendelijke groet,',
  '',
  '{bedrijfsnaam}',
].join('\n');

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
  /** OFM-041: tekst van de mail bij Verstuur per e-mail, met plaatshouders (`mail/concept.ts`). */
  emailTekst: z.string().default(STANDAARD_EMAILTEKST),
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

/**
 * Verplichte velden van de wizard (OFM-038): per veld `true`/`false`. Een ontbrekend veld (oude opslag
 * of een later toegevoegd veld) krijgt de standaard uit `shared/verplicht.ts`.
 */
export const verplichtSchema = z.object(
  Object.fromEntries(VERPLICHT_VELDEN.map((v) => [v, z.boolean().default(STANDAARD_VERPLICHT[v])])) as Record<
    VerplichtVeld,
    z.ZodDefault<z.ZodBoolean>
  >,
);

/** Schema per instellingssleutel (§4.3). OFM-003 leest en valideert de instellingen hiermee. */
export const instellingSchemas = {
  bedrijf: bedrijfSchema,
  opmaak: opmaakSchema,
  teksten: tekstenSchema,
  claude: claudeInstellingSchema,
  app: appInstellingSchema,
  verplicht: verplichtSchema,
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
  verplicht: verplichtSchema,
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

/** Keuzelijsten (OFM-034): één optie zoals `keuzelijsten:haal` hem geeft. */
export const keuzeLijstSchema = z.enum(KEUZE_LIJSTEN);

export const keuzeoptieSchema = z.object({
  id: idSchema,
  sleutel: keuzeSleutelSchema,
  label: z.string(),
  verborgen: z.boolean(),
  /** Uit de startset (voor "Herstel standaardlijst"). */
  standaard: z.boolean(),
  /**
   * Standaardkeuze van een nieuwe offerte (OFM-049; hoogstens één per lijst): niet te verbergen of te
   * verwijderen. Vervangt `vast` (OFM-034, vaste waarden in de code).
   */
  standaardkeuze: z.boolean(),
  /** Komt voor in een niet-verwijderde offerte: niet te verwijderen, wel te verbergen. */
  inGebruik: z.boolean(),
});

/** Werkzaamheden, opties en materialen (OFM-043, §6.2 `werkzaamheden:*`); prijzen uit de prijslijst. */
const prijsCentSchema = z.number().int().nonnegative().nullable();
/** Een lege naam weigert main met een eigen melding (`werkLeegLabel`). */
const itemLabelSchema = z.string().max(80);

export const werkOptieSchema = z.object({
  id: idSchema,
  sleutel: keuzeSleutelSchema,
  label: z.string(),
  eenheid: eenheidSchema,
  prijsCent: prijsCentSchema,
  verborgen: z.boolean(),
  inGebruik: z.boolean(),
});

export const werkzaamheidSchema = z.object({
  id: idSchema,
  sleutel: keuzeSleutelSchema,
  label: z.string(),
  eenheid: eenheidSchema,
  prijsCent: prijsCentSchema,
  /** OFM-048: prijs per uur (post `werk:<sleutel>:uur`); `null` = geen uurprijs ingesteld. */
  uurprijsCent: prijsCentSchema,
  /** OFM-048: btw van de werkzaamheid (voor beide posten). */
  btwTarief: btwTariefSchema,
  verborgen: z.boolean(),
  /** Uit de startset (voor "Herstel startset"). */
  standaard: z.boolean(),
  /** Komt voor in een niet-verwijderde offerte: niet te verwijderen, wel te verbergen. */
  inGebruik: z.boolean(),
  /** Sleutels uit de keuzelijst `soortWerk` waar deze werkzaamheid bij hoort. */
  soortenWerk: z.array(keuzeSleutelSchema),
  opties: z.array(werkOptieSchema),
  /** Kiesbare materialen (id's uit `materialen`), in de volgorde van de materialenlijst. */
  materialen: z.array(z.object({ materiaalId: idSchema, standaard: z.boolean() })),
});

export const materiaalSchema = z.object({
  id: idSchema,
  sleutel: keuzeSleutelSchema,
  label: z.string(),
  eenheid: eenheidSchema,
  prijsCent: prijsCentSchema,
  /** OFM-048 */
  btwTarief: btwTariefSchema,
  verborgen: z.boolean(),
  standaard: z.boolean(),
  inGebruik: z.boolean(),
});

/** Uitvoer van `werkzaamheden:haal` en `werkzaamheden:bewaar`: alles in één keer, in volgorde. */
export const werkzaamhedenSetSchema = z.object({
  /** De keuzelijst `soortWerk` met per soort de gekoppelde werkzaamheden (id's, in volgorde). */
  soortenWerk: z.array(
    z.object({
      sleutel: keuzeSleutelSchema,
      label: z.string(),
      verborgen: z.boolean(),
      werkzaamheden: z.array(idSchema),
    }),
  ),
  werkzaamheden: z.array(werkzaamheidSchema),
  materialen: z.array(materiaalSchema),
});

/** Invoer van `werkzaamheden:bewaar`: de hele set in de nieuwe volgorde. Een onbekende `id` = nieuw. */
export const werkzaamhedenBewaarSchema = z.object({
  werkzaamheden: z
    .array(
      z.object({
        id: idSchema,
        label: itemLabelSchema,
        eenheid: eenheidSchema,
        prijsCent: prijsCentSchema,
        /** OFM-048; weglaten = uurprijs niet wijzigen (nieuw: geen uurprijs). */
        uurprijsCent: prijsCentSchema.optional(),
        /** OFM-048; weglaten = btw niet wijzigen (nieuw: 21 %). */
        btwTarief: btwTariefSchema.optional(),
        verborgen: z.boolean(),
        soortenWerk: z.array(keuzeSleutelSchema).max(100),
        opties: z
          .array(
            z.object({
              id: idSchema,
              label: itemLabelSchema,
              eenheid: eenheidSchema,
              prijsCent: prijsCentSchema,
              verborgen: z.boolean(),
            }),
          )
          .max(50),
        materialen: z.array(z.object({ materiaalId: idSchema, standaard: z.boolean() })).max(200),
      }),
    )
    .max(200),
  materialen: z
    .array(
      z.object({
        id: idSchema,
        label: itemLabelSchema,
        eenheid: eenheidSchema,
        prijsCent: prijsCentSchema,
        /** OFM-048; weglaten = btw niet wijzigen (nieuw: 21 %). */
        btwTarief: btwTariefSchema.optional(),
        verborgen: z.boolean(),
      }),
    )
    .max(200),
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
  'offerte:mail': metId,

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
    z.object({ sleutel: z.literal('verplicht'), waarde: verplichtSchema.required() }),
  ]),
  'instellingen:kiesLogo': geenInvoer,
  'instellingen:verwijderLogo': geenInvoer,
  'instellingen:opmaakVoorbeeld': z.object({ opmaak: opmaakSchema.required() }),

  'keuzelijsten:haal': geenInvoer,
  /** De hele lijst in de nieuwe volgorde; `id` leeg = nieuwe optie, ontbrekende opties = verwijderen. */
  'keuzelijsten:bewaar': z.object({
    lijst: keuzeLijstSchema,
    opties: z
      .array(
        z.object({
          id: z.string().max(100),
          label: z.string().trim().min(1).max(80),
          verborgen: z.boolean(),
          /** OFM-049: hoogstens één optie per lijst; geen enkele = geen standaard. */
          standaardkeuze: z.boolean(),
        }),
      )
      .max(100)
      .refine((opties) => opties.filter((o) => o.standaardkeuze).length <= 1),
  }),
  'keuzelijsten:herstel': z.object({ lijst: keuzeLijstSchema }),

  'werkzaamheden:haal': geenInvoer,
  'werkzaamheden:bewaar': werkzaamhedenBewaarSchema,
  'werkzaamheden:herstel': geenInvoer,

  /**
   * OFM-031/040: postcode + huisnummer, óf straat + huisnummer + plaats (A-29). Alleen geldige
   * adreswaarden gaan naar PDOK; andere sleutels (bijv. een naam) vallen weg.
   */
  'adres:zoek': z.union([
    z.object({
      postcode: z
        .string()
        .max(10)
        .refine((p) => {
          const c = controleerPostcode(p);
          return c.geldig && c.waarde !== '';
        }),
      huisnummer: huisnummerZoekSchema,
    }),
    z.object({
      straat: adresTekstSchema,
      huisnummer: huisnummerZoekSchema,
      plaats: adresTekstSchema,
    }),
  ]),

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
