import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { voegPrijzenSamen } from '../src/main/db/prijzenSamenvoegen';
import { zetWerkzaamhedenStartset } from '../src/main/db/werkzaamhedenStartset';
import { berekenTotalen } from '../src/shared/calc/bedragen';
import { KEUZE_LIJSTEN, KEUZE_STARTSET, STANDAARDKEUZE_STARTSET } from '../src/shared/keuzelijsten';
import { volledigeNaam } from '../src/shared/labels';
import { legeKlant, legeKlusInvoer, zoektekstVan } from '../src/shared/nieuweOfferte';
import { formatNummer } from '../src/shared/nummering';
import { omschrijvingKort } from '../src/shared/omschrijvingKort';
import { berekenGeldigTot } from '../src/shared/periode';
import { PRIJS_STARTSET } from '../src/shared/prijsStartset';
import type {
  Aanhef,
  Dakvlak,
  GekozenWerkzaamheid,
  Klant,
  KlusInvoer,
  OfferteInhoud,
  Offerteregel,
  SoortDak,
  SoortWerk,
  Status,
} from '../src/shared/types';
import {
  MATERIALEN_STARTSET,
  WERKZAAMHEDEN_STARTSET,
  materiaalPrijsSleutel,
  optiePrijsSleutel,
  standaardAantal,
  werkPrijsSleutel,
  type StartWerkzaamheid,
} from '../src/shared/werkzaamheden';

// Seed-gegevens voor de prestatietests (TDO §15.4, NFE-003/004). Vaste random-seed 42: twee runs geven
// precies dezelfde rijen. Wordt gebruikt door `scripts/seed.ts` (pnpm seed) en `test/seed/seed.test.ts`.
// Draait onder Electron-als-Node (V-04) en importeert daarom niets uit `src/main` (dat heeft `electron`
// en `import.meta.glob` nodig); alleen pure functies uit `src/shared`. Sinds OFM-045 bestaat elke
// offerte uit 1–4 werkzaamheden van zijn soort werk (startset §9.6), met materialen en opties, en zijn
// de regels daaruit gemaakt zoals Maak zonder Claude dat doet (subregels met `onderdeelVan`).

export const SEED_AANTAL = 5000;
const EERSTE_JAAR = 2022;
const LAATSTE_JAAR = 2026;
const SEED_PREFIX = 'seed-';
const GELDIGHEID_DAGEN = 30;

/** mulberry32: klein, snel en deterministisch. */
export function maakRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACHTERNAMEN = [
  'de Vries',
  'Jansen',
  'van den Berg',
  'Bakker',
  'Visser',
  'Smit',
  'Meijer',
  'de Boer',
  'Mulder',
  'de Groot',
  'Bos',
  'Vos',
  'Peters',
  'Hendriks',
  'van Leeuwen',
  'Dekker',
  'Brouwer',
  'de Wit',
  'Dijkstra',
  'Smits',
  'de Graaf',
  'van der Meer',
  'van der Linden',
  'Kok',
  'Jacobs',
  'de Haan',
  'Vermeulen',
  'van den Heuvel',
  'van der Veen',
  'van den Broek',
  'de Bruijn',
  'de Jong',
  'van Dijk',
  'Schouten',
  'Willems',
  'Hoekstra',
  'Koster',
  'Prins',
  'Maas',
  'Verhoeven',
];
const VOORNAMEN = ['Anna', 'Bram', 'Jan', 'Maria', 'Pieter'];

/**
 * Vaste lijst van 200 namen (40 achternamen × 5 voornamen; OFM-038: voor- en achternaam apart). Sinds
 * OFM-046 staat het tussenvoegsel (de kleine woorden vooraan, "van den") in een eigen veld.
 */
