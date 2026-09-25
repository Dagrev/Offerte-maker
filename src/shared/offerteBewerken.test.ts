import { describe, expect, it } from 'vitest';
import { aantalNaarHonderdsten, berekenTotalen, euroNaarCent, regelbedragCent } from './calc/bedragen';
import { formatEuro } from './formatteer';
import {
  formulierVan,
  gelePunten,
  inhoudVan,
  isGewijzigd,
  markeerHandmatig,
  nieuweRegel,
  verplaats,
  werkomschrijvingUitTekst,
} from './offerteBewerken';
import type { OfferteInhoud, Offerteregel } from './types';

const regel = (id: string, deel: Partial<Offerteregel> = {}): Offerteregel => ({
  id,
  omschrijving: `Regel ${id}`,
  aantalHonderdsten: 1000,
  eenheid: 'm²',
  prijsCent: 500,
  btwTarief: 21,
  prijsbron: 'prijslijst',
  prijspostId: 'start-x',
  ...deel,
});

const inhoud = (regels: Offerteregel[], controlepunten: string[]): OfferteInhoud => ({
  titel: '',
  inleiding: '',
  werkomschrijving: [],
  regels,
  uitvoering: '',
  opmerkingen: '',
  afsluiting: '',
  controlepunten,
});

const tekst = (o: string, p: string, e: string) => `Geschatte prijs: ${o} (${p} per ${e}).`;

describe('gelePunten (V-05)', () => {
  it('controlepunten plus één berekende melding per schattingsregel', () => {
    const i = inhoud(
      [
        regel('a'),
        regel('b', { omschrijving: 'Daktrim', prijsCent: 2750, eenheid: 'm¹', prijsbron: 'schatting' }),
      ],
      ['Punt 1', 'Punt 2'],
    );
    expect(gelePunten(i, tekst)).toEqual(['Punt 1', 'Punt 2', 'Geschatte prijs: Daktrim (€ 27,50 per m¹).']);
  });

  it('leeg zonder punten en schattingen', () => {
    expect(gelePunten(inhoud([regel('a')], []), tekst)).toEqual([]);
  });
});

describe('markeerHandmatig (§5, V-05)', () => {
  it('nieuwe regel en gewijzigde prijs → handmatig; aantal of tekst wijzigen niet', () => {
    const oud = [regel('a'), regel('b', { prijsbron: 'schatting' }), regel('c', { prijsbron: 'voorbeeld' })];
    const nieuw = [
      regel('a', { aantalHonderdsten: 1200, omschrijving: 'Anders' }),
      regel('b', { prijsCent: 600, prijsbron: 'schatting' }),
      regel('d', { prijsbron: 'schatting' }),
    ];
    expect(markeerHandmatig(oud, nieuw).map((r) => r.prijsbron)).toEqual([
      'prijslijst',
      'handmatig',
      'handmatig',
    ]);
  });
});

describe('nieuweRegel', () => {
  it('handmatig, zonder prijspost', () => {
    expect(nieuweRegel('x')).toMatchObject({
      id: 'x',
      prijsbron: 'handmatig',
      prijspostId: null,
      btwTarief: 21,
    });
  });
});

describe('verplaats', () => {
  it('omhoog en omlaag', () => {
    expect(verplaats(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(verplaats(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });
  it('aan de rand of buiten de lijst ongewijzigd', () => {
    expect(verplaats(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(verplaats(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(verplaats(['a', 'b'], 5, -1)).toEqual(['a', 'b']);
    expect(verplaats(['a', 'b'], -1, 1)).toEqual(['a', 'b']);
  });
});

describe('formulier (Bewerken)', () => {
  const origineel: OfferteInhoud = {
    ...inhoud(
      [regel('a', { aantalHonderdsten: 1000, prijsCent: 500 }), regel('b', { prijsbron: 'schatting' })],
      ['Punt'],
    ),
    werkomschrijving: ['Stap 1', 'Stap 2'],
  };

  it('ongewijzigd formulier geeft dezelfde inhoud en is niet gewijzigd', () => {
    const f = formulierVan(origineel);
    expect(f.werkomschrijving).toBe('Stap 1\nStap 2');
    expect(inhoudVan(f, origineel.regels)).toEqual(origineel);
    expect(isGewijzigd(f, origineel)).toBe(false);
  });

  it('FE-052: aantal 10 → 12 bij € 5,00 maakt regelbedrag en totalen direct € 60,00 + btw', () => {
    const f = formulierVan(origineel);
    const regels = f.regels.map((r) =>
      r.id === 'a' ? { ...r, aantalHonderdsten: aantalNaarHonderdsten(12), prijsCent: euroNaarCent(5) } : r,
    );
    const nu = inhoudVan({ ...f, regels }, origineel.regels);
    expect(formatEuro(regelbedragCent(nu.regels[0] as Offerteregel))).toBe('€ 60,00');
    const totalen = berekenTotalen(nu.regels);
    expect(totalen.subtotaalCent).toBe(6000 + 5000);
    expect(totalen.btw).toEqual([{ tarief: 21, grondslagCent: 11000, bedragCent: 2310 }]);
    expect(totalen.totaalCent).toBe(13310);
    expect(isGewijzigd({ ...f, regels }, origineel)).toBe(true);
  });

  it('controlepunt verwijderen, tekst of volgorde wijzigen telt als wijziging', () => {
    const f = formulierVan(origineel);
    expect(isGewijzigd({ ...f, controlepunten: [] }, origineel)).toBe(true);
    expect(isGewijzigd({ ...f, werkomschrijving: 'Stap 1\n\nStap 2\n' }, origineel)).toBe(false);
    expect(isGewijzigd({ ...f, titel: 'Nieuw' }, origineel)).toBe(true);
    expect(isGewijzigd({ ...f, regels: verplaats(f.regels, 0, 1) }, origineel)).toBe(true);
  });

  it('prijs van een schattingsregel wijzigen → handmatig en geen schattingsmelding meer', () => {
    const f = formulierVan(origineel);
    const regels = f.regels.map((r) => (r.id === 'b' ? { ...r, prijsCent: 900 } : r));
    const nu = inhoudVan({ ...f, regels }, origineel.regels);
    expect(nu.regels[1]?.prijsbron).toBe('handmatig');
    expect(gelePunten(nu, tekst)).toEqual(['Punt']);
  });
});

describe('werkomschrijvingUitTekst', () => {
  it('één stap per regel, lege regels weg', () => {
    expect(werkomschrijvingUitTekst('Stap 1\r\n\n  \nStap 2\n')).toEqual(['Stap 1', 'Stap 2']);
  });
});
