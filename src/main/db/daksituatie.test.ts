import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { WerkzaamhedenBewaar, WerkzaamhedenSet } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-055: materiaaltags en materiaal per daksituatie (migratie 011, `werkzaamheden:*`, keuzelijsten).

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../testhaken', () => ({ vandaag: () => '2026-09-25', testhaak: () => false }));

const { bewaarWerkzaamheden, haalWerkzaamheden, herstelWerkzaamheden } = await import('./repo/werkzaamheden');
const { bewaarKeuzelijst, herstelKeuzelijst, lijstKeuzeopties } = await import('./repo/keuzeopties');
const { laadMigraties, migreer, SCHEMA_VERSIE } = await import('./migraties');
const { zetDaksituatiesOm, zetSituatieStartset } = await import('./daksituatie');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => t.opruimen());

/** De set zoals de tab hem terugstuurt (met tags, vinkje en situaties). */
function alsInvoer(set: WerkzaamhedenSet, zonderSituatieVelden = false): WerkzaamhedenBewaar {
  return {
    werkzaamheden: set.werkzaamheden.map((w) => ({
      id: w.id,
      label: w.label,
      eenheid: w.eenheid,
      prijsCent: w.prijsCent,
      verborgen: w.verborgen,
      soortenWerk: w.soortenWerk,
      opties: w.opties.map(({ id, label, eenheid, prijsCent, verborgen }) => ({
        id,
        label,
        eenheid,
        prijsCent,
        verborgen,
      })),
      materialen: w.materialen,
      ...(zonderSituatieVelden ? {} : { perSituatie: w.perSituatie, situaties: w.situaties }),
    })),
    materialen: set.materialen.map(({ id, label, eenheid, prijsCent, verborgen, tags }) => ({
      id,
      label,
      eenheid,
      prijsCent,
      verborgen,
      ...(zonderSituatieVelden ? {} : { tags }),
    })),
  };
}

function fout(fn: () => unknown): AppFout {
  try {
    fn();
  } catch (e) {
    return e as AppFout;
  }
  throw new Error('geen fout');
}

const BED = 'start-werk-nieuwe_bedekking';
const HERSTEL = 'start-werk-plaatselijk_herstel';
const ISO = 'start-werk-isoleren';
const werk = (set: WerkzaamhedenSet, id: string) => set.werkzaamheden.find((w) => w.id === id)!;
const tagsVan = (set: WerkzaamhedenSet, sleutel: string) =>
  set.materialen.find((m) => m.sleutel === sleutel)?.tags;

/** Houtschroeven (tag hout) en EPDM-ontluchter (tag EPDM) kiesbaar bij Nieuwe bedekking. */
function metEigenMaterialen(): WerkzaamhedenSet {
  const set = haalWerkzaamheden();
  const invoer = alsInvoer(set);
  invoer.materialen.push(
    {
      id: 'm-hout',
      label: 'Houtschroeven',
      eenheid: 'stuk',
      prijsCent: null,
      verborgen: false,
      tags: { ondergrond: ['hout'], bedekking: 'alle' },
    },
    {
      id: 'm-ontl',
      label: 'EPDM-ontluchter',
      eenheid: 'stuk',
      prijsCent: null,
      verborgen: false,
      tags: { ondergrond: 'alle', bedekking: ['epdm'] },
    },
  );
  const bed = invoer.werkzaamheden.find((w) => w.id === BED)!;
  bed.materialen.push(
    { materiaalId: 'm-hout', standaard: false },
    { materiaalId: 'm-ontl', standaard: false },
  );
  return bewaarWerkzaamheden(invoer);
}

