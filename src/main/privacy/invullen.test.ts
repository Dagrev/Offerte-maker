import { describe, expect, it } from 'vitest';
import type { Klant, OfferteInhoud } from '@shared/types';
import { maakKlant } from '../../../test/privacy/testset';
import {
  TOEGESTANE_PLAATSHOUDERS,
  WEGGELATEN_PLAATSHOUDERS,
  invullen,
  tekstvelden,
  terugNaarPlaatshouders,
  vulTekstIn,
} from './invullen';

const klant: Klant = maakKlant({
  aanhef: 'dhr',
  naam: 'Jansen',
  bedrijfsnaam: '',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
});

const inhoud = (tekst: string): OfferteInhoud => ({
  titel: tekst,
  inleiding: tekst,
  werkomschrijving: [tekst, tekst],
  regels: [
    {
      id: 'r1',
      omschrijving: tekst,
      aantalHonderdsten: 100,
      eenheid: 'post',
      prijsCent: 100,
      btwTarief: 21,
      prijsbron: 'handmatig',
      prijspostId: null,
    },
  ],
  uitvoering: tekst,
  opmerkingen: tekst,
  afsluiting: tekst,
  controlepunten: [tekst],
});

describe('invullen (§11.4)', () => {
  it('aanhef per soort klant', () => {
    expect(vulTekstIn('[KLANT_AANHEF] [KLANT_NAAM]', klant)).toBe('Dhr. Jansen');
    expect(vulTekstIn('[KLANT_AANHEF] [KLANT_NAAM]', { ...klant, aanhef: 'mevr' })).toBe('Mevr. Jansen');
    expect(vulTekstIn('[KLANT_AANHEF] [KLANT_NAAM]', { ...klant, aanhef: 'fam' })).toBe('Fam. Jansen');
    expect(vulTekstIn('Beste [KLANT_AANHEF] [KLANT_NAAM]', { ...klant, aanhef: 'bedrijf' })).toBe(
      'Beste Jansen',
    );
  });

  it('bedrijf: bedrijfsnaam, of de naam als die leeg is', () => {
    expect(vulTekstIn('[KLANT_BEDRIJF]', { ...klant, bedrijfsnaam: 'Dakwerken BV' })).toBe('Dakwerken BV');
    expect(vulTekstIn('[KLANT_BEDRIJF]', klant)).toBe('Jansen');
  });

  it('adres, postcode, plaats', () => {
    expect(vulTekstIn('[KLANT_ADRES], [KLANT_POSTCODE] [KLANT_PLAATS]', klant)).toBe(
      'Dorpsstraat 12, 5501 AB Veldhoven',
    );
  });

  it('werkadres: van het werkadres, zonder werkadres van de klant', () => {
    expect(vulTekstIn('[WERK_ADRES] te [WERK_PLAATS]', klant)).toBe('Dorpsstraat 12 te Veldhoven');
    const metWerk = {
      ...klant,
      heeftWerkadres: true,
      werkadres: { straatHuisnummer: 'Industrieweg 5', postcode: '5652 AA', plaats: 'Eindhoven' },
    };
    expect(vulTekstIn('[WERK_ADRES] te [WERK_PLAATS]', metWerk)).toBe('Industrieweg 5 te Eindhoven');
  });

  it('[VERWIJDERD] en [BEDRIJF] verdwijnen, dubbele spaties en spaties aan de randen opgeschoond (V-02)', () => {
    expect(vulTekstIn('Bel [VERWIJDERD] of mail [BEDRIJF] vandaag', klant)).toBe('Bel of mail vandaag');
    expect(vulTekstIn('[VERWIJDERD] begin\neind [BEDRIJF]', klant)).toBe('begin\neind');
  });

  it('onbekende plaatshouders blijven staan', () => {
    expect(vulTekstIn('[ONBEKEND] en [klant_naam]', klant)).toBe('[ONBEKEND] en [klant_naam]');
  });

  it('FE-037: na invullen staat nergens nog een van de tien plaatshouders', () => {
    const alle = [...TOEGESTANE_PLAATSHOUDERS, ...WEGGELATEN_PLAATSHOUDERS].join(' ');
    const velden = tekstvelden(invullen(inhoud(alle), klant));
    expect(velden).toHaveLength(9);
    for (const veld of velden) {
      for (const p of [...TOEGESTANE_PLAATSHOUDERS, ...WEGGELATEN_PLAATSHOUDERS])
        expect(veld).not.toContain(p);
    }
  });

  it('laat getallen en ids van regels ongemoeid', () => {
    const uit = invullen(inhoud('[KLANT_NAAM]'), klant);
    expect(uit.regels[0]).toMatchObject({
      id: 'r1',
      omschrijving: 'Jansen',
      aantalHonderdsten: 100,
      prijsCent: 100,
    });
  });
});

describe('terugNaarPlaatshouders', () => {
  it('filtert alle tekstvelden', () => {
    const uit = terugNaarPlaatshouders(inhoud('Dhr. Jansen, Dorpsstraat 12, 06-12345678'), klant);
    for (const veld of tekstvelden(uit)) {
      expect(veld).toBe('Dhr. [KLANT_NAAM], [KLANT_ADRES], [VERWIJDERD]');
    }
  });

  it('heen en terug geeft dezelfde inhoud', () => {
    const x = inhoud('Offerte voor [KLANT_NAAM], [KLANT_ADRES], [KLANT_POSTCODE] [KLANT_PLAATS]');
    expect(terugNaarPlaatshouders(invullen(x, klant), klant)).toEqual(x);
  });
});
