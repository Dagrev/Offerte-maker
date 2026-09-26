import { describe, expect, it } from 'vitest';
import { maakKlant } from '../../../test/privacy/testset';
import { type PiiWaarde, bouwPiiSet, telefoonCijfers, zoekpatroon } from './piiSet';

const waarden = (set: PiiWaarde[], plaatshouder: string) =>
  set.filter((p) => p.plaatshouder === plaatshouder).map((p) => p.waarde);

describe('bouwPiiSet (§11.1)', () => {
  it('naam: volledig en elk woord ≥ 3 dat geen tussenvoegsel is', () => {
    const set = bouwPiiSet(maakKlant({ naam: ' Piet van der Berg ' }));
    expect(waarden(set, '[KLANT_NAAM]').sort()).toEqual(['Berg', 'Piet', 'Piet van der Berg']);
  });

  it('naam: alle tussenvoegsels vallen af', () => {
    const set = bouwPiiSet(maakKlant({ naam: "van de der den het ten ter te op in 't von le la du Aal" }));
    expect(waarden(set, '[KLANT_NAAM]')).toEqual([
      "van de der den het ten ter te op in 't von le la du Aal",
      'Aal',
    ]);
  });

  it('naam: volledige naam vanaf 2 tekens, woorden pas vanaf 3', () => {
    expect(waarden(bouwPiiSet(maakKlant({ naam: 'Li' })), '[KLANT_NAAM]')).toEqual(['Li']);
    expect(waarden(bouwPiiSet(maakKlant({ naam: 'X' })), '[KLANT_NAAM]')).toEqual([]);
    expect(waarden(bouwPiiSet(maakKlant({ naam: 'Li Wu Kok' })), '[KLANT_NAAM]')).toEqual([
      'Li Wu Kok',
      'Kok',
    ]);
  });

  it('naam: koppeltekens splitsen dubbele achternamen', () => {
    const set = bouwPiiSet(maakKlant({ naam: 'Jansen-de Vries' }));
    expect(waarden(set, '[KLANT_NAAM]').sort()).toEqual(['Jansen', 'Jansen-de Vries', 'Vries']);
  });

  it('bedrijfsnaam: volledig en elk woord ≥ 4 behalve de algemene bedrijfswoorden', () => {
    const set = bouwPiiSet(maakKlant({ bedrijfsnaam: 'Bouw en Beheer Groep Holding Smit Dakwerken B.V.' }));
    expect(waarden(set, '[KLANT_BEDRIJF]')).toEqual([
      'Bouw en Beheer Groep Holding Smit Dakwerken B.V.',
      'Dakwerken',
      'Smit',
    ]);
    const vof = bouwPiiSet(maakKlant({ bedrijfsnaam: 'Kok vof' }));
    expect(waarden(vof, '[KLANT_BEDRIJF]')).toEqual(['Kok vof']);
    expect(waarden(bouwPiiSet(maakKlant({ bedrijfsnaam: 'A' })), '[KLANT_BEDRIJF]')).toEqual([]);
    expect(waarden(bouwPiiSet(maakKlant({ bedrijfsnaam: 'Kok V.O.F' })), '[KLANT_BEDRIJF]')).toEqual([
      'Kok V.O.F',
    ]);
  });

  it('adres: volledig en straatnaam zonder huisnummer (≥ 4)', () => {
    const set = bouwPiiSet(
      maakKlant({ adres: { straatHuisnummer: 'Kerkstraat 12a', postcode: '', plaats: '' } }),
    );
    expect(waarden(set, '[KLANT_ADRES]')).toEqual(['Kerkstraat 12a', 'Kerkstraat']);
    const kort = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: 'Hof 2', postcode: '', plaats: '' } }));
    expect(waarden(kort, '[KLANT_ADRES]')).toEqual(['Hof 2']);
    const zonderNummer = bouwPiiSet(
      maakKlant({ adres: { straatHuisnummer: 'Het Hofje', postcode: '', plaats: '' } }),
    );
    expect(waarden(zonderNummer, '[KLANT_ADRES]')).toEqual(['Het Hofje']);
  });

  it('postcode: genormaliseerd met en zonder spatie', () => {
    const set = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: '', postcode: ' 5611ab ', plaats: '' } }));
    expect(waarden(set, '[KLANT_POSTCODE]').sort()).toEqual(['5611 AB', '5611AB']);
    const kort = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: '', postcode: '5611', plaats: '' } }));
    expect(waarden(kort, '[KLANT_POSTCODE]')).toEqual([]);
    const buitenlands = bouwPiiSet(
      maakKlant({ adres: { straatHuisnummer: '', postcode: 'B-2000', plaats: '' } }),
    );
    expect(waarden(buitenlands, '[KLANT_POSTCODE]')).toEqual(['B-2000']);
  });

  it('plaats: volledig, vanaf 2 tekens, hoofdlettergevoelig', () => {
    const set = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: '', postcode: '', plaats: 'Best' } }));
    expect(set.find((p) => p.plaatshouder === '[KLANT_PLAATS]')).toEqual({
      waarde: 'Best',
      plaatshouder: '[KLANT_PLAATS]',
      hoofdlettergevoelig: true,
      soort: 'tekst',
    });
  });

  it('werkadres alleen als heeftWerkadres', () => {
    const werkadres = { straatHuisnummer: 'Industrieweg 5', postcode: '5652 AA', plaats: 'Eindhoven' };
    expect(bouwPiiSet(maakKlant({ werkadres })).some((p) => p.plaatshouder === '[WERK_ADRES]')).toBe(false);
    const set = bouwPiiSet(maakKlant({ heeftWerkadres: true, werkadres }));
    expect(waarden(set, '[WERK_ADRES]')).toEqual(['Industrieweg 5', 'Industrieweg']);
    expect(waarden(set, '[VERWIJDERD]').sort()).toEqual(['5652 AA', '5652AA']);
    expect(set.find((p) => p.plaatshouder === '[WERK_PLAATS]')).toMatchObject({
      waarde: 'Eindhoven',
      hoofdlettergevoelig: true,
    });
  });

  it('werkadreswaarde gelijk aan klantwaarde: alleen de klantplaatshouder', () => {
    const adres = { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' };
    const set = bouwPiiSet(
      maakKlant({
        adres,
        heeftWerkadres: true,
        werkadres: { straatHuisnummer: 'Dorpsstraat 14', postcode: '5501AB', plaats: 'Veldhoven' },
      }),
    );
    expect(waarden(set, '[WERK_ADRES]')).toEqual(['Dorpsstraat 14']);
    expect(waarden(set, '[KLANT_ADRES]')).toEqual(['Dorpsstraat 12', 'Dorpsstraat']);
    expect(waarden(set, '[WERK_PLAATS]')).toEqual([]);
    expect(waarden(set, '[VERWIJDERD]')).toEqual([]);
  });

  it('telefoon: zoals ingevuld en als cijferreeks, alleen bij ≥ 8 cijfers', () => {
    const set = bouwPiiSet(maakKlant({ telefoon: '+31 6 12345678' }));
    expect(set.filter((p) => p.plaatshouder === '[VERWIJDERD]')).toEqual([
      { waarde: '+31 6 12345678', plaatshouder: '[VERWIJDERD]', hoofdlettergevoelig: false, soort: 'tekst' },
      { waarde: '0612345678', plaatshouder: '[VERWIJDERD]', hoofdlettergevoelig: false, soort: 'telefoon' },
    ]);
    expect(bouwPiiSet(maakKlant({ telefoon: '1234567' }))).toEqual([]);
    expect(bouwPiiSet(maakKlant({ telefoon: 'geen' }))).toEqual([]);
  });

  it('e-mail: volledig en het deel vóór de @ als dat ≥ 4 tekens is', () => {
    expect(waarden(bouwPiiSet(maakKlant({ email: 'jansen@mail.nl' })), '[VERWIJDERD]')).toEqual([
      'jansen@mail.nl',
      'jansen',
    ]);
    expect(waarden(bouwPiiSet(maakKlant({ email: 'pj@mail.nl' })), '[VERWIJDERD]')).toEqual(['pj@mail.nl']);
    expect(waarden(bouwPiiSet(maakKlant({ email: 'abc' })), '[VERWIJDERD]')).toEqual([]);
  });

  it('dezelfde waarde één keer (de eerste plaatshouder wint)', () => {
    const set = bouwPiiSet(maakKlant({ naam: 'Jansen', email: 'jansen@mail.nl' }));
    expect(set.filter((p) => p.waarde.toLowerCase() === 'jansen')).toHaveLength(1);
    expect(set.find((p) => p.waarde === 'Jansen')?.plaatshouder).toBe('[KLANT_NAAM]');
  });

  it('lege klant geeft een lege set; gesorteerd op lengte aflopend', () => {
    expect(bouwPiiSet(maakKlant())).toEqual([]);
    const set = bouwPiiSet(
      maakKlant({
        naam: 'Piet Jansen',
        adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '', plaats: 'Son' },
      }),
    );
    const lengtes = set.map((p) => p.waarde.length);
    expect(lengtes).toEqual([...lengtes].sort((a, b) => b - a));
  });
});

