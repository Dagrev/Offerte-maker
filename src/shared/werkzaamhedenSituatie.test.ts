import { describe, expect, it } from 'vitest';
import { CATALOGUS, gekozen } from '../../test/helpers/werkCatalogus';
import type { GekozenMateriaal, Materiaal, MateriaalTags, Werkzaamheid, WerkzaamhedenSet } from './types';
import {
  ALLE_TAGS,
  MATERIALEN_STARTSET,
  gebruikSituatie,
  geldigeSituaties,
  heeftTag,
  kiesWerkzaamheid,
  kiesbareMaterialen,
  materiaalInfo,
  opsomming,
  pastBijSituatie,
  situatieCombinaties,
  situatieHint,
  situatieMaterialen,
  situatieVan,
  standaardMaterialen,
  werkInfo,
  zelfdeSituatie,
  zetTag,
} from './werkzaamheden';

// OFM-055: materiaaltags en materiaal per daksituatie (pure functies, 100 % branches).

const materiaal = (
  id: string,
  sleutel: string,
  label: string,
  tags: MateriaalTags = ALLE_TAGS,
): Materiaal => ({
  id,
  sleutel,
  label,
  eenheid: 'm²',
  prijsCent: 1000,
  btwTarief: 21,
  verborgen: false,
  standaard: false,
  categorieId: null,
  inGebruik: false,
  tags,
});

const MATERIALEN: Materiaal[] = [
  materiaal('m-epdm', 'epdm', 'EPDM', { ondergrond: 'alle', bedekking: ['epdm'] }),
  materiaal('m-bit', 'bitumen', 'Bitumen', { ondergrond: 'alle', bedekking: ['bitumen'] }),
  materiaal('m-ontl', 'ontluchter', 'EPDM-ontluchter', { ondergrond: 'alle', bedekking: ['epdm'] }),
  materiaal('m-hout', 'houtschroeven', 'Houtschroeven', { ondergrond: ['hout'], bedekking: 'alle' }),
  materiaal('m-beton', 'betonpluggen', 'Betonpluggen', { ondergrond: ['beton'], bedekking: 'alle' }),
  { ...materiaal('m-weg', 'verborgen_mat', 'Verborgen'), verborgen: true },
  materiaal('m-los', 'los', 'Los'),
];

const WERK: Werkzaamheid = {
  ...CATALOGUS.werkzaamheden[1]!,
  id: 'w-bed',
  sleutel: 'nieuwe_bedekking',
  label: 'Nieuwe bedekking',
  materialen: ['m-epdm', 'm-bit', 'm-ontl', 'm-hout', 'm-beton', 'm-weg'].map((materiaalId) => ({
    materiaalId,
    standaard: materiaalId === 'm-bit',
  })),
  perSituatie: true,
  situaties: [
    { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['m-hout', 'm-epdm', 'm-ontl'] },
    { ondergrond: 'beton', bedekking: 'epdm', materiaalIds: ['m-epdm', 'm-ontl', 'm-beton'] },
    // Bitumen past niet bij epdm en m-los is niet kiesbaar: die tellen niet.
    { ondergrond: 'beton', bedekking: 'bitumen', materiaalIds: ['m-bit', 'm-los', 'm-epdm'] },
  ],
};

const SET: WerkzaamhedenSet = {
  ...CATALOGUS,
  werkzaamheden: [...CATALOGUS.werkzaamheden, WERK],
  materialen: MATERIALEN,
};
const HOUT_EPDM = { ondergrond: 'hout', nieuweBedekking: 'epdm' };
const sleutels = (lijst: readonly { sleutel: string | null }[]) => lijst.map((m) => m.sleutel);

