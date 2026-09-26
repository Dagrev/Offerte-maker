import { describe, expect, it } from 'vitest';
import { KEUZE_SLEUTEL_PATROON, KEUZE_STARTSET } from './keuzelijsten';
import { CATALOGUS, gekozen } from '../../test/helpers/werkCatalogus';
import { legeKlusInvoer } from './nieuweOfferte';
import {
  MATERIALEN_STARTSET,
  WERKZAAMHEDEN_STARTSET,
  NAAMLOOS,
  gebruikteWerkzaamheden,
  kiesMateriaal,
  kiesWerkzaamheid,
  materiaalInfo,
  optieInfo,
  standaardAantal,
  werkGroepen,
  werkInfo,
  materiaalPrijsSleutel,
  optiePrijsSleutel,
  prijsGroep,
  itemSleutel,
  standaardPrijs,
  uurPrijsSleutel,
  wisselPerUur,
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

// ---------- OFM-044: werkzaamheden in een offerte ----------

describe('gebruikteWerkzaamheden (OFM-044)', () => {
  it('sleutels van werkzaamheden, opties en materialen; eenmalige items tellen niet', () => {
    const invoer = {
      werkzaamheden: [
        gekozen({
          opties: [{ sleutel: 'afvalcontainer', prijsCent: null }],
          materialen: [
            { id: 'm1', sleutel: 'pir_80', eenmalig: null, aantal: 1, prijsCent: null },
            {
              id: 'm2',
              sleutel: null,
              eenmalig: { label: 'Zink', eenheid: 'm¹' },
              aantal: 1,
              prijsCent: null,
            },
          ],
        }),
        gekozen({ id: 'g2', sleutel: null, eenmalig: { label: 'Dakkapel', eenheid: 'post' } }),
      ],
    };
    expect(gebruikteWerkzaamheden(invoer)).toEqual({
      werkzaamheden: ['slopen'],
      opties: ['afvalcontainer'],
      materialen: ['pir_80'],
    });
    expect(gebruikteWerkzaamheden({})).toEqual({ werkzaamheden: [], opties: [], materialen: [] });
  });
});

describe('info, standaardaantal en kiezen (OFM-044)', () => {
  it('werkInfo, materiaalInfo en optieInfo: uit de catalogus, eenmalig of onbekend', () => {
    expect(werkInfo(CATALOGUS, gekozen())).toEqual({ label: 'Slopen', eenheid: 'm²' });
    expect(werkInfo(CATALOGUS, gekozen({ sleutel: 'weg' }))).toEqual({ label: 'weg', eenheid: 'post' });
    expect(werkInfo(CATALOGUS, { sleutel: null, eenmalig: { label: '  ', eenheid: 'uur' } })).toEqual({
      label: NAAMLOOS.werkzaamheid,
      eenheid: 'uur',
    });
    expect(werkInfo(CATALOGUS, { sleutel: null, eenmalig: { label: 'Kapel', eenheid: 'uur' } }).label).toBe(
      'Kapel',
    );
    expect(materiaalInfo(CATALOGUS, { sleutel: 'pir_80', eenmalig: null })).toEqual({
      label: 'PIR 80 mm',
      eenheid: 'm²',
    });
    expect(materiaalInfo(CATALOGUS, { sleutel: 'weg', eenmalig: null }).label).toBe('weg');
    expect(materiaalInfo(CATALOGUS, { sleutel: null, eenmalig: { label: '', eenheid: 'm¹' } })).toEqual({
      label: NAAMLOOS.materiaal,
      eenheid: 'm¹',
    });
    expect(
      materiaalInfo(CATALOGUS, { sleutel: null, eenmalig: { label: 'Zink', eenheid: 'm¹' } }).label,
    ).toBe('Zink');
    expect(optieInfo(CATALOGUS, 'slopen', 'afvalcontainer')).toEqual({
      label: 'Afvalcontainer',
      eenheid: 'stuk',
    });
    expect(optieInfo(CATALOGUS, null, 'afvalcontainer')).toEqual({
      label: 'afvalcontainer',
      eenheid: 'stuk',
    });
  });

  it('standaardaantal: m² van het dak bij m², anders 1', () => {
    expect(standaardAantal('m²', 34.8)).toBe(34.8);
    expect(standaardAantal('uur', 34.8)).toBe(1);
  });

  it('kiesWerkzaamheid: prijs uit de prijslijst, standaardmateriaal voorgeselecteerd', () => {
    let n = 0;
    const id = () => `id${++n}`;
    const iso = CATALOGUS.werkzaamheden[1]!;
    expect(kiesWerkzaamheid(iso, CATALOGUS, 40, id)).toEqual({
      id: 'id1',
      sleutel: 'isoleren',
      eenmalig: null,
      aantal: 40,
      prijsCent: null,
      perUur: false,
      notitie: '',
      materialen: [{ id: 'id2', sleutel: 'pir_80', eenmalig: null, aantal: 40, prijsCent: 1800 }],
      opties: [],
    });
    expect(kiesWerkzaamheid(CATALOGUS.werkzaamheden[0]!, CATALOGUS, 40).materialen).toEqual([]);
    expect(kiesMateriaal(CATALOGUS.materialen[2]!, 'm²', 40).aantal).toBe(1);
  });

  it('werkGroepen: regel en subregels (materialen, dan opties) met prijssleutels', () => {
    const groepen = werkGroepen(
      [
        gekozen({
          notitie: ' let op ',
          opties: [{ sleutel: 'afvalcontainer', prijsCent: 30000 }],
          materialen: [
            { id: 'm1', sleutel: 'pir_80', eenmalig: null, aantal: 20, prijsCent: 1800 },
            {
              id: 'm2',
              sleutel: null,
              eenmalig: { label: 'Zink', eenheid: 'm¹' },
              aantal: 4,
              prijsCent: null,
            },
          ],
        }),
        gekozen({ id: 'g2', sleutel: null, eenmalig: { label: 'Kapel', eenheid: 'post' }, aantal: 1 }),
      ],
      CATALOGUS,
    );
    expect(groepen[0]).toEqual({
      werk: {
        omschrijving: 'Slopen',
        eenheid: 'm²',
        aantal: 20,
        prijsCent: 1200,
        prijsSleutel: 'werk:slopen',
      },
      notitie: 'let op',
      subregels: [
        { omschrijving: 'PIR 80 mm', eenheid: 'm²', aantal: 20, prijsCent: 1800, prijsSleutel: 'mat:pir_80' },
        { omschrijving: 'Zink', eenheid: 'm¹', aantal: 4, prijsCent: null, prijsSleutel: null },
        {
          omschrijving: 'Afvalcontainer',
          eenheid: 'stuk',
          aantal: 1,
          prijsCent: 30000,
          prijsSleutel: 'optie:slopen:afvalcontainer',
        },
      ],
    });
    expect(groepen[1]?.werk).toMatchObject({ omschrijving: 'Kapel', prijsSleutel: null });
  });

  it('een optie bij een eenmalige werkzaamheid heeft geen prijssleutel', () => {
    const [groep] = werkGroepen(
      [
        gekozen({
          sleutel: null,
          eenmalig: { label: 'X', eenheid: 'post' },
          opties: [{ sleutel: 'o', prijsCent: 1 }],
        }),
      ],
      CATALOGUS,
    );
    expect(groep?.subregels[0]?.prijsSleutel).toBeNull();
  });
});

describe('uurprijs (OFM-048)', () => {
  it('uurprijs-sleutel naast de prijs per eenheid; itemSleutel en prijsGroep', () => {
    expect(uurPrijsSleutel('slopen')).toBe('werk:slopen:uur');
    expect(prijsGroep('werk:slopen:uur')).toBe('werk');
    expect(itemSleutel('werk:slopen:uur')).toBe('slopen');
    expect(itemSleutel('werk:slopen')).toBe('slopen');
    expect(itemSleutel('optie:slopen:afvalcontainer')).toBe('afvalcontainer');
    expect(itemSleutel('mat:pir_80')).toBe('pir_80');
    expect(itemSleutel('werk')).toBe('');
  });

  it('werkInfo per uur: eenheid uur; standaardPrijs kiest de uurprijs', () => {
    expect(werkInfo(CATALOGUS, gekozen({ perUur: true }))).toEqual({ label: 'Slopen', eenheid: 'uur' });
    expect(werkInfo(CATALOGUS, gekozen())).toEqual({ label: 'Slopen', eenheid: 'm²' });
    const slopen = CATALOGUS.werkzaamheden[0]!;
    expect(standaardPrijs(slopen, false)).toBe(1200);
    expect(standaardPrijs(slopen, true)).toBe(4500);
  });

  it('wisselPerUur: aantal 1 uur en de uurprijs; terug geeft het standaardaantal en de prijs per eenheid', () => {
    const slopen = CATALOGUS.werkzaamheden[0]!;
    expect(wisselPerUur(gekozen(), slopen, true, 40)).toEqual({ perUur: true, aantal: 1, prijsCent: 4500 });
    expect(wisselPerUur(gekozen(), slopen, false, 40)).toEqual({
      perUur: false,
      aantal: 40,
      prijsCent: 1200,
    });
    // Geen uurprijs ingesteld: prijs leeg (de wizard meldt dat).
    const iso = CATALOGUS.werkzaamheden[1]!;
    expect(wisselPerUur(gekozen(), iso, true, 40).prijsCent).toBeNull();
    // Zonder item (eenmalig): de prijs blijft staan.
    expect(wisselPerUur(gekozen({ prijsCent: 999 }), undefined, false, 40)).toEqual({
      perUur: false,
      aantal: 1,
      prijsCent: 999,
    });
  });

  it('werkGroepen per uur: eenheid uur en de uurprijs-sleutel op de regel', () => {
    const [groep] = werkGroepen([gekozen({ perUur: true, aantal: 6, prijsCent: 4500 })], CATALOGUS);
    expect(groep?.werk).toEqual({
      omschrijving: 'Slopen',
      eenheid: 'uur',
      aantal: 6,
      prijsCent: 4500,
      prijsSleutel: 'werk:slopen:uur',
    });
  });
});
