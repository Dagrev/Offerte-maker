import { describe, expect, it } from 'vitest';
import { STANDAARD_EMAILTEKST, standaardInstelling } from '@shared/schemas';
import { achternaamVan, mailAanhef, maakMailConcept, vulPlaatshouders } from './concept';

const bron = {
  klant: { aanhef: 'dhr' as const, voornaam: 'Jan', achternaam: 'Jansen', email: ' jan@voorbeeld.nl ' },
  nummer: '2026-09-26-001b',
  geldigTot: '2026-10-26',
  bedrijfsnaam: 'Dakwerken Test ',
  emailTekst: STANDAARD_EMAILTEKST,
};

describe('mailconcept (OFM-041)', () => {
  it('startwaarde van de e-mailtekst zit in de standaardteksten', () => {
    expect(standaardInstelling('teksten').emailTekst).toBe(STANDAARD_EMAILTEKST);
    expect(STANDAARD_EMAILTEKST).toContain('{aanhef}');
    expect(STANDAARD_EMAILTEKST).toContain('{nummer}');
  });

  it('vult aan, onderwerp en tekst met CRLF-regels', () => {
    const c = maakMailConcept(bron);
    expect(c.aan).toBe('jan@voorbeeld.nl');
    expect(c.onderwerp).toBe('Offerte 2026-09-26-001b van Dakwerken Test');
    expect(
      c.tekst.startsWith('Geachte heer Jansen,\r\n\r\nHierbij ontvangt u onze offerte 2026-09-26-001b.'),
    ).toBe(true);
    expect(c.tekst).toContain('geldig tot 26 oktober 2026.');
    expect(c.tekst.endsWith('Met vriendelijke groet,\r\n\r\nDakwerken Test')).toBe(true);
    expect(c.tekst).not.toMatch(/[^\r]\n/);
  });

  it('zonder bedrijfsnaam alleen "Offerte <nummer>"; zonder e-mail een lege ontvanger', () => {
    const c = maakMailConcept({ ...bron, bedrijfsnaam: '  ', klant: { ...bron.klant, email: '' } });
    expect(c.onderwerp).toBe('Offerte 2026-09-26-001b');
    expect(c.aan).toBe('');
  });

  it('alle plaatshouders, onbekende blijven staan', () => {
    const tekst = '{aanhef}|{achternaam}|{nummer}|{bedrijfsnaam}|{geldigTot}|{onbekend}|{ nummer }';
    expect(
      vulPlaatshouders(tekst, {
        aanhef: 'A',
        achternaam: 'B',
        nummer: 'C',
        bedrijfsnaam: 'D',
        geldigTot: 'E',
      }),
    ).toBe('A|B|C|D|E|{onbekend}|{ nummer }');
    expect(maakMailConcept({ ...bron, emailTekst: 'Beste {achternaam}' }).tekst).toBe('Beste Jansen');
  });

  it('aanhef volgt de PDF; zonder naam de neutrale vorm', () => {
    expect(mailAanhef({ aanhef: 'mevr', voornaam: 'Anna', achternaam: ' de Vries ' })).toBe(
      'Geachte mevrouw de Vries,',
    );
    expect(mailAanhef({ aanhef: 'fam', voornaam: '', achternaam: 'Bakker' })).toBe('Geachte familie Bakker,');
    expect(mailAanhef({ aanhef: 'bedrijf', voornaam: 'Jan', achternaam: 'Jansen' })).toBe(
      'Geachte heer, mevrouw,',
    );
    expect(mailAanhef({ aanhef: 'dhr', voornaam: '', achternaam: '  ' })).toBe('Geachte heer, mevrouw,');
    // OFM-038: zonder achternaam de voornaam, zoals op de PDF.
    expect(mailAanhef({ aanhef: 'dhr', voornaam: 'Jan', achternaam: '' })).toBe('Geachte heer Jan,');
    expect(achternaamVan({ achternaam: ' Jansen ' })).toBe('Jansen');
  });
});
