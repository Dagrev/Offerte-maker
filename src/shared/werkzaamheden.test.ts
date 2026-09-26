import { describe, expect, it } from 'vitest';
import { KEUZE_SLEUTEL_PATROON, KEUZE_STARTSET } from './keuzelijsten';
import { legeKlusInvoer } from './nieuweOfferte';
import {
  MATERIALEN_STARTSET,
  WERKZAAMHEDEN_STARTSET,
  gebruikteWerkzaamheden,
  materiaalPrijsSleutel,
  optiePrijsSleutel,
  prijsGroep,
  werkPrijsSleutel,
} from './werkzaamheden';

// OFM-043: startset en prijssleutels van werkzaamheden, opties en materialen.

describe('startset', () => {
  const materialen = new Set(MATERIALEN_STARTSET.map((m) => m.sleutel));
  const soorten = new Set(KEUZE_STARTSET.soortWerk.map((s) => s.sleutel));

  it('sleutels zijn geldig en uniek over werkzaamheden, opties en materialen', () => {
    const alle = [
      ...WERKZAAMHEDEN_STARTSET.map((w) => w.sleutel),
      ...WERKZAAMHEDEN_STARTSET.flatMap((w) => w.opties.map((o) => o.sleutel)),
      ...MATERIALEN_STARTSET.map((m) => m.sleutel),
    ];
    expect(new Set(alle).size).toBe(alle.length);
    for (const s of alle) expect(s).toMatch(KEUZE_SLEUTEL_PATROON);
  });

  it('koppelingen verwijzen naar bestaande soorten werk en materialen; standaard is kiesbaar', () => {
    for (const w of WERKZAAMHEDEN_STARTSET) {
      for (const s of w.soortenWerk) expect(soorten).toContain(s);
      for (const m of w.materialen) expect(materialen).toContain(m);
      if (w.standaardMateriaal !== null) expect(w.materialen).toContain(w.standaardMateriaal);
    }
  });

  it('volgt het ticket: vervangen, nieuw en reparatie met hun werkzaamheden', () => {
    const bij = (soort: string) =>
      WERKZAAMHEDEN_STARTSET.filter((w) => w.soortenWerk.includes(soort)).map((w) => w.label);
    expect(bij('dak_vervangen')).toEqual([
      'Slopen',
      'Isoleren',
      'Nieuwe bedekking',
      'Dakrand en afwerking',
      'Hemelwaterafvoer',
    ]);
    expect(bij('nieuw_dak')).toEqual([
      'Isoleren',
      'Nieuwe bedekking',
      'Dakrand en afwerking',
      'Hemelwaterafvoer',
    ]);
    expect(bij('reparatie')).toEqual(['Lekkage opsporen', 'Plaatselijk herstel', 'Dakgoot vervangen']);
    expect(WERKZAAMHEDEN_STARTSET[0]?.opties).toEqual([
      { sleutel: 'afvalcontainer', label: 'Afvalcontainer', eenheid: 'stuk' },
    ]);
  });
});

describe('prijssleutels', () => {
  it('werk, optie en materiaal hebben een eigen voorvoegsel', () => {
    expect(werkPrijsSleutel('slopen')).toBe('werk:slopen');
    expect(optiePrijsSleutel('slopen', 'afvalcontainer')).toBe('optie:slopen:afvalcontainer');
    expect(materiaalPrijsSleutel('pir_80')).toBe('mat:pir_80');
  });

  it('prijsGroep herkent de groep; gewone en eigen posten hebben er geen', () => {
    expect(prijsGroep('werk:slopen')).toBe('werk');
    expect(prijsGroep('optie:slopen:afvalcontainer')).toBe('optie');
    expect(prijsGroep('mat:eps')).toBe('mat');
    expect(prijsGroep('sloop')).toBeNull();
    expect(prijsGroep('iets:anders')).toBeNull();
    expect(prijsGroep(null)).toBeNull();
  });
});

describe('gebruikteWerkzaamheden', () => {
  it('de wizard kent nog geen werkzaamheden (OFM-044 vult dit in)', () => {
    expect(gebruikteWerkzaamheden(legeKlusInvoer())).toEqual({
      werkzaamheden: [],
      opties: [],
      materialen: [],
    });
  });
});
