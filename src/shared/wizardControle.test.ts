import { describe, expect, it } from 'vitest';
import { legeKlant, legeKlusInvoer } from './nieuweOfferte';
import { puntTekst, wizardPuntenMelding } from './teksten/wizardPunten';
import type { Dakvlak, Klant } from './types';
import { standaardVerplicht, type Verplicht } from './verplicht';
import { ontbrekendInStap1, puntenPerStap, puntSleutel, wizardPunten } from './wizardControle';

// OFM-035/038: de lijst van punten per stap (vrij navigeren, controle pas bij Maak de offerte), met de
// instelbare verplichte velden.

const vlak = (deel: Partial<Dakvlak>): Dakvlak => ({
  id: 'v',
  naam: 'Dakvlak 1',
  modus: 'lxb',
  lengteM: null,
  breedteM: null,
  m2: null,
  ...deel,
});
/** Klant met alles van stap 1 ingevuld. */
const volledig: Klant = {
  ...legeKlant(),
  voornaam: 'Jan',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Kerkstraat 1', postcode: '5611 AB', plaats: 'Eindhoven' },
  telefoon: '0612345678',
  email: 'jan@mail.nl',
};
const klant = (deel: Partial<Klant> = {}): Klant => ({ ...volledig, ...deel });
const compleet = {
  ...legeKlusInvoer(),
  soortWerk: 'reparatie',
  dakvlakken: [vlak({ lengteM: 5, breedteM: 4 })],
};
/** Alleen wat altijd verplicht is: soort werk en een dakvlak. */
const niets: Verplicht = Object.fromEntries(
  Object.keys(standaardVerplicht()).map((v) => [v, false]),
) as Verplicht;
const std = standaardVerplicht();

describe('wizardPunten', () => {
  it('compleet met de standaardinstelling: geen punten', () => {
    expect(wizardPunten(klant(), compleet, std)).toEqual([]);
  });

  it('lege offerte, standaard: alle velden van stap 1, soort werk en dakvlak, in stapvolgorde', () => {
    const punten = wizardPunten(legeKlant(), legeKlusInvoer(), std);
    expect(punten.map((p) => (p.soort === 'ontbreekt' ? p.veld : p.soort))).toEqual([
      'voornaam',
      'achternaam',
      'postcode',
      'huisnummer',
      'straat',
      'plaats',
      'telefoon',
      'email',
      'soortWerk',
      'dakvlak',
    ]);
    expect(puntenPerStap(punten)).toEqual([8, 2, 0, 0]);
    expect(punten.map(puntTekst).slice(0, 2)).toEqual(['Voornaam ontbreekt', 'Achternaam ontbreekt']);
    expect(punten.map(puntTekst).slice(-2)).toEqual(['Soort werk is niet gekozen', 'Geen dakvlak ingevuld']);
  });

  it('alles uit: alleen soort werk en dakvlak blijven verplicht', () => {
    const punten = wizardPunten(legeKlant(), legeKlusInvoer(), niets);
    expect(punten).toEqual([
      { stap: 2, soort: 'ontbreekt', veld: 'soortWerk' },
      { stap: 2, soort: 'ontbreekt', veld: 'dakvlak' },
    ]);
  });

  it('dakvlak telt pas met een oppervlakte > 0 (l×b of m²)', () => {
    const met = (dakvlakken: Dakvlak[]) => wizardPunten(klant(), { ...compleet, dakvlakken }, std);
    expect(met([vlak({ lengteM: 5, breedteM: null })])).toEqual([
      { stap: 2, soort: 'ontbreekt', veld: 'dakvlak' },
    ]);
    expect(met([vlak({ modus: 'm2', m2: 0 })])).toEqual([{ stap: 2, soort: 'ontbreekt', veld: 'dakvlak' }]);
    expect(met([vlak({}), vlak({ modus: 'm2', m2: 12 })])).toEqual([]);
  });

  it('bedrijfsnaam alleen bij aanhef Bedrijf; de contactpersoon blijft verplicht', () => {
    expect(wizardPunten(klant({ aanhef: 'dhr' }), compleet, std)).toEqual([]);
    const bedrijf = wizardPunten(klant({ aanhef: 'bedrijf', voornaam: '' }), compleet, std);
    expect(bedrijf.map(puntTekst)).toEqual(['Voornaam ontbreekt', 'Bedrijfsnaam ontbreekt']);
  });

  it('werkadres alleen als het is aangevinkt', () => {
    expect(wizardPunten(klant({ heeftWerkadres: false }), compleet, std)).toEqual([]);
    const punten = wizardPunten(klant({ heeftWerkadres: true }), compleet, std);
    expect(punten.map(puntTekst)).toEqual([
      'Postcode van het werkadres ontbreekt',
      'Huisnummer van het werkadres ontbreekt',
      'Straat van het werkadres ontbreekt',
      'Plaats van het werkadres ontbreekt',
    ]);
  });

  it('straat zonder huisnummer: huisnummer ontbreekt (en het veld is ongeldig)', () => {
    const punten = wizardPunten(
      klant({ adres: { ...volledig.adres, straatHuisnummer: 'Kerkstraat' } }),
      compleet,
      std,
    );
    expect(punten.map(puntSleutel)).toEqual(['ontbreekt:huisnummer', 'ongeldig:adres.straatHuisnummer']);
  });

  it('stap 2 en 3 instelbaar: soort dak, hoogte en minstens één extra', () => {
    const aan = { ...niets, soortDak: true, hoogte: true, extra: true };
    const punten = wizardPunten(klant(), compleet, aan);
    expect(punten).toEqual([
      { stap: 2, soort: 'ontbreekt', veld: 'soortDak' },
      { stap: 3, soort: 'ontbreekt', veld: 'extra' },
    ]);
    expect(wizardPunten(klant(), { ...compleet, soortDak: 'plat', hwaAantal: 2 }, aan)).toEqual([]);
    expect(
      wizardPunten(klant(), { ...compleet, soortDak: 'plat', extraAantallen: { zink: 1 } }, aan),
    ).toEqual([]);
  });

  it('ongeldige klantvelden (OFM-030) tellen mee, met veldnaam en uitleg', () => {
    const punten = wizardPunten(klant({ email: 'geen-mail', telefoon: '123' }), compleet, std);
    expect(punten).toEqual([
      { stap: 1, soort: 'ongeldig', veld: 'telefoon', fout: 'telefoon' },
      { stap: 1, soort: 'ongeldig', veld: 'email', fout: 'email' },
    ]);
    expect(puntTekst(punten[1]!)).toBe(
      'E-mail van de klant: Een e-mailadres ziet eruit als naam@voorbeeld.nl, zonder spaties',
    );
    expect(puntenPerStap(punten)).toEqual([2, 0, 0, 0]);
  });

  it('ontbrekendInStap1: alleen de ontbrekende velden van stap 1', () => {
    const punten = wizardPunten(klant({ achternaam: '', email: 'x' }), { ...compleet, soortWerk: null }, std);
    expect([...ontbrekendInStap1(punten)]).toEqual(['achternaam']);
  });

  it('melding voor main: kop en één regel per punt', () => {
    expect(wizardPuntenMelding([{ stap: 1, soort: 'ontbreekt', veld: 'achternaam' }])).toBe(
      'De offerte kan nog niet worden gemaakt. Dit ontbreekt nog of klopt niet:\n- Achternaam ontbreekt',
    );
  });
});