describe('tags (OFM-055)', () => {
  it('heeftTag en pastBijSituatie: alle, lijst, niets gekozen en "Weet ik niet"', () => {
    const hout = { ondergrond: ['hout'], bedekking: 'alle' as const };
    expect(heeftTag(hout, 'ondergrond', 'hout')).toBe(true);
    expect(heeftTag(hout, 'ondergrond', 'beton')).toBe(false);
    expect(heeftTag(hout, 'ondergrond', null)).toBe(true);
    expect(heeftTag(hout, 'bedekking', 'pvc')).toBe(true);
    expect(pastBijSituatie({ tags: hout }, { ondergrond: 'beton', nieuweBedekking: null })).toBe(false);
    expect(pastBijSituatie({ tags: hout }, { ondergrond: 'onbekend', nieuweBedekking: 'epdm' })).toBe(true);
    expect(pastBijSituatie(MATERIALEN[0]!, { ondergrond: 'hout', nieuweBedekking: 'bitumen' })).toBe(false);
  });

  it('zetTag: van alle naar een lijst, terug naar alle, laatste tag blijft, onbekende sleutel achteraan', () => {
    const alle = ['hout', 'beton', 'staal'];
    const zonderStaal = zetTag(ALLE_TAGS, 'ondergrond', 'staal', false, alle);
    expect(zonderStaal).toEqual({ ondergrond: ['hout', 'beton'], bedekking: 'alle' });
    expect(zetTag(zonderStaal, 'ondergrond', 'staal', true, alle)).toEqual(ALLE_TAGS);
    const alleenHout = { ondergrond: ['hout'], bedekking: 'alle' as const };
    expect(zetTag(alleenHout, 'ondergrond', 'hout', false, alle)).toBe(alleenHout);
    expect(zetTag({ ondergrond: ['oud'], bedekking: 'alle' }, 'ondergrond', 'beton', true, alle)).toEqual({
      ondergrond: ['beton', 'oud'],
      bedekking: 'alle',
    });
  });

  it('startset: bitumen, EPDM en PVC hebben alleen hun eigen bedekkingstag, de rest alle', () => {
    const metTags = MATERIALEN_STARTSET.filter((m) => m.tags).map((m) => [m.sleutel, m.tags]);
    expect(metTags).toEqual([
      ['bitumen', { bedekking: ['bitumen'] }],
      ['epdm', { bedekking: ['epdm'] }],
      ['pvc', { bedekking: ['pvc'] }],
    ]);
  });
});

