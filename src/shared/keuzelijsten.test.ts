import { describe, expect, it } from 'vitest';
import {
  KEUZE_LIJSTEN,
  KEUZE_SLEUTEL_PATROON,
  KEUZE_STARTSET,
  VASTE_KEUZES,
  alsKeuzes,
  gebruikteSleutels,
  isVasteKeuze,
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

  it('de standaardkeuzes van een lege KlusInvoer staan in de startset en zijn vast', () => {
    const leeg = legeKlusInvoer();
    expect(VASTE_KEUZES).toEqual({ hoogte: leeg.hoogte, garantie: leeg.garantieJaren });
    for (const [lijst, sleutel] of Object.entries(VASTE_KEUZES)) {
      expect(KEUZE_STARTSET[lijst as keyof typeof VASTE_KEUZES].some((o) => o.sleutel === sleutel)).toBe(
        true,
      );
      expect(isVasteKeuze(lijst as keyof typeof VASTE_KEUZES, sleutel)).toBe(true);
    }
    expect(isVasteKeuze('hoogte', '2')).toBe(false);
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
