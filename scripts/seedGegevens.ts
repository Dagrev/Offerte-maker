import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { berekenTotalen } from '../src/shared/calc/bedragen';
import { KEUZE_LIJSTEN, KEUZE_STARTSET } from '../src/shared/keuzelijsten';
import { legeKlant, legeKlusInvoer, zoektekstVan } from '../src/shared/nieuweOfferte';
import { formatNummer } from '../src/shared/nummering';
import { omschrijvingKort } from '../src/shared/omschrijvingKort';
import { berekenGeldigTot } from '../src/shared/periode';
import { PRIJS_STARTSET } from '../src/shared/prijsStartset';
import type {
  Aanhef,
  Bedekking,
  Dakvlak,
  Klant,
  KlusInvoer,
  OfferteInhoud,
  Offerteregel,
  SoortDak,
  SoortWerk,
  Status,
} from '../src/shared/types';

// Seed-gegevens voor de prestatietests (TDO §15.4, NFE-003/004). Vaste random-seed 42: twee runs geven
// precies dezelfde rijen. Wordt gebruikt door `scripts/seed.ts` (pnpm seed) en `test/seed/seed.test.ts`.
// Draait onder Electron-als-Node (V-04) en importeert daarom niets uit `src/main` (dat heeft `electron`
// en `import.meta.glob` nodig); alleen pure functies uit `src/shared`.

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

/** Vaste lijst van 200 namen (40 achternamen × 5 voornamen; OFM-038: voor- en achternaam apart). */
export const SEED_NAMEN: readonly { voornaam: string; achternaam: string }[] = ACHTERNAMEN.flatMap(
  (achternaam) => VOORNAMEN.map((voornaam) => ({ voornaam, achternaam })),
);

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
const BEDEKKINGEN: Bedekking[] = ['epdm_11', 'epdm_15', 'resitrix', 'bitumen'];
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
    // Zelfde startset als `voegKeuzeStartsetIn()` (OFM-034).
    const keuze = db.prepare(
      'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, 1)',
    );
    for (const lijst of KEUZE_LIJSTEN) {
      KEUZE_STARTSET[lijst].forEach((o, index) => {
        keuze.run(`start-${lijst}-${o.sleutel}`, lijst, o.sleutel, o.label, (index + 1) * 10);
      });
    }
    db.pragma(`user_version = ${bestanden.length}`);
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
  const invoer: KlusInvoer = {
    ...legeKlusInvoer(),
    soortWerk: kies(random, SOORTEN_WERK),
    soortDak: kies(random, SOORTEN_DAK),
    dakvlakken: vlakken,
    bedekking: kies(random, BEDEKKINGEN),
  };

  const regels: Offerteregel[] = Array.from({ length: geheel(random, 1, 8) }, (_, i) => {
    const post = kies(random, PRIJS_STARTSET);
    return {
      id: `${id}-r${i + 1}`,
      omschrijving: post.omschrijving,
      aantalHonderdsten: post.eenheid === 'm²' ? geheel(random, 800, 12000) : geheel(random, 1, 20) * 100,
      eenheid: post.eenheid,
      prijsCent: geheel(random, 500, 9500),
      btwTarief: post.btwTarief,
      prijsbron: 'prijslijst',
      prijspostId: `start-${post.sleutel}`,
    };
  });
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
          `${nr.nummer} ${o.klant.voornaam} ${o.klant.achternaam}.pdf`,
        );
        pdfSql.run(`${o.id}-pdf`, o.id, pad, tijdstip);
      }
      perStatus[o.status] += 1;
    }
  })();

  return { aantal: offertes.length, concept: perStatus.concept, perStatus };
}
