import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { berekenTotalen } from '../../../src/shared/calc/bedragen';
import { PRIJS_STARTSET } from '../../../src/shared/prijsStartset';
import type { Offerteregel } from '../../../src/shared/types';

// Maakt `offerte-maker-schema3.sqlite`: een database zoals de app hem vóór OFM-044 schreef
// (schemaversie 3, keuzelijsten met bedekking/isolatie/extra's/afwerking, invoer in de oude vorm).
// Gebruikt door `test/e2e/omzetting.spec.ts` en de back-uptest (OFM-045). Bewust los van de huidige
// code: de keuzelijsten en de oude invoer staan hier letterlijk, zodat het bestand na latere
// wijzigingen opnieuw gemaakt kan worden. Alleen nodig als de fixture moet veranderen:
//   cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/tsx/dist/cli.mjs test/fixtures/schema3/maak.ts

const REPO = resolve(import.meta.dirname, '..', '..', '..');
export const FIXTURE_SCHEMA3 = join(REPO, 'test', 'fixtures', 'schema3', 'offerte-maker-schema3.sqlite');
const MIGRATIES = ['001_basis.sql', '002_keuzelijsten.sql', '003_naam.sql'];

const o = (sleutel: string, label: string) => ({ sleutel, label });
const KEUZES_V3: Record<string, { sleutel: string; label: string }[]> = {
  soortWerk: [
    o('nieuw_dak', 'Nieuw dak'),
    o('dak_vervangen', 'Dak vervangen'),
    o('reparatie', 'Reparatie'),
    o('dakgoten', 'Dakgoten'),
    o('isolatie', 'Isolatie'),
    o('onderhoud', 'Onderhoud'),
  ],
  soortDak: [o('plat', 'plat dak'), o('hellend', 'hellend dak')],
  bedekking: [
    o('epdm_11', 'EPDM 1,1 mm'),
    o('epdm_15', 'EPDM 1,5 mm'),
    o('resitrix', 'Resitrix'),
    o('bitumen', 'Bitumen'),
    o('anders', 'Anders'),
  ],
  huidigeBedekking: [
    o('bitumen', 'Bitumen'),
    o('epdm', 'EPDM'),
    o('grind_op_bitumen', 'Grind op bitumen'),
    o('onbekend', 'Weet ik niet'),
  ],
  ondergrond: [o('hout', 'Hout'), o('beton', 'Beton'), o('staal', 'Staal'), o('onbekend', 'Weet ik niet')],
  isolatie: [
    o('geen', 'Geen'),
    o('80', '80 mm (Rc 3,5)'),
    o('100', '100 mm'),
    o('120', '120 mm'),
    o('anders', 'Anders'),
  ],
  extras: [
    o('daktrim', 'Daktrim en dakranden'),
    o('dakgoot_epdm', 'EPDM-dakgoten'),
    o('hwa', 'Hemelwaterafvoeren'),
    o('noodoverloop', 'Noodoverlopen'),
    o('doorvoer', 'Dakdoorvoeren (pijpen, ventilatie)'),
    o('lichtkoepel', 'Lichtkoepels en dakramen aansluiten'),
  ],
  afwerking: [o('geen', 'Geen'), o('grind', 'Grind'), o('sedum', 'Sedum')],
  hoogte: [o('1', 'Begane grond / 1 bouwlaag'), o('2', '2 bouwlagen'), o('3plus', '3 of meer bouwlagen')],
  garantie: [o('10', '10 jaar'), o('20', '20 jaar verzekerde garantie')],
};

/** Prijzen in de prijslijst van de fixture (centen). */
export const FIXTURE_PRIJZEN: Record<string, number> = {
  epdm_15: 4550,
  sloop: 1200,
  dampremmer: 450,
  isolatie_80: 2800,
  daktrim: 3500,
  hwa: 8500,
  grind: 900,
  sedum: 5500,
  dakgoot_epdm: 6000,
  doorvoer: 7000,
  steiger: 45000,
  voorrijkosten: 7500,
  zonnepaneelbeugel: 2500,
};

const TIJD = '2026-09-20T09:00:00.000Z';

