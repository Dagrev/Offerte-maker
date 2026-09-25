import { describe, expect, it } from 'vitest';
import { standaardInstelling } from '@shared/schemas';
import type { Bedrijf } from '@shared/types';
import { AANHEF_WOORDEN, STRAAT_HUISNUMMER, redigeerVoorbeeld } from './voorbeeldRedactie';

const leegBedrijf: Bedrijf = standaardInstelling('bedrijf');

const bedrijf: Bedrijf = {
  ...leegBedrijf,
  naam: 'Dakdekkersbedrijf Voorbeeld',
  contactpersoon: 'Kees Dekker',
  adres: 'Industrieweg 10',
  postcode: '5555 AA',
  plaats: 'Eindhoven',
  telefoon: '040-7654321',
  email: 'info@voorbeelddak.nl',
  website: 'www.voorbeelddak.nl',
  kvk: '12345678',
  btwNummer: 'NL001234567B01',
  iban: 'NL12ABCD0123456789',
};

/** Vulregels zodat een regel buiten het adresblok (eerste 15 niet-lege regels) valt. */
const vulling = Array.from({ length: 15 }, (_, i) => `Algemene regel ${i + 1}`).join('\n');
const naAdresblok = (tekst: string) => `${vulling}\n${tekst}`;
const zonderVulling = (tekst: string) => tekst.slice(vulling.length + 1);