describe('daksituaties (OFM-055)', () => {
  it('situatieCombinaties: zichtbare ondergronden zonder "Weet ik niet" × zichtbare bedekkingen', () => {
    const o = (sleutel: string, verborgen = false) => ({ sleutel, verborgen });
    expect(
      situatieCombinaties(
        [o('hout'), o('beton'), o('staal', true), o('onbekend')],
        [o('bitumen'), o('pvc', true), o('epdm')],
      ),
    ).toEqual([
      { ondergrond: 'hout', bedekking: 'bitumen' },
      { ondergrond: 'hout', bedekking: 'epdm' },
      { ondergrond: 'beton', bedekking: 'bitumen' },
      { ondergrond: 'beton', bedekking: 'epdm' },
    ]);
    expect(
      zelfdeSituatie({ ondergrond: 'hout', bedekking: 'epdm' }, { ondergrond: 'hout', bedekking: 'pvc' }),
    ).toBe(false);
  });

  it('situatieVan: alleen met ondergrond (geen "Weet ik niet") en bedekking', () => {
    expect(situatieVan(HOUT_EPDM)).toEqual({ ondergrond: 'hout', bedekking: 'epdm' });
    expect(situatieVan({ ondergrond: null, nieuweBedekking: 'epdm' })).toBeNull();
    expect(situatieVan({ ondergrond: 'onbekend', nieuweBedekking: 'epdm' })).toBeNull();
    expect(situatieVan({ ondergrond: 'hout', nieuweBedekking: null })).toBeNull();
  });

  it('situatieMaterialen: in lijstvolgorde, alleen kiesbaar en passend; leeg zonder vinkje of situatie', () => {
    expect(sleutels(situatieMaterialen(WERK, SET, HOUT_EPDM))).toEqual([
      'epdm',
      'ontluchter',
      'houtschroeven',
    ]);
    expect(
      sleutels(situatieMaterialen(WERK, SET, { ondergrond: 'beton', nieuweBedekking: 'bitumen' })),
    ).toEqual(['bitumen']);
    expect(situatieMaterialen(WERK, SET, { ondergrond: 'staal', nieuweBedekking: 'epdm' })).toEqual([]);
    expect(situatieMaterialen(WERK, SET, { ondergrond: 'onbekend', nieuweBedekking: 'epdm' })).toEqual([]);
    expect(situatieMaterialen({ ...WERK, perSituatie: false }, SET, HOUT_EPDM)).toEqual([]);
  });

  it('standaardMaterialen en kiesWerkzaamheid: de hele set, of zonder vinkje het ene standaardmateriaal', () => {
    let n = 0;
    const maakId = () => `id${++n}`;
    const werk = kiesWerkzaamheid(WERK, SET, 40, HOUT_EPDM, maakId);
    expect(werk.materialen.map((m) => [m.sleutel, m.aantal])).toEqual([
      ['epdm', 40],
      ['ontluchter', 40],
      ['houtschroeven', 40],
    ]);
    expect(kiesWerkzaamheid(WERK, SET, 40).materialen).toEqual([]);
    expect(sleutels(standaardMaterialen({ ...WERK, perSituatie: false }, SET, HOUT_EPDM))).toEqual([
      'bitumen',
    ]);
    const zonderStandaard = {
      ...WERK,
      perSituatie: false,
      materialen: [{ materiaalId: 'm-epdm', standaard: false }],
    };
    expect(standaardMaterialen(zonderStandaard, SET, HOUT_EPDM)).toEqual([]);
  });

  it('kiesbareMaterialen: kiesbaar, zichtbaar en passend, plus wat al gekozen is', () => {
    expect(
      sleutels(kiesbareMaterialen(WERK, SET, { ondergrond: 'beton', nieuweBedekking: 'bitumen' }, new Set())),
    ).toEqual(['bitumen', 'betonpluggen']);
    expect(
      sleutels(kiesbareMaterialen(WERK, SET, { ondergrond: null, nieuweBedekking: null }, new Set(['los']))),
    ).toEqual(['epdm', 'bitumen', 'ontluchter', 'houtschroeven', 'betonpluggen', 'los']);
    expect(sleutels(kiesbareMaterialen(undefined, SET, HOUT_EPDM, new Set(['epdm'])))).toEqual(['epdm']);
  });
});