const klant = (voornaam: string, achternaam: string, plaats: string) => ({
  aanhef: 'dhr',
  voornaam,
  achternaam,
  bedrijfsnaam: '',
  adres: { straatHuisnummer: 'Kerkstraat 1', postcode: '5611 AB', plaats },
  telefoon: '',
  email: '',
  heeftWerkadres: false,
  werkadres: { straatHuisnummer: '', postcode: '', plaats: '' },
});

const vlak = (id: string, m2: number) => ({
  id,
  naam: 'Dakvlak 1',
  modus: 'm2',
  lengteM: null,
  breedteM: null,
  m2,
});

/** Offerte A: definitief (oud nummer), regels zoals Maak zonder Claude ze maakte, één prijs met de hand. */
const INVOER_A = {
  soortWerk: 'dak_vervangen',
  soortDak: 'plat',
  dakvlakken: [vlak('a-v1', 50)],
  bedekking: 'epdm_15',
  bedekkingAnders: '',
  huidigeBedekking: 'bitumen',
  ondergrond: 'hout',
  slopenEnAfvoeren: true,
  isolatie: '80',
  isolatieAndersMm: null,
  daktrimM1: 12,
  dakgootM1: 0,
  hwaAantal: 2,
  noodoverloopAantal: 0,
  doorvoerAantal: 0,
  lichtkoepelAantal: 0,
  afwerking: 'grind',
  extraAantallen: {},
  hoogte: '1',
  steigerNodig: true,
  garantieJaren: '10',
  gewensteUitvoering: 'Voorjaar',
  overig: '',
};

function regel(n: number, sleutel: string, aantal: number, prijsCent?: number): Offerteregel {
  const post = PRIJS_STARTSET.find((p) => p.sleutel === sleutel);
  if (!post) throw new Error(sleutel);
  return {
    id: `a-r${n}`,
    omschrijving: post.omschrijving,
    aantalHonderdsten: Math.round(aantal * 100),
    eenheid: post.eenheid,
    prijsCent: prijsCent ?? FIXTURE_PRIJZEN[sleutel] ?? 0,
    btwTarief: 21,
    prijsbron: prijsCent === undefined ? 'prijslijst' : 'handmatig',
    prijspostId: `start-${sleutel}`,
  };
}

export const FIXTURE_REGELS_A: Offerteregel[] = [
  regel(1, 'sloop', 50),
  regel(2, 'dampremmer', 50),
  regel(3, 'isolatie_80', 50),
  regel(4, 'epdm_15', 50, 4800), // met de hand aangepast: niet de prijslijstprijs 45,50
  regel(5, 'daktrim', 12),
  regel(6, 'hwa', 2),
  regel(7, 'grind', 50),
  regel(8, 'steiger', 1),
  regel(9, 'voorrijkosten', 1),
];

const INHOUD_A = {
  titel: 'Offerte dak vervangen plat dak',
  inleiding: 'Hierbij ontvangt u onze offerte.',
  werkomschrijving: FIXTURE_REGELS_A.map((r) => r.omschrijving),
  regels: FIXTURE_REGELS_A,
  uitvoering: 'Voorjaar',
  opmerkingen: '',
  afsluiting: 'Met vriendelijke groet.',
  controlepunten: [],
};

/** Offerte B: concept zonder inhoud, met "anders"-keuzes, een eigen extra en sedum. */
const INVOER_B = {
  soortWerk: 'nieuw_dak',
  soortDak: 'plat',
  dakvlakken: [vlak('b-v1', 20)],
  bedekking: 'anders',
  bedekkingAnders: 'Kunststof dakbedekking',
  huidigeBedekking: null,
  ondergrond: null,
  slopenEnAfvoeren: false,
  isolatie: 'anders',
  isolatieAndersMm: 90,
  daktrimM1: 0,
  dakgootM1: 8.5,
  hwaAantal: 0,
  noodoverloopAantal: 0,
  doorvoerAantal: 3,
  lichtkoepelAantal: 0,
  afwerking: 'sedum',
  extraAantallen: { zonnepaneelbeugel: 4 },
  hoogte: '2',
  steigerNodig: false,
  garantieJaren: '20',
  gewensteUitvoering: '',
  overig: 'Graag bellen vooraf.',
};

