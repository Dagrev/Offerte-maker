import { describe, expect, it } from 'vitest';
import { legeKlant, legeKlusInvoer } from './nieuweOfferte';
import { puntTekst, wizardPuntenMelding } from './teksten/wizardPunten';
import type { Dakvlak, Klant } from './types';
import { heeftKlantnaam, puntenPerStap, wizardPunten } from './wizardControle';

// OFM-035: de lijst van punten per stap (vrij navigeren, controle pas bij Maak de offerte).

const vlak = (deel: Partial<Dakvlak>): Dakvlak => ({
  id: 'v',
  naam: 'Dakvlak 1',
  modus: 'lxb',
  lengteM: null,
  breedteM: null,
  m2: null,
  ...deel,
});
const klant = (deel: Partial<Klant> = {}): Klant => ({ ...legeKlant(), naam: 'Jansen', ...deel });
const compleet = {
  ...legeKlusInvoer(),
  soortWerk: 'reparatie',
  dakvlakken: [vlak({ lengteM: 5, breedteM: 4 })],
};

describe('wizardPunten', () => {
  it('compleet: geen punten; plaats en de rest zijn optioneel', () => {
    expect(wizardPunten(klant(), compleet)).toEqual([]);
  });

  it('lege offerte: naam, soort werk en dakvlak, in stapvolgorde', () => {
    const punten = wizardPunten(legeKlant(), legeKlusInvoer());
    expect(punten).toEqual([
      { stap: 1, soort: 'naam' },
      { stap: 2, soort: 'soortWerk' },
      { stap: 2, soort: 'dakvlak' },
    ]);
    expect(puntenPerStap(punten)).toEqual([1, 2, 0, 0]);
    expect(punten.map(puntTekst)).toEqual([
      'Naam van de klant ontbreekt',
      'Soort werk is niet gekozen',
      'Geen dakvlak ingevuld',
    ]);
  });

  it('dakvlak telt pas met een oppervlakte > 0 (l×b of m²)', () => {
    const met = (dakvlakken: Dakvlak[]) => wizardPunten(klant(), { ...compleet, dakvlakken });
    expect(met([vlak({ lengteM: 5, breedteM: null })])).toEqual([{ stap: 2, soort: 'dakvlak' }]);
    expect(met([vlak({ modus: 'm2', m2: 0 })])).toEqual([{ stap: 2, soort: 'dakvlak' }]);
    expect(met([vlak({}), vlak({ modus: 'm2', m2: 12 })])).toEqual([]);
  });

  it('bedrijf: bedrijfsnaam alleen is genoeg; een particulier heeft een naam nodig', () => {
    expect(heeftKlantnaam({ aanhef: 'bedrijf', naam: ' ', bedrijfsnaam: 'Bouw BV' })).toBe(true);
    expect(heeftKlantnaam({ aanhef: 'dhr', naam: ' ', bedrijfsnaam: 'Bouw BV' })).toBe(false);
  });

  it('ongeldige klantvelden (OFM-030) tellen mee, met veldnaam en uitleg', () => {
    const punten = wizardPunten(klant({ email: 'geen-mail', telefoon: '123' }), compleet);
    expect(punten).toEqual([
      { stap: 1, soort: 'ongeldig', veld: 'telefoon', fout: 'telefoon' },
      { stap: 1, soort: 'ongeldig', veld: 'email', fout: 'email' },
    ]);
    expect(puntTekst(punten[1]!)).toBe(
      'E-mail van de klant: Een e-mailadres ziet eruit als naam@voorbeeld.nl, zonder spaties',
    );
    expect(puntenPerStap(punten)).toEqual([2, 0, 0, 0]);
  });

  it('melding voor main: kop en één regel per punt', () => {
    expect(wizardPuntenMelding([{ stap: 1, soort: 'naam' }])).toBe(
      'De offerte kan nog niet worden gemaakt. Dit ontbreekt nog of klopt niet:\n- Naam van de klant ontbreekt',
    );
  });
});