describe('telefoonCijfers', () => {
  it('normaliseert +31 en 0031 naar 0', () => {
    expect(telefoonCijfers('06-12345678')).toBe('0612345678');
    expect(telefoonCijfers('+31 (0)6 1234 5678')).toBe('00612345678');
    expect(telefoonCijfers('+31 6 12345678')).toBe('0612345678');
    expect(telefoonCijfers('0031 6 12345678')).toBe('0612345678');
  });
});

describe('zoekpatroon', () => {
  const tekst = (waarde: string, hoofdlettergevoelig = false): PiiWaarde => ({
    waarde,
    plaatshouder: '[KLANT_NAAM]',
    hoofdlettergevoelig,
    soort: 'tekst',
  });

  it('heel woord, witruimte flexibel, regextekens letterlijk', () => {
    expect(zoekpatroon(tekst('Jansen'), false).test('bel jansen.')).toBe(true);
    expect(zoekpatroon(tekst('Jansen'), false).test('Jansens')).toBe(false);
    expect(zoekpatroon(tekst('Den Bosch'), false).test('in Den \n Bosch')).toBe(true);
    expect(zoekpatroon(tekst('B.V. (x)'), false).test('Aab B.V. (x) z')).toBe(true);
    expect(zoekpatroon(tekst('B.V.'), false).test('BxVx')).toBe(false);
  });

  it('hoofdlettergevoelig alleen als dat is aangegeven', () => {
    expect(zoekpatroon(tekst('Best', true), false).test('het best')).toBe(false);
    expect(zoekpatroon(tekst('Best', true), false).test('in Best')).toBe(true);
  });

  it('telefoon: cijfers met scheidingstekens, 0 ook als +31/0031', () => {
    const tel: PiiWaarde = {
      waarde: '0401234567',
      plaatshouder: '[VERWIJDERD]',
      hoofdlettergevoelig: false,
      soort: 'telefoon',
    };
    for (const t of ['040-1234567', '(040) 123 45 67', '+31 40 1234567', '0031401234567', '040.123.45.67']) {
      expect(zoekpatroon(tel, false).test(t), t).toBe(true);
    }
    expect(zoekpatroon(tel, false).test('10401234567')).toBe(false);
    expect(zoekpatroon(tel, false).test('04012345678')).toBe(false);
    const zonderNul: PiiWaarde = { ...tel, waarde: '3212345678' };
    expect(zoekpatroon(zonderNul, false).test('32 1234 5678')).toBe(true);
  });

  it('OFM-030: genormaliseerd nummer (E.164) herkend in beide schrijfwijzen', () => {
    const [nl] = bouwPiiSet(maakKlant({ telefoon: '+31612345678' })).filter((p) => p.soort === 'telefoon');
    expect(nl?.waarde).toBe('0612345678');
    for (const t of ['+31612345678', '+31 6 12345678', '06-12345678', '06 1234 5678', '0031612345678']) {
      expect(zoekpatroon(nl!, false).test(`bel ${t} gerust`), t).toBe(true);
    }
    const [be] = bouwPiiSet(maakKlant({ telefoon: '+32470123456' })).filter((p) => p.soort === 'telefoon');
    for (const t of ['+32470123456', '+32 470 12 34 56', '0032 470 123456', '32470123456']) {
      expect(zoekpatroon(be!, false).test(`bel ${t} gerust`), t).toBe(true);
    }
    expect(zoekpatroon(be!, false).test('132470123456')).toBe(false);
  });
});