export function maakFixture(pad: string = FIXTURE_SCHEMA3): void {
  if (existsSync(pad)) rmSync(pad);
  const db = new Database(pad);
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    for (const naam of MIGRATIES) {
      db.exec(readFileSync(join(REPO, 'src', 'main', 'db', 'migraties', naam), 'utf8'));
    }
    const post = db.prepare(
      'INSERT INTO prijsposten (id, sleutel, omschrijving, eenheid, prijs_cent, btw_tarief, volgorde) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    PRIJS_STARTSET.forEach((p, i) =>
      post.run(
        `start-${p.sleutel}`,
        p.sleutel,
        p.omschrijving,
        p.eenheid,
        FIXTURE_PRIJZEN[p.sleutel] ?? null,
        21,
        (i + 1) * 10,
      ),
    );
    // Een extra die de gebruiker zelf toevoegde (OFM-034), met een eigen prijspost.
    post.run('eigen-beugel', 'zonnepaneelbeugel', 'Zonnepaneelbeugel', 'stuk', 2500, 21, 1000);
    const keuze = db.prepare(
      'INSERT INTO keuzeopties (id, lijst, sleutel, label, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, ?)',
    );
    for (const [lijst, opties] of Object.entries(KEUZES_V3)) {
      opties.forEach((k, i) =>
        keuze.run(`start-${lijst}-${k.sleutel}`, lijst, k.sleutel, k.label, (i + 1) * 10, 1),
      );
    }
    keuze.run('eigen-extra-beugel', 'extras', 'zonnepaneelbeugel', 'Zonnepaneelbeugels', 70, 0);

    const instelling = db.prepare('INSERT INTO instellingen (sleutel, waarde_json) VALUES (?, ?)');
    instelling.run('app', JSON.stringify({ welkomVoltooid: true }));
    instelling.run('bedrijf', JSON.stringify({ naam: 'Dakwerken Test' }));

    const offerte = db.prepare(
      `INSERT INTO offertes (id, status, jaar, volgnummer, nummer, offertedatum, geldig_tot, wizard_stap,
         klant_json, invoer_json, inhoud_json, totaal_incl_cent, omschrijving_kort, zoektekst,
         gewijzigd_na_definitief, verwijderd_op, aangemaakt_op, bijgewerkt_op)
       VALUES (?, ?, ?, ?, ?, '2026-09-20', '2026-10-20', 4, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    );
    offerte.run(
      'fixture-a',
      'klaar',
      2026,
      1,
      '2026-001',
      JSON.stringify(klant('Jan', 'Jansen', 'Eindhoven')),
      JSON.stringify(INVOER_A),
      JSON.stringify(INHOUD_A),
      berekenTotalen(FIXTURE_REGELS_A).totaalCent,
      'Dak vervangen · EPDM 1,5 mm · 50 m²',
      'jan jansen  eindhoven 2026-001',
      TIJD,
      TIJD,
    );
    db.prepare(
      "INSERT INTO offerte_versies (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op) VALUES ('fixture-a-v1', 'fixture-a', 1, 'zonder_claude', ?, ?)",
    ).run(JSON.stringify(INHOUD_A), TIJD);
    // Het PDF-bestand zelf bestaat niet; de rij zorgt dat een nieuwe versie de letter b krijgt.
    db.prepare(
      "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES ('fixture-a-pdf', 'fixture-a', '', 'Offertes/2026/2026-001 Jan Jansen.pdf', ?)",
    ).run(TIJD);
    offerte.run(
      'fixture-b',
      'concept',
      null,
      null,
      null,
      JSON.stringify(klant('Piet', 'de Vries', 'Best')),
      JSON.stringify(INVOER_B),
      null,
      null,
      'Nieuw dak · Kunststof dakbedekking · 20 m²',
      'piet de vries  best ',
      TIJD,
      TIJD,
    );
    db.pragma('user_version = 3');
  })();
  db.close();
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  maakFixture();
  console.log(`Gemaakt: ${FIXTURE_SCHEMA3}`);
}
