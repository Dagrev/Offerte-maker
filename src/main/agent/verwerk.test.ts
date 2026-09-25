import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Offerteregel, Prijspost } from '@shared/types';
import { maakKlant } from '../../../test/privacy/testset';
import { type AgentUitvoer, agentUitvoerSchema } from './uitvoerSchema';
import { controlepuntPrijslijst, nabewerk, type NabewerkOpties } from './verwerk';

const fixture = (): AgentUitvoer =>
  agentUitvoerSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../test/fake-claude/fixtures/offerte-ok.json'),
        'utf8',
      ),
    ),
  );

const klant = maakKlant({
  naam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
});

const posten: Record<string, Prijspost> = {
  'start-epdm_11': {
    id: 'start-epdm_11',
    sleutel: 'epdm_11',
    omschrijving: 'EPDM 1,1 mm',
    eenheid: 'm²',
    prijsCent: 5500,
    btwTarief: 21,
    volgorde: 10,
  },
  'start-sloop': {
    id: 'start-sloop',
    sleutel: 'sloop',
    omschrijving: 'Slopen',
    eenheid: 'm²',
    prijsCent: null,
    btwTarief: 21,
    volgorde: 20,
  },
  laag: {
    id: 'laag',
    sleutel: null,
    omschrijving: 'Laag btw',
    eenheid: 'post',
    prijsCent: 1000,
    btwTarief: 9,
    volgorde: 30,
  },
};

const opties = (deel: Partial<NabewerkOpties> = {}): NabewerkOpties => ({
  soort: 'maken',
  klant,
  prijspost: (id) => posten[id] ?? null,
  ...deel,
});

type Regel = AgentUitvoer['regels'][number];
const regel = (deel: Partial<Regel> = {}): Regel => ({
  ref: null,
  omschrijving: 'EPDM dakbedekking 1,1 mm',
  aantal: 34.8,
  eenheid: 'm²',
  prijsEuro: 50,
  btwTarief: 21,
  prijsbron: 'schatting',
  prijspostId: null,
  ...deel,
});
const metRegels = (...regels: Regel[]): AgentUitvoer => ({ ...fixture(), regels, controlepunten: [] });