export const SEED_NAMEN: readonly { voornaam: string; tussenvoegsel: string; achternaam: string }[] =
  ACHTERNAMEN.flatMap((volledig) => {
    const [, tussenvoegsel = '', achternaam = volledig] = /^((?:[a-z']+ )*)(.+)$/.exec(volledig) ?? [];
    return VOORNAMEN.map((voornaam) => ({ voornaam, tussenvoegsel: tussenvoegsel.trim(), achternaam }));
  });

const PLAATSEN = [
  'Eindhoven',
  'Veldhoven',
  'Best',
  'Son',
  'Nuenen',
  'Geldrop',
  'Waalre',
  'Helmond',
  'Oirschot',
  'Valkenswaard',
  'Tilburg',
  'Den Bosch',
  'Oss',
  'Boxtel',
  'Uden',
  'Veghel',
  'Weert',
  'Breda',
  'Roosmalen',
  'Rosmalen',
];
const STRATEN = [
  'Kerkstraat',
  'Dorpsstraat',
  'Molenweg',
  'Stationsstraat',
  'Schoolstraat',
  'Beukenlaan',
  'Eikenlaan',
];
const SOORTEN_WERK: SoortWerk[] = [
  'nieuw_dak',
  'dak_vervangen',
  'reparatie',
  'dakgoten',
  'isolatie',
  'onderhoud',
];
const SOORTEN_DAK: SoortDak[] = ['plat', 'plat', 'plat', 'hellend'];
const AANHEFFEN: Aanhef[] = ['dhr', 'mevr', 'fam', 'bedrijf'];
const NIET_CONCEPT: Status[] = ['klaar', 'verstuurd', 'akkoord', 'afgewezen'];

export interface SeedUitkomst {
  aantal: number;
  concept: number;
  perStatus: Record<Status, number>;
}

/** Past de migraties toe op een lege database, zoals `migreer()` in main (§4.1, V-13). */
export function zorgVoorSchema(db: Database.Database): void {
  const versie = db.pragma('user_version', { simple: true }) as number;
  if (versie > 0) return;
  const map = resolve(import.meta.dirname, '..', 'src', 'main', 'db', 'migraties');
  const bestanden = readdirSync(map)
    .filter((n) => /^\d{3}_[\w-]+\.sql$/.test(n))
    .sort();
  db.transaction(() => {
    for (const naam of bestanden) db.exec(readFileSync(join(map, naam), 'utf8'));
    // Zelfde startset als `voegStartsetIn()` in src/main/db/migraties.ts.
    const invoegen = db.prepare(
      'INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, ?, ?, ?, NULL, ?, ?)',
    );
    PRIJS_STARTSET.forEach((post, index) => {
      invoegen.run(
        `start-${post.sleutel}`,
        post.sleutel,
        post.omschrijving,
        post.eenheid,
        post.btwTarief,
        (index + 1) * 10,
      );
    });
    // Zelfde startset als `voegKeuzeStartsetIn()` (OFM-034), met de standaardkeuzes die migratie 007
    // zet (OFM-049; hier draait de SQL vóór de startset, dus de UPDATE van 007 vond nog niets).
    const keuze = db.prepare(
      'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze) VALUES (?, ?, ?, ?, ?, 0, 1, ?)',
    );
    for (const lijst of KEUZE_LIJSTEN) {
      KEUZE_STARTSET[lijst].forEach((o, index) => {
        const standaardkeuze = STANDAARDKEUZE_STARTSET[lijst] === o.sleutel ? 1 : 0;
        keuze.run(`start-${lijst}-${o.sleutel}`, lijst, o.sleutel, o.label, (index + 1) * 10, standaardkeuze);
      });
    }
    // Werkzaamheden, opties en materialen (OFM-043), na de keuzelijsten (koppeling met soort werk).
    zetWerkzaamhedenStartset(db);
    // OFM-048 (migratie 006): uurprijs-posten, oude losse posten weg (er zijn nog geen offertes).
    voegPrijzenSamen(db);
    // Hoogste migratienummer, niet het aantal bestanden (zoals `migreer()`).
    db.pragma(`user_version = ${Number(bestanden.at(-1)?.slice(0, 3) ?? 0)}`);
  })();
}

function kies<T>(random: () => number, lijst: readonly T[]): T {
  return lijst[Math.floor(random() * lijst.length)] as T;
}

function geheel(random: () => number, van: number, tot: number): number {
  return van + Math.floor(random() * (tot - van + 1));
}

function datumOpDag(dagIndex: number): string {
  const d = new Date(Date.UTC(EERSTE_JAAR, 0, 1 + dagIndex));
  return d.toISOString().slice(0, 10);
}

const AANTAL_DAGEN = (Date.UTC(LAATSTE_JAAR + 1, 0, 1) - Date.UTC(EERSTE_JAAR, 0, 1)) / 86_400_000;

/** Precies 10 % concept, de rest gelijk verdeeld over de vier andere statussen, geschud. */
function statussen(random: () => number, aantal: number): Status[] {
  const concept = Math.round(aantal / 10);
  const lijst: Status[] = Array.from({ length: aantal }, (_, i) =>
    i < concept ? 'concept' : (NIET_CONCEPT[(i - concept) % NIET_CONCEPT.length] as Status),
  );
  for (let i = lijst.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [lijst[i], lijst[j]] = [lijst[j] as Status, lijst[i] as Status];
  }
  return lijst;
}

interface SeedOfferte {
  id: string;
  status: Status;
  offertedatum: string;
  klant: Klant;
  invoer: KlusInvoer;
  inhoud: OfferteInhoud;
}

function maakOfferte(random: () => number, n: number, status: Status): SeedOfferte {
  const id = `${SEED_PREFIX}${String(n).padStart(5, '0')}`;
  const aanhef = kies(random, AANHEFFEN);
  const klant: Klant = {
    ...legeKlant(),
    aanhef,
    ...kies(random, SEED_NAMEN),
    bedrijfsnaam: aanhef === 'bedrijf' ? `Bedrijf ${kies(random, ACHTERNAMEN)}` : '',
    adres: {
      straatHuisnummer: `${kies(random, STRATEN)} ${geheel(random, 1, 180)}`,
      postcode: `${geheel(random, 5000, 5999)} ${String.fromCharCode(65 + geheel(random, 0, 25))}${String.fromCharCode(65 + geheel(random, 0, 25))}`,
      plaats: kies(random, PLAATSEN),
    },
  };

  const vlakken: Dakvlak[] = Array.from({ length: geheel(random, 1, 3) }, (_, i) => ({
    id: `${id}-v${i + 1}`,
    naam: `Dakvlak ${i + 1}`,
    modus: 'm2',
    lengteM: null,
    breedteM: null,
    m2: geheel(random, 800, 12000) / 100,
  }));
  const soortWerk = kies(random, SOORTEN_WERK);
  const m2 = vlakken.reduce((som, v) => som + (v.m2 ?? 0), 0);
  const werkzaamheden = kiesWerkzaamheden(random, id, soortWerk, m2);
  const invoer: KlusInvoer = {
    ...legeKlusInvoer(),
    soortWerk,
    soortDak: kies(random, SOORTEN_DAK),
    dakvlakken: vlakken,
    werkzaamheden,
  };
  const regels = regelsVan(id, werkzaamheden);
  const inhoud: OfferteInhoud = {
    titel: 'Offerte dakwerkzaamheden',
    inleiding: 'Hierbij ontvangt u onze offerte voor de besproken werkzaamheden aan uw dak.',
    werkomschrijving: regels.map((r) => r.omschrijving),
    regels,
    uitvoering: 'In overleg, afhankelijk van het weer.',
    opmerkingen: '',
    afsluiting: 'Wij vertrouwen erop u een passende aanbieding te hebben gedaan.',
    controlepunten: [],
  };

  const offertedatum = datumOpDag(Math.floor(random() * AANTAL_DAGEN));
  return { id, status, offertedatum, klant, invoer, inhoud };
}

/** Prijspost-id van een startpost: `start-<sleutel>` (§9.3, `zetPrijspost`). */
const postId = (sleutel: string) => `start-${sleutel}`;

/**
 * 1–4 werkzaamheden die bij de soort werk horen (in de volgorde van de startset), elk met een prijs;
 * met materialen een gekozen materiaal, bij Slopen de helft van de keren een afvalcontainer.
 */
function kiesWerkzaamheden(
  random: () => number,
  id: string,
  soortWerk: string,
  m2: number,
): GekozenWerkzaamheid[] {
  const bij = WERKZAAMHEDEN_STARTSET.filter((w) => w.soortenWerk.includes(soortWerk));
  const aantal = geheel(random, 1, Math.min(4, bij.length));
  // Fisher-Yates met de vaste random, dan de eerste `aantal`.
  const geschud = [...bij];
  for (let i = geschud.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [geschud[i], geschud[j]] = [geschud[j] as StartWerkzaamheid, geschud[i] as StartWerkzaamheid];
  }
  const gekozen = geschud.slice(0, aantal);
  return bij
    .filter((w) => gekozen.includes(w))
    .map((w, i) => {
      const werkAantal = standaardAantal(w.eenheid, m2) || 1;
      const materiaal = w.materialen.length > 0 ? kies(random, w.materialen) : null;
      const eenheid = MATERIALEN_STARTSET.find((m) => m.sleutel === materiaal)?.eenheid;
      return {
        id: `${id}-w${i + 1}`,
        sleutel: w.sleutel,
        eenmalig: null,
        aantal: werkAantal,
        prijsCent: geheel(random, 500, 9500),
        perUur: false,
        notitie: '',
        materialen:
          materiaal === null
            ? []
            : [
                {
                  id: `${id}-w${i + 1}-m1`,
                  sleutel: materiaal,
                  eenmalig: null,
                  aantal: eenheid === w.eenheid ? werkAantal : 1,
                  prijsCent: geheel(random, 500, 9500),
                },
              ],
        opties: w.opties
          .filter(() => random() < 0.5)
          .map((o) => ({ sleutel: o.sleutel, prijsCent: geheel(random, 15000, 40000) })),
      };
    });
}

/** De regels zoals Maak zonder Claude ze maakt: per werkzaamheid een regel, materialen en opties eronder. */
function regelsVan(id: string, werkzaamheden: readonly GekozenWerkzaamheid[]): Offerteregel[] {
  let n = 0;
  const regel = (
    omschrijving: string,
    aantal: number,
    eenheid: Offerteregel['eenheid'],
    prijsCent: number,
    sleutel: string,
    onderdeelVan: string | null,
  ): Offerteregel => ({
    id: `${id}-r${++n}`,
    omschrijving,
    aantalHonderdsten: Math.round(aantal * 100),
    eenheid,
    prijsCent,
    btwTarief: 21,
    prijsbron: 'prijslijst',
    prijspostId: postId(sleutel),
    ...(onderdeelVan !== null && { onderdeelVan }),
  });
  return werkzaamheden.flatMap((w) => {
    const start = WERKZAAMHEDEN_STARTSET.find((s) => s.sleutel === w.sleutel);
    if (!start || w.sleutel === null) return [];
    const hoofd = regel(
      start.label,
      w.aantal,
      start.eenheid,
      w.prijsCent ?? 0,
      werkPrijsSleutel(w.sleutel),
      null,
    );
    const materialen = w.materialen.map((m) => {
      const mat = MATERIALEN_STARTSET.find((x) => x.sleutel === m.sleutel);
      return regel(
        mat?.label ?? '',
        m.aantal,
        mat?.eenheid ?? 'post',
        m.prijsCent ?? 0,
        materiaalPrijsSleutel(m.sleutel ?? ''),
        hoofd.id,
      );
    });
    const opties = w.opties.map((o) => {
      const optie = start.opties.find((x) => x.sleutel === o.sleutel);
      return regel(
        optie?.label ?? o.sleutel,
        1,
        optie?.eenheid ?? 'stuk',
        o.prijsCent ?? 0,
        optiePrijsSleutel(start.sleutel, o.sleutel),
        hoofd.id,
      );
    });
    return [hoofd, ...materialen, ...opties];
  });
}

/**
 * Vult de database met `aantal` offertes (standaard 5.000) verspreid over 2022–2026. Eerdere
 * seed-offertes (id `seed-…`) worden eerst verwijderd, zodat een tweede run hetzelfde oplevert.
 * `documentenMap` bepaalt alleen het (niet-bestaande) pad in `pdf_bestanden`.
 */
export function vulMetSeed(
  db: Database.Database,
  opties: { aantal?: number; documentenMap?: string } = {},
): SeedUitkomst {
  const aantal = opties.aantal ?? SEED_AANTAL;
  const documentenMap = opties.documentenMap ?? 'Offertes';
  zorgVoorSchema(db);

  const random = maakRandom(42);
  const offertes = statussen(random, aantal).map((status, i) => maakOfferte(random, i + 1, status));

  // Nummers per jaar in datumvolgorde, zoals bij echt definitief maken (§8.1).
  const volgorde = offertes
    .filter((o) => o.status !== 'concept')
    .sort((a, b) => a.offertedatum.localeCompare(b.offertedatum) || a.id.localeCompare(b.id));
  const nummers = new Map<string, { jaar: number; volgnummer: number; nummer: string }>();
  const teller = new Map<number, number>();
  for (const o of volgorde) {
    const jaar = Number(o.offertedatum.slice(0, 4));
    const volgnummer = (teller.get(jaar) ?? 0) + 1;
    teller.set(jaar, volgnummer);
    nummers.set(o.id, { jaar, volgnummer, nummer: formatNummer(o.offertedatum, volgnummer) });
  }

  const offerteSql = db.prepare(
    `INSERT INTO offertes (id, status, jaar, volgnummer, nummer, offertedatum, geldig_tot, wizard_stap,
       klant_json, invoer_json, inhoud_json, totaal_incl_cent, omschrijving_kort, zoektekst,
       gewijzigd_na_definitief, verwijderd_op, aangemaakt_op, bijgewerkt_op)
     VALUES (?, ?, ?, ?, ?, ?, ?, 4, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
  );
  const versieSql = db.prepare(
    `INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op)
     VALUES (?, ?, 1, 'agent', ?, ?)`,
  );
  const pdfSql = db.prepare(
    `INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES (?, ?, '', ?, ?)`,
  );

  const perStatus: Record<Status, number> = { concept: 0, klaar: 0, verstuurd: 0, akkoord: 0, afgewezen: 0 };
  db.transaction(() => {
    db.prepare(`DELETE FROM offertes WHERE id LIKE '${SEED_PREFIX}%'`).run();
    for (const o of offertes) {
      const nr = nummers.get(o.id) ?? null;
      const tijdstip = `${o.offertedatum}T09:00:00.000Z`;
      const inhoudJson = JSON.stringify(o.inhoud);
      offerteSql.run(
        o.id,
        o.status,
        nr?.jaar ?? null,
        nr?.volgnummer ?? null,
        nr?.nummer ?? null,
        o.offertedatum,
        berekenGeldigTot(o.offertedatum, GELDIGHEID_DAGEN),
        JSON.stringify(o.klant),
        JSON.stringify(o.invoer),
        inhoudJson,
        berekenTotalen(o.inhoud.regels).totaalCent,
        omschrijvingKort(o.invoer, KEUZE_STARTSET),
        zoektekstVan(o.klant, nr?.nummer ?? null),
        tijdstip,
        tijdstip,
      );
      versieSql.run(`${o.id}-v1`, o.id, inhoudJson, tijdstip);
      if (nr) {
        const pad = join(
          documentenMap,
          String(nr.jaar),
          `${nr.nummer} ${volledigeNaam(o.klant)}.pdf`,
        );
        pdfSql.run(`${o.id}-pdf`, o.id, pad, tijdstip);
      }
      perStatus[o.status] += 1;
    }
  })();

  return { aantal: offertes.length, concept: perStatus.concept, perStatus };
}