describe('migratie 011 (OFM-055)', () => {
  it('nieuwe database: starttags, vinkje en situaties bij Nieuwe bedekking en Plaatselijk herstel', () => {
    expect(SCHEMA_VERSIE).toBeGreaterThanOrEqual(11);
    const set = haalWerkzaamheden();
    expect(tagsVan(set, 'bitumen')).toEqual({ ondergrond: 'alle', bedekking: ['bitumen'] });
    expect(tagsVan(set, 'epdm')).toEqual({ ondergrond: 'alle', bedekking: ['epdm'] });
    expect(tagsVan(set, 'pvc')).toEqual({ ondergrond: 'alle', bedekking: ['pvc'] });
    expect(tagsVan(set, 'pir_80')).toEqual({ ondergrond: 'alle', bedekking: 'alle' });
    const bed = werk(set, BED);
    expect(bed.perSituatie).toBe(true);
    // Drie ondergronden (zonder "Weet ik niet") × drie bedekkingen; bitumen was standaard maar past alleen bij bitumen.
    expect(bed.situaties).toHaveLength(9);
    expect(bed.situaties.slice(0, 3)).toEqual([
      { ondergrond: 'hout', bedekking: 'bitumen', materiaalIds: ['start-mat-bitumen'] },
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['start-mat-epdm'] },
      { ondergrond: 'hout', bedekking: 'pvc', materiaalIds: ['start-mat-pvc'] },
    ]);
    // Plaatselijk herstel heeft geen PVC: bij PVC past niets.
    expect(werk(set, HERSTEL).situaties.map((s) => s.bedekking)).toEqual(
      Array(3).fill(['bitumen', 'epdm']).flat(),
    );
    expect(werk(set, ISO)).toMatchObject({ perSituatie: false, situaties: [] });
    expect(
      t.db.prepare("SELECT name FROM sqlite_master WHERE name = 'daksysteem_materiaal'").get(),
    ).toBeUndefined();
  });

  it('011 op versie 10: regels van OFM-051 worden situaties (alle passende regels, anders de oude standaard)', async () => {
    t.opruimen();
    t = await maakTestDatabase({ migreren: false });
    const alle = laadMigraties(
      import.meta.glob<string>('./migraties/*.sql', { query: '?raw', import: 'default', eager: true }),
    );
    await migreer(t.db, { migraties: alle.filter((m) => m.nr < 11), backup: () => Promise.resolve() });
    const regel = t.db.prepare(
      'INSERT INTO daksysteem_materiaal (werkzaamheid_id, ondergrond, bedekking, materiaal_id) VALUES (?, ?, ?, ?)',
    );
    regel.run(ISO, 'hout', null, 'start-mat-pir_100');
    regel.run(ISO, null, 'epdm', 'start-mat-eps');
    // Een regel op Nieuwe bedekking: de bedekking gaat voor, EPDM past bij bitumen niet.
    regel.run(BED, 'beton', null, 'start-mat-epdm');
    expect(await migreer(t.db, { migraties: alle, backup: () => Promise.resolve() })).toMatchObject({
      van: 10,
      naar: SCHEMA_VERSIE,
    });
    const set = haalWerkzaamheden();
    const iso = werk(set, ISO);
    const ids = (w: typeof iso, o: string, b: string) =>
      w.situaties.find((s) => s.ondergrond === o && s.bedekking === b)?.materiaalIds;
    expect(iso.perSituatie).toBe(true);
    expect(ids(iso, 'hout', 'epdm')).toEqual(['start-mat-pir_100', 'start-mat-eps']);
    expect(ids(iso, 'hout', 'bitumen')).toEqual(['start-mat-pir_100']);
    expect(ids(iso, 'beton', 'epdm')).toEqual(['start-mat-eps']);
    expect(ids(iso, 'staal', 'pvc')).toEqual(['start-mat-pir_80']);
    const bed = werk(set, BED);
    expect(ids(bed, 'beton', 'bitumen')).toEqual(['start-mat-bitumen']);
    expect(ids(bed, 'beton', 'epdm')).toEqual(['start-mat-epdm']);
    // Zonder regels en zonder bedekkingsmateriaal: vinkje blijft uit.
    expect(werk(set, 'start-werk-slopen').perSituatie).toBe(false);
    // Nog een keer omzetten (tabel is weg): alleen de werkzaamheden met een bedekkingsmateriaal.
    expect(zetDaksituatiesOm(t.db)).toBe(2);
  });
});