describe('nabewerk (§10.7 stap 6)', () => {
  it('FE-035: prijs gelijkgezet aan een prijslijstpost met prijs, met controlepunt', () => {
    const uit = nabewerk(
      metRegels(
        regel({
          prijsEuro: 50,
          prijsbron: 'voorbeeld',
          prijspostId: 'start-epdm_11',
          eenheid: 'm¹',
          btwTarief: 9,
        }),
      ),
      opties(),
    );
    expect(uit.regels[0]).toMatchObject({
      prijsCent: 5500,
      eenheid: 'm²',
      btwTarief: 21,
      prijsbron: 'prijslijst',
    });
    expect(uit.controlepunten).toEqual([
      'Prijs van "EPDM dakbedekking 1,1 mm" gelijkgezet aan de prijslijst (€ 55,00).',
    ]);
    expect(controlepuntPrijslijst('x', 5500)).toBe('Prijs van "x" gelijkgezet aan de prijslijst (€ 55,00).');
  });

  it('dezelfde prijs als de prijslijst: bron prijslijst, geen controlepunt', () => {
    const uit = nabewerk(
      metRegels(regel({ prijsEuro: 55, prijsbron: 'prijslijst', prijspostId: 'start-epdm_11' })),
      opties(),
    );
    expect(uit.regels[0]?.prijsbron).toBe('prijslijst');
    expect(uit.controlepunten).toEqual([]);
  });

  it('prijslijst zonder geldige post met prijs → schatting', () => {
    const uit = nabewerk(
      metRegels(
        regel({ prijsbron: 'prijslijst', prijspostId: 'start-sloop' }),
        regel({ prijsbron: 'prijslijst', prijspostId: 'bestaat-niet' }),
        regel({ prijsbron: 'prijslijst', prijspostId: null }),
      ),
      opties(),
    );
    expect(uit.regels.map((r) => r.prijsbron)).toEqual(['schatting', 'schatting', 'schatting']);
    expect(uit.regels.map((r) => r.prijspostId)).toEqual(['start-sloop', 'bestaat-niet', null]);
  });

  it('andere bronnen blijven, ook met een post zonder prijs', () => {
    const uit = nabewerk(
      metRegels(
        regel({ prijsbron: 'voorbeeld', prijspostId: 'start-sloop' }),
        regel({ prijsbron: 'schatting' }),
      ),
      opties(),
    );
    expect(uit.regels.map((r) => r.prijsbron)).toEqual(['voorbeeld', 'schatting']);
  });

  it('V-06: bij maken wordt handmatig een schatting en wordt ref niet opgeslagen', () => {
    const uit = nabewerk(metRegels(regel({ prijsbron: 'handmatig', ref: 'r1' })), opties());
    expect(uit.regels[0]?.prijsbron).toBe('schatting');
    expect(uit.regels[0]).not.toHaveProperty('ref');
  });

  it('V-06 (voor OFM-017): bij aanpassen blijft handmatig bij dezelfde ref en prijs', () => {
    const huidig: Offerteregel = {
      id: 'x',
      omschrijving: 'Eigen prijs',
      aantalHonderdsten: 100,
      eenheid: 'post',
      prijsCent: 12345,
      btwTarief: 21,
      prijsbron: 'handmatig',
      prijspostId: 'start-epdm_11',
    };
    const uit = nabewerk(
      metRegels(
        regel({ ref: 'r1', prijsbron: 'handmatig', prijsEuro: 123.45, prijspostId: 'start-epdm_11' }),
        regel({ ref: 'r1', prijsbron: 'handmatig', prijsEuro: 123.45 }),
        regel({ ref: 'r1', prijsbron: 'handmatig', prijsEuro: 1 }),
        regel({ ref: 'r9', prijsbron: 'handmatig', prijsEuro: 123.45 }),
      ),
      opties({ soort: 'aanpassen', huidigeRegels: [huidig] }),
    );
    // Alleen de eerste regel met ref r1 geldt als die bestaande regel (V-27).
    expect(uit.regels.map((r) => r.prijsbron)).toEqual(['handmatig', 'schatting', 'schatting', 'schatting']);
    expect(uit.regels[0]?.prijsCent).toBe(12345);
  });

  it('omrekenen naar honderdsten en centen, met nieuwe id per regel', () => {
    const uit = nabewerk(
      metRegels(regel({ aantal: 34.8, prijsEuro: 12.5 }), regel({ aantal: 1.155, prijsEuro: 0.005 })),
      opties(),
    );
    expect(uit.regels.map((r) => [r.aantalHonderdsten, r.prijsCent])).toEqual([
      [3480, 1250],
      [116, 1],
    ]);
    expect(new Set(uit.regels.map((r) => r.id)).size).toBe(2);
  });

  it('[VERWIJDERD] en [BEDRIJF] weg, dubbele spaties opgeschoond; [WERK_PLAATS] mag', () => {
    const uit = nabewerk(
      {
        ...metRegels(regel({ omschrijving: 'Werk  [BEDRIJF] op [WERK_ADRES]' })),
        titel: 'Offerte [VERWIJDERD] dak',
        uitvoering: 'Wij werken in [WERK_PLAATS] en bellen [VERWIJDERD].',
      },
      opties(),
    );
    expect(uit.titel).toBe('Offerte dak');
    expect(uit.regels[0]?.omschrijving).toBe('Werk op [WERK_ADRES]');
    expect(uit.uitvoering).toBe('Wij werken in [WERK_PLAATS] en bellen .');
    expect(uit.controlepunten).toEqual([]);
  });

  it('onbekende plaatshouder blijft staan en geeft één controlepunt', () => {
    const uit = nabewerk(
      { ...metRegels(regel()), opmerkingen: 'Zie [KLANT_TELEFOON] en [KLANT_TELEFOON], [X_Y].' },
      opties(),
    );
    expect(uit.opmerkingen).toBe('Zie [KLANT_TELEFOON] en [KLANT_TELEFOON], [X_Y].');
    expect(uit.controlepunten).toEqual([
      'Onbekende plaatshouder [KLANT_TELEFOON] in de tekst.',
      'Onbekende plaatshouder [X_Y] in de tekst.',
    ]);
  });

  it('inleiding die met Geachte of Beste begint verliest die eerste regel', () => {
    const inleiding = (tekst: string) =>
      nabewerk({ ...metRegels(regel()), inleiding: tekst }, opties()).inleiding;
    expect(inleiding('Geachte heer [KLANT_NAAM],\nHierbij de offerte.')).toBe('Hierbij de offerte.');
    expect(inleiding('  beste klant,\nTekst')).toBe('Tekst');
    expect(inleiding('Bestek volgt.\nTekst')).toBe('Bestek volgt.\nTekst');
    expect(inleiding('Naar aanleiding van [KLANT_NAAM]')).toBe('Naar aanleiding van [KLANT_NAAM]');
  });

  it('opslaginvariant: klantgegevens die de agent noemt worden plaatshouders', () => {
    const uit = nabewerk(
      {
        ...metRegels(regel({ omschrijving: 'Dak Dorpsstraat 12' })),
        afsluiting: 'Groet aan Jansen in Veldhoven, bel 06-12345678.',
        controlepunten: ['Vraag Jansen naar de sleutel'],
      },
      opties(),
    );
    expect(uit.regels[0]?.omschrijving).toBe('Dak [KLANT_ADRES]');
    expect(uit.afsluiting).toBe('Groet aan [KLANT_NAAM] in [KLANT_PLAATS], bel [VERWIJDERD].');
    expect(uit.controlepunten).toEqual(['Vraag [KLANT_NAAM] naar de sleutel']);
  });

  it('V-05: schattingen geven geen controlepunt (fixture: 2 punten, 1 schattingsregel)', () => {
    const f = fixture();
    expect(f.regels.filter((r) => r.prijsbron === 'schatting')).toHaveLength(1);
    const uit = nabewerk(f, opties());
    expect(uit.controlepunten).toEqual(f.controlepunten);
    expect(uit.controlepunten).toHaveLength(2);
  });
});
