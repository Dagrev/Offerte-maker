import { describe, expect, it } from 'vitest';
import { maakKlant } from '../../../test/privacy/testset';
import { anonimiseer } from './anonimiseer';
import { EMAIL, IBAN, POSTCODE, POSTCODE_KLEIN, TELEFOON_NL, vervangGeneriekePatronen } from './patronen';
import { bouwPiiSet } from './piiSet';

describe('patronen (§11.2 letterlijk)', () => {
  it('staan er zoals in het ontwerp', () => {
    expect(EMAIL.source).toBe('[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}.-]+\\.\\p{L}{2,}');
    expect(EMAIL.flags).toBe('gu');
    expect(IBAN.source).toBe('\\b[A-Z]{2}\\d{2}(?:\\s?[A-Z0-9]{4}){2,7}(?:\\s?[A-Z0-9]{1,3})?\\b');
    expect(IBAN.flags).toBe('gi');
    // Bewuste afwijking van §11.2: komma/punt alleen als grens naast een cijfer (zie patronen.ts).
    expect(TELEFOON_NL.source).toBe('(?<!\\d|\\d[,.])(?:\\+31|0031|0)(?:[\\s-]?\\d){9}(?!\\d|[,.]\\d)');
    expect(POSTCODE.source).toBe('\\b[1-9]\\d{3}\\s?[A-Z]{2}\\b');
    expect(POSTCODE_KLEIN.source).toBe('\\b[1-9]\\d{3}[a-z]{2}\\b');
  });

  it('generieke patronen vervangen e-mail, IBAN en telefoon', () => {
    expect(vervangGeneriekePatronen('a@b.nl NL91ABNA0417164300 06-12345678 040 1234567')).toBe(
      '[VERWIJDERD] [VERWIJDERD] [VERWIJDERD] [VERWIJDERD]',
    );
    // Ook met een komma of punt erachter (zinsbouw).
    expect(vervangGeneriekePatronen('Bel 0612345678. Of 06-12345678, of (040 1234567)')).toBe(
      'Bel [VERWIJDERD]. Of [VERWIJDERD], of ([VERWIJDERD])',
    );
    // Bedragen en getallen met komma of punt blijven staan.
    expect(vervangGeneriekePatronen('Totaal 0,123456789 en 1.061234567')).toBe(
      'Totaal 0,123456789 en 1.061234567',
    );
  });
});

describe('anonimiseer', () => {
  it('FE-032 letterlijk', () => {
    const klant = maakKlant({
      naam: 'Jansen',
      adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '', plaats: '' },
    });
    expect(
      anonimiseer('Bel Jansen op 06-12345678 of jansen@mail.nl, Dorpsstraat 12 5501 AB', bouwPiiSet(klant)),
    ).toBe('Bel [KLANT_NAAM] op [VERWIJDERD] of [VERWIJDERD], [KLANT_ADRES] [VERWIJDERD]');
  });

  it('e-mail verdwijnt als geheel, niet als [KLANT_NAAM]@mail.nl', () => {
    const set = bouwPiiSet(maakKlant({ naam: 'Jansen' }));
    expect(anonimiseer('mail jansen@mail.nl', set)).toBe('mail [VERWIJDERD]');
  });

  it('plaats Best vervangt "Best" maar niet "best" (A-12)', () => {
    const set = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: '', postcode: '', plaats: 'Best' } }));
    expect(anonimiseer('Het best is om in Best te beginnen', set)).toBe(
      'Het best is om in [KLANT_PLAATS] te beginnen',
    );
  });

  it('klantpostcode wordt [KLANT_POSTCODE], een andere postcode [VERWIJDERD] (V-02)', () => {
    const set = bouwPiiSet(maakKlant({ adres: { straatHuisnummer: '', postcode: '5611 AB', plaats: '' } }));
    expect(anonimiseer('5611 AB, 5611ab, 5611AB en 1234 XY, 1234xy', set)).toBe(
      '[KLANT_POSTCODE], [KLANT_POSTCODE], [KLANT_POSTCODE] en [VERWIJDERD], [VERWIJDERD]',
    );
  });

  it('telefoonreeksen met dezelfde cijfers, ook met +31', () => {
    const set = bouwPiiSet(maakKlant({ telefoon: '040-1234567' }));
    expect(anonimiseer('Bel (040) 123 45 67 of +31 40 123 45 67.', set)).toBe(
      'Bel [VERWIJDERD] of [VERWIJDERD].',
    );
  });

  it('langste waarde eerst', () => {
    const set = bouwPiiSet(
      maakKlant({ adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '', plaats: '' } }),
    );
    expect(anonimiseer('Dorpsstraat 12 en de Dorpsstraat', set)).toBe('[KLANT_ADRES] en de [KLANT_ADRES]');
  });

  it('bestaande en net ingezette plaatshouders blijven heel, ook bij een naam als "Klant"', () => {
    const set = bouwPiiSet(maakKlant({ naam: 'Klant Naam', bedrijfsnaam: 'Werk Plaats' }));
    expect(anonimiseer('[KLANT_NAAM] en [WERK_PLAATS]: Klant Naam', set)).toBe(
      '[KLANT_NAAM] en [WERK_PLAATS]: [KLANT_NAAM]',
    );
  });

  it('veel vervangingen (meer dan 256 tokens) blijven correct', () => {
    const set = bouwPiiSet(maakKlant({ naam: 'Jansen' }));
    const tekst = Array.from({ length: 300 }, () => 'Jansen').join(' ');
    expect(anonimiseer(tekst, set)).toBe(Array.from({ length: 300 }, () => '[KLANT_NAAM]').join(' '));
  });

  it('lege tekst en lege set', () => {
    expect(anonimiseer('', [])).toBe('');
    expect(anonimiseer('niets bijzonders', [])).toBe('niets bijzonders');
  });
});