describe('werkzaamheden:bewaar met tags en situaties', () => {
  it('bewaart tags en situaties en geeft ze terug; weglaten laat ze staan', () => {
    const set = metEigenMaterialen();
    expect(tagsVan(set, 'houtschroeven')).toEqual({ ondergrond: ['hout'], bedekking: 'alle' });
    const invoer = alsInvoer(set);
    invoer.werkzaamheden.find((w) => w.id === BED)!.situaties = [
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['start-mat-epdm', 'm-ontl', 'm-hout'] },
    ];
    const na = bewaarWerkzaamheden(invoer);
    expect(werk(na, BED).situaties).toEqual([
      // In de volgorde van de materialenlijst.
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['start-mat-epdm', 'm-hout', 'm-ontl'] },
    ]);
    // Zonder tags, vinkje en situaties (bijv. een oudere aanroeper): alles blijft staan.
    const opnieuw = bewaarWerkzaamheden(alsInvoer(na, true));
    expect(werk(opnieuw, BED)).toMatchObject({ perSituatie: true, situaties: werk(na, BED).situaties });
    expect(tagsVan(opnieuw, 'houtschroeven')).toEqual({ ondergrond: ['hout'], bedekking: 'alle' });
  });

  it('laat niet-kiesbare, niet-passende en onbekende situaties stil vallen; VALIDATIE bij dubbele situatie', () => {
    const set = metEigenMaterialen();
    const invoer = alsInvoer(set);
    const bed = invoer.werkzaamheden.find((w) => w.id === BED)!;
    bed.situaties = [
      // Houtschroeven past niet bij beton, PIR 80 is niet kiesbaar, bitumen past niet bij EPDM.
      {
        ondergrond: 'beton',
        bedekking: 'epdm',
        materiaalIds: ['m-hout', 'start-mat-pir_80', 'start-mat-bitumen', 'm-ontl'],
      },
      { ondergrond: 'onbekend', bedekking: 'epdm', materiaalIds: ['m-ontl'] },
      { ondergrond: 'zand', bedekking: 'epdm', materiaalIds: ['m-ontl'] },
      { ondergrond: 'hout', bedekking: 'riet', materiaalIds: ['m-ontl'] },
    ];
    expect(werk(bewaarWerkzaamheden(invoer), BED).situaties).toEqual([
      { ondergrond: 'beton', bedekking: 'epdm', materiaalIds: ['m-ontl'] },
    ]);
    bed.situaties = [
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['m-ontl'] },
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['m-hout'] },
    ];
    expect(fout(() => bewaarWerkzaamheden(invoer))).toMatchObject({
      code: 'VALIDATIE',
      melding: VALIDATIE_MELDINGEN.werkDubbel,
    });
  });

  it('niet meer kiesbaar of een tag uit: het materiaal verdwijnt uit de situaties; nieuwe werkzaamheid met vinkje', () => {
    const set = metEigenMaterialen();
    const invoer = alsInvoer(set);
    invoer.werkzaamheden.find((w) => w.id === BED)!.situaties = [
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['m-ontl', 'm-hout'] },
    ];
    bewaarWerkzaamheden(invoer);
    // Tag EPDM bij de ontluchter uit (alleen PVC) en houtschroeven niet meer kiesbaar.
    const invoer2 = alsInvoer(haalWerkzaamheden(), true);
    invoer2.materialen.find((m) => m.id === 'm-ontl')!.tags = { ondergrond: 'alle', bedekking: ['pvc'] };
    const bed2 = invoer2.werkzaamheden.find((w) => w.id === BED)!;
    bed2.materialen = bed2.materialen.filter((m) => m.materiaalId !== 'm-hout');
    invoer2.werkzaamheden.push({
      id: 'eigen',
      label: 'Bevestigen',
      eenheid: 'm²',
      prijsCent: null,
      verborgen: false,
      soortenWerk: [],
      opties: [],
      materialen: [{ materiaalId: 'm-hout', standaard: false }],
      perSituatie: true,
      situaties: [{ ondergrond: 'hout', bedekking: 'pvc', materiaalIds: ['m-hout'] }],
    });
    const na = bewaarWerkzaamheden(invoer2);
    expect(werk(na, BED).situaties).toEqual([]);
    expect(werk(na, 'eigen')).toMatchObject({
      perSituatie: true,
      situaties: [{ ondergrond: 'hout', bedekking: 'pvc', materiaalIds: ['m-hout'] }],
    });
    // Vinkje uit bij een bestaande werkzaamheid.
    const uit = alsInvoer(na);
    uit.werkzaamheden.find((w) => w.id === 'eigen')!.perSituatie = false;
    expect(werk(bewaarWerkzaamheden(uit), 'eigen').perSituatie).toBe(false);
    // Onbekende tag vervalt stil.
    const onbekend = alsInvoer(haalWerkzaamheden());
    onbekend.materialen.find((m) => m.id === 'm-hout')!.tags = {
      ondergrond: ['zand', 'beton'],
      bedekking: 'alle',
    };
    expect(tagsVan(bewaarWerkzaamheden(onbekend), 'houtschroeven')).toEqual({
      ondergrond: ['beton'],
      bedekking: 'alle',
    });
  });
});