describe('hint en Gebruik (OFM-055)', () => {
  const mat = (sleutel: string | null, id = sleutel ?? 'eenmalig'): GekozenMateriaal => ({
    id,
    sleutel,
    eenmalig: sleutel === null ? { label: 'Kit', eenheid: 'stuk' } : null,
    aantal: 7,
    prijsCent: 100,
  });
  const bij = (...sleutelsIn: (string | null)[]) =>
    gekozen({ sleutel: 'nieuwe_bedekking', aantal: 40, materialen: sleutelsIn.map((s) => mat(s)) });
  const BETON_EPDM = { ondergrond: 'beton', nieuweBedekking: 'epdm' };

  it('situatieHint: bij een standaardmateriaal van een andere situatie of zonder materialen', () => {
    // Van hout naar beton: houtschroeven hoort bij een andere situatie.
    const hint = situatieHint(bij('epdm', 'ontluchter', 'houtschroeven'), SET, BETON_EPDM);
    expect(sleutels(hint?.materialen ?? [])).toEqual(['epdm', 'ontluchter', 'betonpluggen']);
    expect(situatieHint(bij(), SET, BETON_EPDM)).not.toBeNull();
    // De hele set staat er al, maar houtschroeven van hout × EPDM ook nog: hint om die weg te halen.
    expect(
      situatieHint(bij('epdm', 'ontluchter', 'betonpluggen', 'houtschroeven'), SET, BETON_EPDM),
    ).not.toBeNull();
  });

  it('situatieHint: geen hint bij alles gekozen, een bewust uitgevinkt deel, een eigen keuze of zonder situatie', () => {
    expect(situatieHint(bij('epdm', 'ontluchter', 'betonpluggen'), SET, BETON_EPDM)).toBeNull();
    expect(situatieHint(bij('epdm', 'betonpluggen'), SET, BETON_EPDM)).toBeNull();
    expect(situatieHint(bij(null, 'verborgen_mat'), SET, BETON_EPDM)).toBeNull();
    // Bitumen is de standaard van een andere situatie (beton × bitumen): wel een hint.
    expect(situatieHint(bij('bitumen'), SET, BETON_EPDM)).not.toBeNull();
    expect(situatieHint(bij('epdm'), SET, { ondergrond: 'onbekend', nieuweBedekking: 'epdm' })).toBeNull();
    expect(situatieHint(gekozen(), SET, BETON_EPDM)).toBeNull();
    expect(situatieHint(gekozen({ sleutel: 'weg' }), SET, BETON_EPDM)).toBeNull();
  });

  it('gebruikSituatie: standaarden van andere situaties eruit, de set erbij op hun plek, de rest blijft', () => {
    let n = 0;
    const maakId = () => `n${++n}`;
    const werk = bij('los', 'houtschroeven', 'epdm', null);
    const hint = situatieHint(werk, SET, BETON_EPDM)!;
    const uit = gebruikSituatie(werk, SET, hint, maakId);
    expect(uit.materialen.map((m) => [m.sleutel ?? m.eenmalig?.label, m.aantal])).toEqual([
      ['los', 7],
      ['ontluchter', 40],
      ['betonpluggen', 40],
      ['epdm', 7],
      ['Kit', 7],
    ]);
    // Niets weg te halen: de nieuwe komen achteraan.
    const leeg = gebruikSituatie(bij(null), SET, hint, maakId);
    expect(leeg.materialen.map((m) => m.sleutel ?? 'kit')).toEqual([
      'kit',
      'epdm',
      'ontluchter',
      'betonpluggen',
    ]);
    // Werkzaamheid niet (meer) in de instellingen: alleen toevoegen.
    const los = gebruikSituatie(gekozen({ sleutel: 'weg', materialen: [mat('epdm')] }), SET, hint, maakId);
    expect(los.materialen.map((m) => m.sleutel)).toEqual(['epdm', 'ontluchter', 'betonpluggen']);
  });

  it('werkInfo en materiaalInfo zonder sleutel en zonder eenmalig: lege naam per post', () => {
    expect(werkInfo(SET, { sleutel: null, eenmalig: null })).toEqual({ label: '', eenheid: 'post' });
    expect(materiaalInfo(SET, { sleutel: null, eenmalig: null })).toEqual({ label: '', eenheid: 'post' });
  });

  it('opsomming', () => {
    expect(opsomming([])).toBe('');
    expect(opsomming(['A'])).toBe('A');
    expect(opsomming(['A', 'B'])).toBe('A en B');
    expect(opsomming(['A', 'B', 'C'])).toBe('A, B en C');
  });
});

describe('geldigeSituaties (OFM-055)', () => {
  it('laat onbekende, niet-kiesbare en niet-passende materialen vallen en telt ze', () => {
    const { werkzaamheden, vervallen } = geldigeSituaties(
      [
        WERK,
        {
          ...WERK,
          id: 'w-2',
          situaties: [{ ondergrond: 'hout', bedekking: 'pvc', materiaalIds: ['m-onbekend', 'm-epdm'] }],
        },
      ],
      MATERIALEN,
    );
    expect(werkzaamheden[0]?.situaties).toEqual([
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['m-hout', 'm-epdm', 'm-ontl'] },
      { ondergrond: 'beton', bedekking: 'epdm', materiaalIds: ['m-epdm', 'm-ontl', 'm-beton'] },
      { ondergrond: 'beton', bedekking: 'bitumen', materiaalIds: ['m-bit'] },
    ]);
    expect(werkzaamheden[1]?.situaties).toEqual([]);
    expect(vervallen).toBe(4);
  });
});
