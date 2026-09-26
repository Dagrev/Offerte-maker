import { describe, expect, it } from 'vitest';
import { CATALOGUS, gekozen } from '../../test/helpers/werkCatalogus';
import type { DaksysteemRegel, GekozenMateriaal } from './types';
import {
  daksysteemHint,
  daksysteemStandaard,
  gebruikDaksysteem,
  geldigeDaksystemen,
  kiesWerkzaamheid,
  materiaalInfo,
  pasBedekkingToe,
  standaardMateriaalVoor,
  werkInfo,
} from './werkzaamheden';

// OFM-051: standaardmaterialen per daksysteem (terugvalvolgorde, voorselectie, hint in stap 3).

const iso = CATALOGUS.werkzaamheden[1]!; // Isoleren: PIR 60 mm, PIR 80 mm (standaard)
const regel = (ondergrond: string | null, bedekking: string | null, materiaalId: string): DaksysteemRegel => ({
  werkzaamheidId: 'w-iso',
  ondergrond,
  bedekking,
  materiaalId,
});
const isoMet = (materialen: GekozenMateriaal[]) => gekozen({ id: 'g-iso', sleutel: 'isoleren', materialen });
const ds = (ondergrond: string | null, nieuweBedekking: string | null) => ({ ondergrond, nieuweBedekking });

// Een derde kiesbaar materiaal bij Isoleren, zodat elke trede van de terugval een eigen waarde heeft.
const ISO3 = {
  ...iso,
  materialen: [...iso.materialen, { materiaalId: 'm-trim', standaard: false }],
};

describe('daksysteemStandaard en standaardMateriaalVoor', () => {
  const regels = [
    regel('hout', 'epdm', 'm-pir60'),
    regel(null, 'epdm', 'm-trim'),
    regel('beton', null, 'm-pir60'),
    // Andere werkzaamheid: telt niet.
    { ...regel('hout', 'epdm', 'm-pir80'), werkzaamheidId: 'w-slopen' },
  ];

  it('precies de combinatie wint', () => {
    expect(daksysteemStandaard(ISO3, 'hout', 'epdm', regels)).toEqual({
      materiaalId: 'm-pir60',
      bron: 'combinatie',
      regel: regels[0],
    });
  });

  it('dan (alle, bedekking), dan (ondergrond, alle)', () => {
    expect(daksysteemStandaard(ISO3, 'staal', 'epdm', regels)).toMatchObject({
      materiaalId: 'm-trim',
      bron: 'geerfd',
      regel: regels[1],
    });
    expect(daksysteemStandaard(ISO3, 'beton', 'epdm', regels)).toMatchObject({
      materiaalId: 'm-trim',
      bron: 'geerfd',
    });
    expect(daksysteemStandaard(ISO3, 'beton', 'pvc', regels)).toMatchObject({
      materiaalId: 'm-pir60',
      bron: 'geerfd',
      regel: regels[2],
    });
  });

  it('anders het gewone standaardmateriaal (of geen)', () => {
    expect(daksysteemStandaard(ISO3, 'staal', 'pvc', regels)).toEqual({
      materiaalId: 'm-pir80',
      bron: 'gewoon',
      regel: null,
    });
    expect(daksysteemStandaard(CATALOGUS.werkzaamheden[0]!, 'hout', null, regels).materiaalId).toBeNull();
  });

  it('null telt als "alle": (alle, bedekking) en (ondergrond, alle) zijn dan precies; alle × alle is gewoon', () => {
    expect(daksysteemStandaard(ISO3, null, 'epdm', regels)).toMatchObject({ bron: 'combinatie' });
    expect(daksysteemStandaard(ISO3, 'beton', null, regels)).toMatchObject({ bron: 'combinatie' });
    expect(daksysteemStandaard(ISO3, 'hout', null, regels)).toMatchObject({ bron: 'gewoon' });
    expect(daksysteemStandaard(ISO3, null, null, regels)).toMatchObject({ bron: 'gewoon' });
  });

  it('een regel met een materiaal dat niet (meer) kiesbaar is telt niet', () => {
    expect(daksysteemStandaard(iso, 'staal', 'epdm', regels)).toMatchObject({
      materiaalId: 'm-pir80',
      bron: 'gewoon',
    });
  });

  it('standaardMateriaalVoor leest ondergrond en nieuwe bedekking uit de invoer', () => {
    expect(standaardMateriaalVoor(ISO3, ds('hout', 'epdm'), regels)).toBe('m-pir60');
    expect(standaardMateriaalVoor(ISO3, ds(null, null), regels)).toBe('m-pir80');
  });
});

describe('kiesWerkzaamheid met daksysteem', () => {
  it('het standaardmateriaal bij het daksysteem is voorgeselecteerd', () => {
    const w = kiesWerkzaamheid(iso, CATALOGUS, 40, ds('hout', null), [regel('hout', null, 'm-pir60')]);
    expect(w.materialen.map((m) => [m.sleutel, m.aantal, m.prijsCent])).toEqual([['pir_60', 40, 1500]]);
    expect(kiesWerkzaamheid(iso, CATALOGUS, 40, ds('beton', null)).materialen.map((m) => m.sleutel)).toEqual([
      'pir_80',
    ]);
  });
});