describe('keuzelijsten en herstel', () => {
  const opties = (lijst: 'ondergrond' | 'nieuweBedekking') =>
    lijstKeuzeopties()[lijst].map(({ id, label, verborgen, standaardkeuze }) => ({
      id,
      label,
      verborgen,
      standaardkeuze,
    }));

  it('een nieuwe bedekking staat bij bestaande materialen aan; verwijderen neemt tags en situaties mee', () => {
    metEigenMaterialen();
    bewaarKeuzelijst('nieuweBedekking', [
      ...opties('nieuweBedekking'),
      { id: '', label: 'Riet', verborgen: false, standaardkeuze: false },
    ]);
    const set = haalWerkzaamheden();
    expect(tagsVan(set, 'epdm')).toEqual({ ondergrond: 'alle', bedekking: ['epdm', 'riet'] });
    expect(tagsVan(set, 'houtschroeven')).toEqual({ ondergrond: ['hout'], bedekking: 'alle' });
    // Een nieuwe ondergrond: houtschroeven krijgt hem erbij.
    bewaarKeuzelijst('ondergrond', [
      ...opties('ondergrond'),
      { id: '', label: 'Kunststof', verborgen: false, standaardkeuze: false },
    ]);
    expect(tagsVan(haalWerkzaamheden(), 'houtschroeven')).toEqual({
      ondergrond: ['hout', 'kunststof'],
      bedekking: 'alle',
    });

    bewaarKeuzelijst(
      'nieuweBedekking',
      opties('nieuweBedekking').filter((o) => o.label !== 'Riet' && o.label !== 'PVC'),
    );
    const na = haalWerkzaamheden();
    expect(tagsVan(na, 'epdm')).toEqual({ ondergrond: 'alle', bedekking: ['epdm'] });
    // De laatste tag verdwijnt mee: dan weer alle.
    expect(tagsVan(na, 'pvc')).toEqual({ ondergrond: 'alle', bedekking: 'alle' });
    expect(werk(na, BED).situaties.some((s) => s.bedekking === 'pvc')).toBe(false);

    // Herstel standaardlijst zet PVC terug: bij materialen met eigen bedekkingstags weer aan.
    herstelKeuzelijst('nieuweBedekking');
    expect(tagsVan(haalWerkzaamheden(), 'epdm')).toEqual({ ondergrond: 'alle', bedekking: ['epdm', 'pvc'] });
  });

  it('Herstel startset: starttags en startsituaties terug, eigen werkzaamheden blijven', () => {
    const set = metEigenMaterialen();
    const invoer = alsInvoer(set);
    invoer.materialen.find((m) => m.id === 'start-mat-epdm')!.tags = {
      ondergrond: ['hout'],
      bedekking: 'alle',
    };
    invoer.werkzaamheden.find((w) => w.id === BED)!.perSituatie = false;
    invoer.werkzaamheden.find((w) => w.id === ISO)!.perSituatie = true;
    invoer.werkzaamheden.find((w) => w.id === ISO)!.situaties = [
      { ondergrond: 'hout', bedekking: 'epdm', materiaalIds: ['start-mat-pir_100'] },
    ];
    bewaarWerkzaamheden(invoer);
    herstelWerkzaamheden();
    const na = haalWerkzaamheden();
    expect(tagsVan(na, 'epdm')).toEqual({ ondergrond: 'alle', bedekking: ['epdm'] });
    expect(tagsVan(na, 'houtschroeven')).toEqual({ ondergrond: ['hout'], bedekking: 'alle' });
    expect(werk(na, BED)).toMatchObject({ perSituatie: true });
    expect(werk(na, BED).situaties).toHaveLength(9);
    expect(werk(na, ISO)).toMatchObject({ perSituatie: false, situaties: [] });
    // Een verwijderde startwerkzaamheid slaat de startset over.
    t.db.prepare("DELETE FROM werkzaamheden WHERE id = 'start-werk-slopen'").run();
    expect(() => zetSituatieStartset(t.db)).not.toThrow();
  });
});
