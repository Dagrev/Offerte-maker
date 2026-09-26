import { oudeVelden } from './oudeInvoer';
import { describe, expect, it } from 'vitest';
import {
  KEUZE_LIJSTEN,
  KEUZE_SLEUTEL_PATROON,
  KEUZE_STARTSET,
  VASTE_KEUZES,
  alsKeuzes,
  extraAantal,
  extraInMeters,
  extrasMetAantal,
  gebruikteSleutels,
  isVasteKeuze,
  keuzeLabel,
  maakSleutel,
  metExtraAantal,
  prijsSleutel,
  prijspostOmschrijving,
} from './keuzelijsten';
import { legeKlusInvoer } from './nieuweOfferte';
import { PRIJS_STARTSET } from './prijsStartset';
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
    expect(label('bedekking', 'epdm_11')).toBe('EPDM 1,1 mm');
    expect(label('huidigeBedekking', 'onbekend')).toBe('Weet ik niet');
    expect(label('ondergrond', 'staal')).toBe('Staal');
    expect(label('isolatie', '80')).toBe('80 mm (Rc 3,5)');
    expect(label('afwerking', 'sedum')).toBe('Sedum');
    expect(label('hoogte', '1')).toBe('Begane grond / 1 bouwlaag');
    expect(label('hoogte', '3plus')).toBe('3 of meer bouwlagen');
    expect(label('garantie', '20')).toBe('20 jaar verzekerde garantie');
    expect(label('extras', 'hwa')).toBe('Hemelwaterafvoeren');
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
    const leeg = { ...legeKlusInvoer(), ...oudeVelden({}) };
    expect(VASTE_KEUZES).toEqual({
      isolatie: leeg.isolatie,
      afwerking: leeg.afwerking,
      hoogte: leeg.hoogte,
      garantie: leeg.garantieJaren,
    });
    for (const [lijst, sleutel] of Object.entries(VASTE_KEUZES)) {
      expect(KEUZE_STARTSET[lijst as keyof typeof VASTE_KEUZES].some((o) => o.sleutel === sleutel)).toBe(
        true,
      );
      expect(isVasteKeuze(lijst as keyof typeof VASTE_KEUZES, sleutel)).toBe(true);
    }
    expect(isVasteKeuze('isolatie', '80')).toBe(false);
  });

  it("extra's en geprijsde opties verwijzen naar een startpost (§9.3)", () => {
    const posten = new Set(PRIJS_STARTSET.map((p) => p.sleutel));
    for (const o of KEUZE_STARTSET.extras) expect(posten.has(prijsSleutel('extras', o.sleutel))).toBe(true);
    for (const s of ['80', '100', '120']) expect(posten.has(prijsSleutel('isolatie', s))).toBe(true);
    for (const s of ['epdm_11', 'epdm_15', 'resitrix', 'bitumen'])
      expect(posten.has(prijsSleutel('bedekking', s))).toBe(true);
    for (const s of ['grind', 'sedum']) expect(posten.has(prijsSleutel('afwerking', s))).toBe(true);
    expect(prijsSleutel('isolatie', '160_mm')).toBe('160_mm');
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

describe("extra's", () => {
  it('vaste extra in het eigen veld, nieuwe in extraAantallen (0 = weg)', () => {
    const leeg = oudeVelden({});
    expect(metExtraAantal(leeg, 'hwa', 3)).toEqual({ hwaAantal: 3 });
    expect(metExtraAantal(leeg, 'dakkapel', 2)).toEqual({ extraAantallen: { dakkapel: 2 } });
    expect(metExtraAantal({ extraAantallen: { dakkapel: 2 } }, 'dakkapel', 0)).toEqual({
      extraAantallen: {},
    });
    const invoer = { ...leeg, hwaAantal: 3, extraAantallen: { dakkapel: 2 } };
    expect(extraAantal(invoer, 'hwa')).toBe(3);
    expect(extraAantal(invoer, 'dakkapel')).toBe(2);
    expect(extraAantal(invoer, 'onbekend')).toBe(0);
    expect(extraInMeters('daktrim')).toBe(true);
    expect(extraInMeters('hwa')).toBe(false);
  });

  it('extrasMetAantal volgt de lijst; wat niet in de lijst staat komt erachter', () => {
    const invoer = {
      ...oudeVelden({}),
      daktrimM1: 4,
      hwaAantal: 1,
      extraAantallen: { dakkapel: 2, weg: 1 },
    };
    const keuzes = {
      extras: [
        { sleutel: 'hwa', label: 'HWA' },
        { sleutel: 'dakkapel', label: 'Dakkapel' },
      ],
    };
    expect(extrasMetAantal(invoer, keuzes)).toEqual([
      { sleutel: 'hwa', label: 'HWA', aantal: 1 },
      { sleutel: 'dakkapel', label: 'Dakkapel', aantal: 2 },
      { sleutel: 'daktrim', label: 'daktrim', aantal: 4 },
      { sleutel: 'weg', label: 'weg', aantal: 1 },
    ]);
  });
});

describe('overige hulpfuncties', () => {
  it("gebruikteSleutels: per lijst, extra's alleen met een aantal", () => {
    const invoer = {
      ...legeKlusInvoer(),
      soortWerk: 'reparatie',
      bedekking: 'leien',
      doorvoerAantal: 2,
      extraAantallen: { dakkapel: 1, nul: 0 },
    };
    expect(gebruikteSleutels(invoer)).toEqual({
      soortWerk: ['reparatie'],
      soortDak: [],
      bedekking: ['leien'],
      huidigeBedekking: [],
      ondergrond: [],
      isolatie: ['geen'],
      extras: ['doorvoer', 'dakkapel'],
      afwerking: ['geen'],
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

  it('prijspostOmschrijving: isolatie krijgt "Isolatie" ervoor, tenzij het label daar al mee begint', () => {
    expect(prijspostOmschrijving('isolatie', ' 160 mm ')).toBe('Isolatie 160 mm');
    expect(prijspostOmschrijving('isolatie', 'Isolatie PIR 160')).toBe('Isolatie PIR 160');
    expect(prijspostOmschrijving('extras', 'Dakkapel')).toBe('Dakkapel');
  });

  it('schema: garantie is een sleutel; extraAantallen en werkzaamheden mogen ontbreken (oude invoer)', () => {
    const oud: Record<string, unknown> = { ...legeKlusInvoer() };
    delete oud['werkzaamheden'];
    expect(klusInvoerSchema.parse(oud).extraAantallen).toBeUndefined();
    expect(klusInvoerSchema.parse(oud).werkzaamheden).toEqual([]);
    expect(klusInvoerSchema.safeParse({ ...oud, garantieJaren: 20 }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...oud, soortWerk: 'Met Hoofdletter' }).success).toBe(false);
    expect(klusInvoerSchema.safeParse({ ...oud, extraAantallen: { dakkapel: -1 } }).success).toBe(false);
  });
});