describe('redigeerVoorbeeld (§11.5)', () => {
  it('regexen staan letterlijk zoals in het ontwerp', () => {
    expect(STRAAT_HUISNUMMER.source).toBe(
      "\\b\\p{Lu}[\\p{L}'.-]*(?:straat|laan|weg|plein|singel|gracht|dijk|kade|hof|park|pad|dreef|steeg|markt|ring|baan|veld|berg|wal|erf|akker|donk|hoek|voort)\\s+\\d+\\s?[a-zA-Z]?(?:[-/]\\d+)?\\b",
    );
    expect(STRAAT_HUISNUMMER.flags).toBe('gu');
    expect(AANHEF_WOORDEN.source).toBe(
      '(Dhr\\.?|Mevr\\.?|Mw\\.?|Fam\\.?|Familie|De heer|Mevrouw|T\\.a\\.v\\.?|Geachte(?: heer| mevrouw| familie)?|Beste)',
    );
  });

  it('FE-081: tien persoonsgegevens van een oude klant weg, eigen bedrijf wordt [BEDRIJF]', () => {
    const tekst = [
      'Dakdekkersbedrijf Voorbeeld',
      'Industrieweg 10',
      '5555 AA Eindhoven',
      'IBAN NL12 ABCD 0123 4567 89',
      '',
      'Aan:',
      'P. Bakker',
      'Kerkstraat 5',
      '1234 AB Utrecht',
      '',
      'Offerte 2023-014',
      ...vulling.split('\n'),
      'Geachte heer Bakker,',
      'Wij vervangen de dakbedekking van uw woning.',
      'Neem contact op via 06-98765432 of p.bakker@example.nl.',
      'Aanbetaling graag vanaf uw rekening NL02RABO0123456789.',
      'Werkadres: Molenweg 12a',
      'T.a.v. mevrouw Smit, afdeling inkoop',
      'Met vriendelijke groet,',
      'Dakdekkersbedrijf Voorbeeld',
    ].join('\n');
    const uit = redigeerVoorbeeld(tekst, bedrijf, []);

    const persoonsgegevens = [
      'P. Bakker', // naam in het adresblok
      'Kerkstraat 5', // straat + huisnummer
      '1234 AB', // postcode
      'Utrecht', // plaats in het adresblok
      'Bakker', // naam na Geachte
      '06-98765432', // telefoon
      'p.bakker@example.nl', // e-mail
      'NL02RABO0123456789', // IBAN klant
      'Molenweg 12a', // straat van het werkadres
      'Smit', // naam na T.a.v.
    ];
    expect(persoonsgegevens).toHaveLength(10);
    for (const p of persoonsgegevens) expect(uit, p).not.toContain(p);

    expect(uit).not.toContain('Dakdekkersbedrijf Voorbeeld');
    expect(uit).not.toMatch(/NL12|ABCD/);
    expect(uit.split('\n').slice(0, 4)).toEqual([
      '[BEDRIJF]',
      '[BEDRIJF]',
      '[BEDRIJF] [BEDRIJF]',
      'IBAN [BEDRIJF]',
    ]);
    expect(uit).toContain('Geachte heer [VERWIJDERD],');
    expect(uit).toContain('T.a.v. [VERWIJDERD], afdeling inkoop');
    expect(uit).toContain('Wij vervangen de dakbedekking van uw woning.');
    expect(uit.endsWith('Met vriendelijke groet,\n[BEDRIJF]')).toBe(true);
  });

  describe('stap 1: eigen bedrijfsgegevens', () => {
    it('alle niet-lege velden van ≥ 3 tekens, hoofdletterongevoelig, heel woord', () => {
      const uit = redigeerVoorbeeld(
        'kees dekker van DAKDEKKERSBEDRIJF VOORBEELD, www.voorbeelddak.nl; Eindhovense wijk; Kees',
        bedrijf,
        [],
      );
      expect(uit).toBe('[BEDRIJF] van [BEDRIJF], [BEDRIJF]; Eindhovense wijk; Kees');
    });

    it('korte en lege velden doen niet mee', () => {
      const kort = { ...leegBedrijf, naam: 'AB', plaats: '' };
      expect(redigeerVoorbeeld('AB en plaats', kort, [])).toBe('AB en plaats');
    });

    it('eigen e-mail en telefoon worden [BEDRIJF], niet [VERWIJDERD]', () => {
      const uit = redigeerVoorbeeld(
        naAdresblok('Mail INFO@voorbeelddak.nl of bel 040 765 43 21 / +31 40 7654321'),
        bedrijf,
        [],
      );
      expect(zonderVulling(uit)).toBe('Mail [BEDRIJF] of bel [BEDRIJF] / [BEDRIJF]');
    });

    it('V-16: IBAN genormaliseerd vergeleken, in beide richtingen', () => {
      expect(
        zonderVulling(redigeerVoorbeeld(naAdresblok('Rekening NL12 ABCD 0123 4567 89.'), bedrijf, [])),
      ).toBe('Rekening [BEDRIJF].');
      const metSpaties = { ...bedrijf, iban: 'NL12 ABCD 0123 4567 89' };
      expect(
        zonderVulling(redigeerVoorbeeld(naAdresblok('Rekening nl12abcd0123456789.'), metSpaties, [])),
      ).toBe('Rekening [BEDRIJF].');
    });

    it('eigen nummer binnen een langer telefoonnummer of e-mailadres van iemand anders: geen [BEDRIJF]', () => {
      const uit = redigeerVoorbeeld(naAdresblok('Klant: 06-12345678, 12345678@mail.nl'), bedrijf, []);
      expect(zonderVulling(uit)).toBe('Klant: [VERWIJDERD], [VERWIJDERD]');
    });

    it('V-16: KvK, btw-nummer en postcode genormaliseerd', () => {
      const uit = redigeerVoorbeeld(naAdresblok('KvK 1234 5678, btw NL0012.34.567.B01, 5555aa'), bedrijf, []);
      expect(zonderVulling(uit)).toBe('KvK [BEDRIJF], btw [BEDRIJF], [BEDRIJF]');
    });
  });

  describe('stap 2 en 3: generieke patronen, postcode en straat', () => {
    it('e-mail, IBAN, telefoon, postcode en straat + huisnummer → [VERWIJDERD]', () => {
      const uit = redigeerVoorbeeld(
        naAdresblok('a@b.nl NL02RABO0123456789 0612345678 1234 AB 1234ab Lindelaan 12-2 en Stationsplein 3b'),
        leegBedrijf,
        [],
      );
      expect(zonderVulling(uit)).toBe(
        '[VERWIJDERD] [VERWIJDERD] [VERWIJDERD] [VERWIJDERD] [VERWIJDERD] [VERWIJDERD] en [VERWIJDERD]',
      );
    });

    it('een straatnaam zonder huisnummer of zonder hoofdletter blijft staan', () => {
      const uit = redigeerVoorbeeld(naAdresblok('De Kerkstraat is smal; kerkstraat 5 ook'), leegBedrijf, []);
      expect(zonderVulling(uit)).toBe('De Kerkstraat is smal; kerkstraat 5 ook');
    });
  });

  describe('stap 4: namen na een aanhefwoord', () => {
    const geval = (tekst: string) => zonderVulling(redigeerVoorbeeld(naAdresblok(tekst), leegBedrijf, []));

    it('voorvoegsel blijft staan, naam tot komma of einde regel', () => {
      expect(geval('Geachte heer Jansen,')).toBe('Geachte heer [VERWIJDERD],');
      expect(geval('Geachte mevrouw De Vries,')).toBe('Geachte mevrouw [VERWIJDERD],');
      expect(geval('Geachte familie Bakker,')).toBe('Geachte familie [VERWIJDERD],');
      expect(geval('Dhr. P. Jansen')).toBe('Dhr. [VERWIJDERD]');
      expect(geval('mevr. Smit, Veldhoven')).toBe('mevr. [VERWIJDERD], Veldhoven');
      expect(geval('Mw. Smit')).toBe('Mw. [VERWIJDERD]');
      expect(geval('Fam. Visser\nvolgende regel')).toBe('Fam. [VERWIJDERD]\nvolgende regel');
      expect(geval('Familie Visser')).toBe('Familie [VERWIJDERD]');
      expect(geval('De heer Pietersen.')).toBe('De heer [VERWIJDERD].');
      expect(geval('Mevrouw Kok')).toBe('Mevrouw [VERWIJDERD]');
      expect(geval('T.a.v. dhr. Hendriks')).toBe('T.a.v. [VERWIJDERD]');
      expect(geval('Beste Anna,')).toBe('Beste [VERWIJDERD],');
    });

    it('zonder naam erachter verandert er niets', () => {
      expect(geval('Geachte heer, mevrouw,')).toBe('Geachte heer, mevrouw,');
      expect(geval('Dhr. [BEDRIJF]')).toBe('Dhr. [BEDRIJF]');
    });

    it('alleen als los woord', () => {
      expect(geval('Het bestek en de familiedag')).toBe('Het bestek en de familiedag');
    });
  });

  describe('stap 5: adresblok', () => {
    it('regel met [VERWIJDERD] en de regel erboven (≤ 5 woorden, geen cijfers, geen :)', () => {
      const uit = redigeerVoorbeeld(
        'Aan de bewoners van\nKerkstraat 5\n1234 AB Utrecht\nTekst',
        leegBedrijf,
        [],
      );
      expect(uit).toBe('[VERWIJDERD]\n[VERWIJDERD]\n[VERWIJDERD]\nTekst');
    });

    it('regel erboven met cijfers, dubbele punt of meer dan 5 woorden blijft staan', () => {
      expect(redigeerVoorbeeld('Offerte 2023-014\nKerkstraat 5', leegBedrijf, [])).toBe(
        'Offerte 2023-014\n[VERWIJDERD]',
      );
      expect(redigeerVoorbeeld('Aan:\nKerkstraat 5', leegBedrijf, [])).toBe('Aan:\n[VERWIJDERD]');
      expect(redigeerVoorbeeld('dit zijn zes woorden op rij\nKerkstraat 5', leegBedrijf, [])).toBe(
        'dit zijn zes woorden op rij\n[VERWIJDERD]',
      );
      expect(redigeerVoorbeeld('\nKerkstraat 5', leegBedrijf, [])).toBe('\n[VERWIJDERD]');
    });

    it('alleen in de eerste 15 niet-lege regels', () => {
      const tekst = `${vulling.replace(/\n/g, '\n\n')}\nP. Bakker\nKerkstraat 5`;
      expect(redigeerVoorbeeld(tekst, leegBedrijf, []).endsWith('\nP. Bakker\n[VERWIJDERD]')).toBe(true);
      const binnen = 'Regel\n'.repeat(12) + 'P. Bakker\nKerkstraat 5';
      expect(redigeerVoorbeeld(binnen, leegBedrijf, []).endsWith('\n[VERWIJDERD]\n[VERWIJDERD]')).toBe(true);
    });
  });

  describe('stap 6: handmatige redacties', () => {
    it('letterlijk, overal, hoofdletterongevoelig; lege redacties doen niets', () => {
      const uit = redigeerVoorbeeld(naAdresblok('Villa Zonnehoek (zonnehoek) bij de molen'), leegBedrijf, [
        'Zonnehoek',
        'de molen',
        '',
        '  ',
      ]);
      expect(zonderVulling(uit)).toBe('Villa [VERWIJDERD] ([VERWIJDERD]) bij [VERWIJDERD]');
    });

    it('regextekens worden letterlijk genomen', () => {
      expect(zonderVulling(redigeerVoorbeeld(naAdresblok('a.b (x) a+b'), leegBedrijf, ['(x)', 'a.b']))).toBe(
        '[VERWIJDERD] [VERWIJDERD] a+b',
      );
    });
  });

  it('herhaalbaar: zelfde bron geeft zelfde resultaat; een nieuwe redactie werkt door vanaf de bron', () => {
    const bron = naAdresblok('Villa Zonnehoek aan het water, bel 06-12345678');
    const eerste = redigeerVoorbeeld(bron, bedrijf, []);
    expect(redigeerVoorbeeld(bron, bedrijf, [])).toBe(eerste);
    const tweede = redigeerVoorbeeld(bron, bedrijf, ['Zonnehoek']);
    expect(zonderVulling(tweede)).toBe('Villa [VERWIJDERD] aan het water, bel [VERWIJDERD]');
    expect(redigeerVoorbeeld(bron, bedrijf, ['Zonnehoek'])).toBe(tweede);
  });
});