describe('daksysteemHint en gebruikDaksysteem', () => {
  const SET = { ...CATALOGUS, daksystemen: [regel('hout', null, 'm-pir60')] };
  const mat = (id: string, sleutel: string | null, aantal = 40): GekozenMateriaal => ({
    id,
    sleutel,
    eenmalig: sleutel === null ? { label: 'Kit', eenheid: 'stuk' } : null,
    aantal,
    prijsCent: null,
  });
  const isoGekozen = (materialen: GekozenMateriaal[]) => gekozen({ id: 'g-iso', sleutel: 'isoleren', materialen });

  it('na een andere ondergrond: hint naar het nieuwe standaardmateriaal', () => {
    // Gekozen bij hout (PIR 60), nu beton: de gewone standaard PIR 80.
    const w = isoGekozen([mat('a', 'pir_60', 38), mat('b', null)]);
    const hint = daksysteemHint(w, SET, ds('beton', null));
    expect(hint).toMatchObject({ materiaal: { sleutel: 'pir_80' }, vervangt: 'a' });
    const na = gebruikDaksysteem(w, SET, hint!, () => 'nieuw');
    expect(na.materialen.map((m) => [m.id, m.sleutel ?? m.eenmalig?.label, m.aantal, m.prijsCent])).toEqual([
      ['nieuw', 'pir_80', 38, 1800],
      ['b', 'Kit', 40, null],
    ]);
    // Omgekeerd: gekozen met de gewone standaard, nu hout.
    expect(daksysteemHint(isoGekozen([mat('c', 'pir_80')]), SET, ds('hout', null))).toMatchObject({
      materiaal: { sleutel: 'pir_60' },
      vervangt: 'c',
    });
  });

  it('geen hint als het standaardmateriaal al gekozen is, bij een eigen keuze of zonder materiaal', () => {
    expect(daksysteemHint(isoGekozen([mat('a', 'pir_80')]), SET, ds('beton', null))).toBeNull();
    // Daktrim is nergens een standaard: eigen keuze van de dakdekker.
    expect(daksysteemHint(isoGekozen([mat('a', 'daktrim')]), SET, ds('hout', null))).toBeNull();
    expect(daksysteemHint(isoGekozen([]), SET, ds('hout', null))).toBeNull();
    // Alleen een eenmalig of verdwenen materiaal: ook een eigen keuze.
    expect(daksysteemHint(isoGekozen([mat('x', null), mat('y', 'weg')]), SET, ds('hout', null))).toBeNull();
  });

  it('geen hint bij een eenmalige werkzaamheid, zonder standaardmateriaal, of als de nieuwe bedekking het regelt', () => {
    expect(daksysteemHint(gekozen({ sleutel: null }), SET, ds('hout', null))).toBeNull();
    expect(daksysteemHint(gekozen({ sleutel: 'slopen' }), SET, ds('hout', null))).toBeNull();
    // De nieuwe bedekking is een kiesbaar materiaal van Isoleren: pasBedekkingToe zorgt ervoor.
    expect(daksysteemHint(isoGekozen([mat('a', 'pir_80')]), SET, ds('hout', 'pir_60'))).toBeNull();
  });
});

describe('randgevallen in shared/werkzaamheden.ts (100 % branches)', () => {
  it('werkInfo en materiaalInfo zonder sleutel en zonder eenmalig: lege naam per post', () => {
    expect(werkInfo(CATALOGUS, { sleutel: null, eenmalig: null })).toEqual({ label: '', eenheid: 'post' });
    expect(materiaalInfo(CATALOGUS, { sleutel: null, eenmalig: null })).toEqual({ label: '', eenheid: 'post' });
  });

  it('pasBedekkingToe: een tweede oud bedekkingsmateriaal verdwijnt', () => {
    const set = {
      ...CATALOGUS,
      materialen: [
        ...CATALOGUS.materialen,
        { ...CATALOGUS.materialen[0]!, id: 'm-bit', sleutel: 'bitumen', label: 'Bitumen' },
      ],
      werkzaamheden: [
        {
          ...iso,
          materialen: [...iso.materialen, { materiaalId: 'm-bit', standaard: false }],
        },
      ],
    };
    const w = isoMet([
      { id: 'a', sleutel: 'pir_60', eenmalig: null, aantal: 10, prijsCent: null },
      { id: 'b', sleutel: 'pir_80', eenmalig: null, aantal: 20, prijsCent: null },
    ]);
    const [na] = pasBedekkingToe([w], set, new Set(['pir_60', 'pir_80', 'bitumen']), 'bitumen', () => 'n');
    expect(na?.materialen.map((m) => [m.sleutel, m.aantal])).toEqual([['bitumen', 10]]);
  });
});

describe('geldigeDaksystemen', () => {
  it('laat regels vallen waarvan het materiaal niet meer kiesbaar is; telt alleen die', () => {
    const regels = [
      regel('hout', null, 'm-pir60'),
      regel('beton', null, 'm-trim'),
      { ...regel('hout', null, 'm-pir60'), werkzaamheidId: 'weg' },
    ];
    expect(geldigeDaksystemen(regels, CATALOGUS.werkzaamheden)).toEqual({
      regels: [regels[0]],
      vervallen: 1,
    });
  });
});
