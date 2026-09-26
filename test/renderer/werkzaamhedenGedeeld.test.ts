import { describe, expect, it } from 'vitest';
import type { WerkzaamhedenSet } from '@shared/types';
import {
  allesBenoemd,
  beginSetLabels,
  categorieNaamFout,
  naamVan,
  sorteerOpNaam,
  vergelijkNaam,
  zoekOpNaam,
} from '../../src/renderer/src/schermen/instellingen/werkzaamhedenGedeeld';

// OFM-056: alfabetisch sorteren, zoeken en stabiele namen in de tabs Materialen en prijzen en Werkzaamheden.

const item = (id: string, label: string) => ({ id, label });

describe('sorteerOpNaam', () => {
  it('sorteert Nederlands, zonder hoofdlettergevoeligheid en met getallen op waarde', () => {
    const lijst = [
      item('1', 'Zink'),
      item('2', 'bitumen'),
      item('3', 'Éénlaags'),
      item('4', 'PIR 120 mm'),
      item('5', 'PIR 80 mm'),
    ];
    expect(sorteerOpNaam(lijst).map((i) => i.label)).toEqual([
      'bitumen',
      'Éénlaags',
      'PIR 80 mm',
      'PIR 120 mm',
      'Zink',
    ]);
  });

  it('gebruikt de bewaarde naam als die er is, zodat een item niet verspringt tijdens het typen', () => {
    const lijst = [item('a', 'Aaa (typt)'), item('b', 'Beton')];
    const bewaard = [item('a', 'Zink'), item('b', 'Beton')];
    expect(sorteerOpNaam(lijst, bewaard).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('laat de invoer ongemoeid en houdt bij gelijke namen de opslagvolgorde', () => {
    const lijst = [item('1', 'Lood'), item('2', 'lood')];
    const uit = sorteerOpNaam(lijst);
    expect(uit.map((i) => i.id)).toEqual(['1', '2']);
    expect(uit).not.toBe(lijst);
    expect(vergelijkNaam('a', 'A')).toBe(0);
  });
});

describe('zoekOpNaam', () => {
  const lijst = [item('1', 'Houtschroeven'), item('2', 'Betonpluggen'), item('3', 'EPDM')];

  it('vindt een deel van het woord, zonder hoofdletters en spaties aan de randen', () => {
    expect(zoekOpNaam(lijst, '  SCHROEV ').map((i) => i.id)).toEqual(['1']);
    expect(zoekOpNaam(lijst, 'o').map((i) => i.id)).toEqual(['1', '2']);
  });

  it('leeg = alles, niets gevonden = leeg', () => {
    expect(zoekOpNaam(lijst, '')).toEqual(lijst);
    expect(zoekOpNaam(lijst, 'zink')).toEqual([]);
  });
});

describe('namen', () => {
  it('beginSetLabels vult de begin-namen aan met nieuwe items', () => {
    expect(beginSetLabels([item('a', 'Oud')], [item('a', 'Nieuw'), item('b', 'Extra')])).toEqual([
      item('a', 'Oud'),
      item('b', 'Extra'),
    ]);
  });

  it('naamVan: bewaard, anders huidig, anders de terugval', () => {
    expect(naamVan(item('a', 'Typt'), [item('a', 'Bewaard')], 'Naam')).toBe('Bewaard');
    expect(naamVan(item('b', ' Huidig '), [], 'Naam')).toBe('Huidig');
    expect(naamVan(item('c', '  '), [], 'Naam')).toBe('Naam');
  });

  it('allesBenoemd: werkzaamheden, opties en materialen moeten een naam hebben', () => {
    const set = (werk: string, optie: string, materiaal: string) =>
      ({
        werkzaamheden: [{ label: werk, opties: [{ label: optie }] }],
        materialen: [{ label: materiaal }],
        soortenWerk: [],
        categorieen: [{ id: 'cat:overig', naam: 'Overig', standaard: true }],
      }) as unknown as WerkzaamhedenSet;
    expect(allesBenoemd(set('Slopen', 'Container', 'Zink'))).toBe(true);
    expect(allesBenoemd(set('Slopen', ' ', 'Zink'))).toBe(false);
    expect(allesBenoemd(set('Slopen', 'Container', ''))).toBe(false);
    const metCategorieen = set('Slopen', 'Container', 'Zink');
    metCategorieen.categorieen.push({ id: 'x', naam: ' overig ', standaard: false });
    expect(allesBenoemd(metCategorieen)).toBe(false);
  });

  it('categorieNaamFout: leeg, dubbel (zonder hoofdletterverschil) of goed; de eigen naam telt niet', () => {
    const lijst = [
      { id: 'a', naam: 'Isolatie' },
      { id: 'b', naam: 'Kappen' },
    ];
    expect(categorieNaamFout('  ', null, lijst)).toBe('leeg');
    expect(categorieNaamFout(' ISOLATIE ', null, lijst)).toBe('dubbel');
    expect(categorieNaamFout('Isolatie', 'a', lijst)).toBeNull();
    expect(categorieNaamFout('Kappen', 'a', lijst)).toBe('dubbel');
    expect(categorieNaamFout('Lood', null, lijst)).toBeNull();
  });
});
