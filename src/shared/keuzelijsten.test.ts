import { describe, expect, it } from 'vitest';
import {
  KEUZE_LIJSTEN,
  KEUZE_SLEUTEL_PATROON,
  KEUZE_STARTSET,
  STANDAARDKEUZE_STARTSET,
  VRAAGT_BEDEKKING_STARTSET,
  ZIN_LIJSTEN,
  ZIN_STARTSET,
  alsKeuzes,
  beginsituatie,
  gebruikteSleutels,
  isZinLijst,
  startZin,
  vraagtNieuweBedekking,
  standaardKeuzes,
  keuzeLabel,
  maakSleutel,
} from './keuzelijsten';
import { legeKlusInvoer } from './nieuweOfferte';
import { klusInvoerSchema } from './schemas';

describe('startset (§9.1, OFM-034)', () => {
  it('bevat de letterlijke labels van vóór OFM-034', () => {
    const label = (lijst: (typeof KEUZE_LIJSTEN)[number], sleutel: string) =>
      keuzeLabel(KEUZE_STARTSET, lijst, sleutel);
    expect(label('soortWerk', 'dak_vervangen')).toBe('Dak vervangen');
    expect(KEUZE_STARTSET.soortDak).toEqual([
      { sleutel: 'plat', label: 'plat dak' },
      { sleutel: 'hellend', label: 'hellend dak' },
    ]);
    expect(label('huidigeBedekking', 'onbekend')).toBe('Weet ik niet');
    expect(label('ondergrond', 'staal')).toBe('Staal');
    expect(label('hoogte', '1')).toBe('Begane grond / 1 bouwlaag');
    expect(label('hoogte', '3plus')).toBe('3 of meer bouwlagen');
    expect(label('garantie', '20')).toBe('20 jaar verzekerde garantie');
  });

  it("de lijsten van de oude stap Extra's bestaan niet meer (OFM-045)", () => {
    expect(KEUZE_LIJSTEN).toEqual([
      'soortWerk',
      'nieuweBedekking',
      'soortDak',
      'huidigeBedekking',
      'ondergrond',
      'hoogte',
      'garantie',
    ]);
  });

  it('elke lijst heeft opties met geldige, unieke sleutels en een label', () => {
    for (const lijst of KEUZE_LIJSTEN) {
      const sleutels = KEUZE_STARTSET[lijst].map((o) => o.sleutel);
      expect(new Set(sleutels).size).toBe(sleutels.length);
      for (const o of KEUZE_STARTSET[lijst]) {
        expect(o.sleutel).toMatch(KEUZE_SLEUTEL_PATROON);
        expect(o.label).not.toBe('');
      }
    }
  });

  it('de standaardkeuzes van de startset staan in de startset en vullen een lege KlusInvoer', () => {
    const leeg = legeKlusInvoer();
    expect(STANDAARDKEUZE_STARTSET).toEqual({ hoogte: leeg.hoogte, garantie: leeg.garantieJaren });
    for (const lijst of KEUZE_LIJSTEN) {
      const sleutel = STANDAARDKEUZE_STARTSET[lijst];
      if (sleutel !== undefined) expect(KEUZE_STARTSET[lijst].some((o) => o.sleutel === sleutel)).toBe(true);
    }
  });
});

describe('standaardKeuzes (OFM-049)', () => {
  it('per lijst de sleutel van de optie met standaardkeuze; zonder = geen entry', () => {
    const o = (sleutel: string, standaardkeuze = false) => ({ sleutel, standaardkeuze });
    expect(
      standaardKeuzes({
        soortDak: [o('plat'), o('hellend', true)],
        hoogte: [o('1'), o('2')],
        garantie: [o('10', true)],
      }),
    ).toEqual({ soortDak: 'hellend', garantie: '10' });
  });

  it('legeKlusInvoer neemt de standaardkeuzes over; ontbreekt er een, dan null', () => {
    expect(legeKlusInvoer({ soortWerk: 'reparatie', ondergrond: 'hout' })).toMatchObject({
      soortWerk: 'reparatie',
      soortDak: null,
      huidigeBedekking: null,
      ondergrond: 'hout',
      hoogte: null,
      garantieJaren: null,
    });
  });
});

describe('maakSleutel', () => {
  it('kleine letters zonder accenten, andere tekens → _, maximaal 30 tekens', () => {
    const leeg = new Set<string>();
    expect(maakSleutel('Leien (natuur)', leeg)).toBe('leien_natuur');
    expect(maakSleutel('  Zink/Koper  ', leeg)).toBe('zink_koper');
    expect(maakSleutel('Één café', leeg)).toBe('een_cafe');
    expect(maakSleutel('!!!', leeg)).toBe('keuze');
    expect(maakSleutel('a'.repeat(29) + ' b c', leeg)).toBe('a'.repeat(29));
    expect(maakSleutel('Lang '.repeat(10), leeg)).toMatch(KEUZE_SLEUTEL_PATROON);
  });

  it('bezet → _2, _3', () => {
    expect(maakSleutel('Grind', new Set(['grind']))).toBe('grind_2');
    expect(maakSleutel('Grind', new Set(['grind', 'grind_2']))).toBe('grind_3');
  });
});

