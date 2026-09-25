import { describe, expect, it } from 'vitest';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';
import { anonimiseer } from './anonimiseer';
import { controleer } from './controle';
import { bouwKlusVoorAgent, gebruikersTekst } from './klusVoorAgent';
import { bouwPiiSet } from './piiSet';

const klant = maakKlant({
  naam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Best' },
  telefoon: '06-12345678',
  email: 'jansen@mail.nl',
});
const set = bouwPiiSet(klant);

describe('controleer (§11.3)', () => {
  it('slaagt op gefilterde tekst', () => {
    const payload = anonimiseer('Bel Jansen op 06 1234 5678, Dorpsstraat 12 in Best', set);
    expect(controleer(payload, set)).toEqual({ ok: true });
  });

  it('blokkeert bij één treffer en noemt wat er gevonden is', () => {
    expect(controleer('Graag voor jansen', set)).toEqual({ ok: false, gevonden: ['Jansen'] });
    expect(controleer('bel +31 6 1234 5678', set)).toEqual({ ok: false, gevonden: ['0612345678'] });
    const r = controleer('Dorpsstraat 12 in Best', set);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.gevonden).toEqual(['Dorpsstraat 12', 'Dorpsstraat', 'Best']);
  });

  it('zelfde woordgrens- en hoofdletterregels als het filter', () => {
    expect(controleer('het best denkbare dak', set)).toEqual({ ok: true });
    expect(controleer('Jansens', set)).toEqual({ ok: true });
  });

  it('waarden korter dan 3 tekens worden niet gecontroleerd', () => {
    const kort = bouwPiiSet(maakKlant({ naam: 'Li' }));
    expect(controleer('Li belt', kort)).toEqual({ ok: true });
  });

  it('plaatshouders zelf blokkeren niet, ook niet bij een naam als "Klant"', () => {
    const vreemd = bouwPiiSet(maakKlant({ naam: 'Klant' }));
    expect(controleer('[KLANT_NAAM] wil EPDM', vreemd)).toEqual({ ok: true });
  });

  it('achternaam Staal met ondergrond staal wordt niet geblokkeerd (vaste tekst telt niet)', () => {
    const staal = maakKlant({ naam: 'Piet Staal' });
    const klus = bouwKlusVoorAgent({
      invoer: maakInvoer({ ondergrond: 'staal', overig: 'Graag voor de winter' }),
      klant: staal,
      offertedatum: '2026-09-25',
    });
    expect(klus.ondergrond).toBe('Staal');
    expect(controleer(gebruikersTekst(klus).join('\n'), bouwPiiSet(staal))).toEqual({ ok: true });
  });

  it('FE-033: ongefilterde payload met een klantgegeven blokkeert, los van het filter', () => {
    const klus = bouwKlusVoorAgent(
      { invoer: maakInvoer({ overig: 'Bel Jansen' }), klant, offertedatum: '2026-09-25' },
      { filteren: false },
    );
    expect(klus.overig).toBe('Bel Jansen');
    expect(controleer(gebruikersTekst(klus).join('\n'), set).ok).toBe(false);
  });
});
