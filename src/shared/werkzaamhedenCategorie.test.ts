import { describe, expect, it } from 'vitest';
import type { Categorie } from './types';
import {
  CATEGORIEEN_STARTSET,
  CATEGORIE_OVERIG,
  MATERIALEN_STARTSET,
  categorieIdVan,
  categorieVan,
  groepeerOpCategorie,
} from './werkzaamheden';

// OFM-057: categorieën van materialen (pure functies, 100 % branches).

const cat = (id: string, naam: string): Categorie => ({ id, naam, standaard: false });
const ISO = cat('cat:isolatie', 'Isolatie');
const OVERIG = cat(CATEGORIE_OVERIG, 'Overig');
const m = (id: string, categorieId: string | null) => ({ id, categorieId });

describe('startset', () => {
  it('Overig is de laatste startcategorie; elk startmateriaal heeft een bestaande categorie', () => {
    expect(CATEGORIEEN_STARTSET.at(-1)?.sleutel).toBe('overig');
    expect(categorieIdVan('overig')).toBe(CATEGORIE_OVERIG);
    const sleutels = new Set(CATEGORIEEN_STARTSET.map((c) => c.sleutel));
    expect(MATERIALEN_STARTSET.every((x) => sleutels.has(x.categorie))).toBe(true);
  });
});

describe('categorieVan', () => {
  it('geeft de categorie, of Overig bij null of een onbekende id', () => {
    expect(categorieVan(m('a', 'cat:isolatie'), [ISO])).toBe('cat:isolatie');
    expect(categorieVan(m('a', null), [ISO])).toBe(CATEGORIE_OVERIG);
    expect(categorieVan(m('a', 'cat:weg'), [ISO])).toBe(CATEGORIE_OVERIG);
  });
});

describe('groepeerOpCategorie', () => {
  it('groepeert in de volgorde van de categorieën, ook lege groepen, onbekend bij Overig', () => {
    const groepen = groepeerOpCategorie(
      [m('1', null), m('2', 'cat:isolatie'), m('3', 'cat:weg'), m('4', 'cat:isolatie')],
      [ISO, cat('cat:kappen', 'Kappen'), OVERIG],
    );
    expect(groepen.map((g) => [g.categorie.id, g.materialen.map((x) => x.id)])).toEqual([
      ['cat:isolatie', ['2', '4']],
      ['cat:kappen', []],
      [CATEGORIE_OVERIG, ['1', '3']],
    ]);
  });

  it('zonder Overig in de lijst komt Overig achteraan, alleen als er materialen in zitten', () => {
    const met = groepeerOpCategorie([m('1', null), m('2', null), m('3', 'cat:isolatie')], [ISO]);
    expect(met.map((g) => [g.categorie.naam, g.materialen.length])).toEqual([
      ['Isolatie', 1],
      ['Overig', 2],
    ]);
    expect(groepeerOpCategorie([m('1', 'cat:isolatie')], [ISO]).map((g) => g.categorie.id)).toEqual([
      'cat:isolatie',
    ]);
  });
});