describe('overige hulpfuncties', () => {
  it('gebruikteSleutels: per lijst de gekozen sleutel', () => {
    const invoer = { ...legeKlusInvoer(), soortWerk: 'reparatie', ondergrond: 'hout' };
    expect(gebruikteSleutels(invoer)).toEqual({
      soortWerk: ['reparatie'],
      nieuweBedekking: [],
      soortDak: [],
      huidigeBedekking: [],
      ondergrond: ['hout'],
      hoogte: ['1'],
      garantie: ['10'],
    });
  });

  it('alsKeuzes houdt alleen sleutel en label over', () => {
    const lijsten = Object.fromEntries(
      KEUZE_LIJSTEN.map((l) => [l, [{ sleutel: 'x', label: 'X', id: 'i', verborgen: true }]]),
    ) as unknown as Parameters<typeof alsKeuzes>[0];
    expect(alsKeuzes(lijsten).garantie).toEqual([{ sleutel: 'x', label: 'X' }]);
  });

  it('schema: garantie is een sleutel; werkzaamheden mag ontbreken; oude velden vallen weg', () => {
    const invoer: Record<string, unknown> = { ...legeKlusInvoer() };
    delete invoer['werkzaamheden'];
    expect(klusInvoerSchema.parse(invoer).werkzaamheden).toEqual([]);
    expect(klusInvoerSchema.safeParse({ ...invoer, garantieJaren: 20 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...invoer, soortWerk: 'Met Hoofdletter' }).success).toBe(false);
    expect(klusInvoerSchema.parse({ ...invoer, bedekking: 'epdm_15', hwaAantal: 2 })).not.toHaveProperty(
      'bedekking',
    );
  });
});

describe('beginsituatie en nieuwe dakbedekking (OFM-050)', () => {
  it('startzinnen horen bij bestaande startopties; "Weet ik niet" heeft geen zin', () => {
    for (const lijst of ZIN_LIJSTEN) {
      for (const sleutel of Object.keys(ZIN_STARTSET[lijst])) {
        expect(KEUZE_STARTSET[lijst].some((o) => o.sleutel === sleutel)).toBe(true);
      }
    }
    expect(startZin('ondergrond', 'hout')).toBe('Het dak heeft een houten dakbeschot.');
    expect(startZin('hoogte', '2')).toBe('Het dak ligt op de tweede bouwlaag.');
    expect(startZin('ondergrond', 'onbekend')).toBe('');
    expect(startZin('garantie', '10')).toBe('');
    expect(isZinLijst('soortDak')).toBe(true);
    expect(isZinLijst('soortWerk')).toBe(false);
  });

  it('nieuweBedekking-startset = bitumen, EPDM, PVC; dak vervangen en nieuw dak vragen erom', () => {
    expect(KEUZE_STARTSET.nieuweBedekking.map((o) => o.sleutel)).toEqual(['bitumen', 'epdm', 'pvc']);
    expect([...VRAAGT_BEDEKKING_STARTSET].sort()).toEqual(['dak_vervangen', 'nieuw_dak']);
    const keuzes = {
      soortWerk: [
        { sleutel: 'dak_vervangen', label: 'Dak vervangen', vraagtBedekking: true },
        { sleutel: 'reparatie', label: 'Reparatie', vraagtBedekking: false },
        { sleutel: 'oud', label: 'Oud' },
      ],
    };
    expect(vraagtNieuweBedekking(keuzes, 'dak_vervangen')).toBe(true);
    expect(vraagtNieuweBedekking(keuzes, 'reparatie')).toBe(false);
    expect(vraagtNieuweBedekking(keuzes, 'oud')).toBe(false);
    expect(vraagtNieuweBedekking(keuzes, 'onbekend')).toBe(false);
    expect(vraagtNieuweBedekking(keuzes, null)).toBe(false);
  });

  it('beginsituatie: de zinnen in de volgorde soort dak, bedekking, ondergrond, hoogte; lege weg', () => {
    const keuzes = {
      soortDak: [{ sleutel: 'plat', label: 'plat dak', zin: 'Plat.' }],
      huidigeBedekking: [{ sleutel: 'epdm', label: 'EPDM', zin: '  ' }],
      ondergrond: [{ sleutel: 'hout', label: 'Hout', zin: ' Hout. ' }],
      hoogte: [{ sleutel: '2', label: '2 bouwlagen', zin: 'Twee.' }],
    };
    expect(
      beginsituatie({ soortDak: 'plat', huidigeBedekking: 'epdm', ondergrond: 'hout', hoogte: '2' }, keuzes),
    ).toEqual(['Plat.', 'Hout.', 'Twee.']);
    expect(
      beginsituatie({ soortDak: null, huidigeBedekking: null, ondergrond: 'weg', hoogte: null }, keuzes),
    ).toEqual([]);
  });

  it('alsKeuzes houdt zin en vraagtBedekking', () => {
    const lijsten = Object.fromEntries(
      KEUZE_LIJSTEN.map((l) => [
        l,
        [{ sleutel: 'x', label: 'X', zin: 'Z.', vraagtBedekking: true, id: 'i' }],
      ]),
    ) as unknown as Parameters<typeof alsKeuzes>[0];
    expect(alsKeuzes(lijsten).soortWerk).toEqual([
      { sleutel: 'x', label: 'X', zin: 'Z.', vraagtBedekking: true },
    ]);
  });

  it('schema: nieuweBedekking ontbreekt in oude invoer = null', () => {
    const invoer: Record<string, unknown> = { ...legeKlusInvoer() };
    delete invoer['nieuweBedekking'];
    expect(klusInvoerSchema.parse(invoer).nieuweBedekking).toBeNull();
    expect(klusInvoerSchema.parse({ ...invoer, nieuweBedekking: 'epdm' }).nieuweBedekking).toBe('epdm');
  });
});
