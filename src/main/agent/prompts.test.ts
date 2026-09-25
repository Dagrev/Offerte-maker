import { describe, expect, it } from 'vitest';
import type { Prijspost } from '@shared/types';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';
import { bouwKlusVoorAgent } from '../privacy/klusVoorAgent';
import {
  bouwOpdrachtMaken,
  bouwSysteemprompt,
  prijslijstVoorAgent,
  SYSTEEMPROMPT_SJABLOON,
  verstuurdeTekst,
  voorbeeldenSectie,
} from './prompts';

const posten: Prijspost[] = [
  {
    id: 'start-epdm_11',
    sleutel: 'epdm_11',
    omschrijving: 'EPDM 1,1 mm',
    eenheid: 'm²',
    prijsCent: 5500,
    btwTarief: 21,
    volgorde: 10,
  },
  {
    id: 'eigen',
    sleutel: null,
    omschrijving: 'Sedum',
    eenheid: 'm²',
    prijsCent: null,
    btwTarief: 9,
    volgorde: 20,
  },
];

describe('systeemprompt (§10.5)', () => {
  it('bevat de vaste bullets letterlijk', () => {
    const p = bouwSysteemprompt({ template: false });
    expect(p.startsWith('Je bent de offerteschrijver van een klein Nederlands dakdekkersbedrijf.')).toBe(
      true,
    );
    expect(p).toContain(
      '- Bij een aanpassing: regels met prijsbron "handmatig" heeft de dakdekker zelf geprijsd. Laat hun prijs ongewijzigd en geef ze hun ref terug. Geef elke regel die uit de huidige offerte komt zijn ref; nieuwe regels krijgen ref null.',
    );
    expect(p).toContain('zet ze niet in controlepunten.)');
    expect(p).toContain('[KLANT_ADRES], [KLANT_POSTCODE], [KLANT_PLAATS], [WERK_ADRES], [WERK_PLAATS]');
    expect(p.endsWith('- controlepunten: maximaal 10 korte punten die de dakdekker moet nakijken.')).toBe(
      true,
    );
  });

  it('template-delen alleen met een template', () => {
    const zonder = bouwSysteemprompt({ template: false });
    const met = bouwSysteemprompt({ template: true });
    expect(zonder).not.toMatch(/template|\{\{/);
    expect(zonder).toContain('in de stijl van de voorbeeldoffertes.');
    expect(zonder).toContain('voorbeeldoffertes in voorbeelden/. Lees die');
    expect(met).toContain('in de stijl van de voorbeeldoffertes en volgens de indeling van het template.');
    expect(met).toContain('voorbeeldoffertes in voorbeelden/ en het template in template.md. Lees die');
    expect(met).not.toContain('{{');
    expect(SYSTEEMPROMPT_SJABLOON.match(/\{\{#template\}\}/g)).toHaveLength(2);
  });
});

describe('opdracht bij maken (§10.5)', () => {
  const klus = bouwKlusVoorAgent({
    invoer: maakInvoer({ overig: 'Bel Jansen' }),
    klant: maakKlant({ naam: 'Jansen' }),
    offertedatum: '2026-09-25',
  });

  it('secties Klusgegevens, Prijslijst, Standaardteksten en Voorbeelden', () => {
    const opdracht = bouwOpdrachtMaken({
      klus,
      prijslijst: posten,
      teksten: { inleiding: 'In.', afsluiting: 'Uit.' },
      aantalVoorbeelden: 3,
      template: false,
    });
    expect(opdracht).toBe(
      [
        '# Opdracht: schrijf een offerte',
        '',
        '## Klusgegevens',
        '```json',
        JSON.stringify(klus, null, 2),
        '```',
        '',
        '## Prijslijst',
        '```json',
        JSON.stringify(prijslijstVoorAgent(posten), null, 2),
        '```',
        '',
        '## Standaardteksten',
        '```json',
        JSON.stringify({ inleiding: 'In.', afsluiting: 'Uit.' }, null, 2),
        '```',
        '',
        '## Voorbeelden',
        'Er zijn 3 goedgekeurde voorbeeldoffertes in voorbeelden/.',
      ].join('\n'),
    );
    expect(opdracht).toContain('"overig": "Bel [KLANT_NAAM]"');
    expect(opdracht).not.toContain('Jansen');
  });

  it('prijsEuro = prijs_cent / 100 of null', () => {
    expect(prijslijstVoorAgent(posten)).toEqual([
      { id: 'start-epdm_11', omschrijving: 'EPDM 1,1 mm', eenheid: 'm²', prijsEuro: 55, btwTarief: 21 },
      { id: 'eigen', omschrijving: 'Sedum', eenheid: 'm²', prijsEuro: null, btwTarief: 9 },
    ]);
  });

  it('voorbeeldenzin bij n = 0 en met template', () => {
    expect(voorbeeldenSectie(0, false)).toBe(
      'Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl.',
    );
    expect(voorbeeldenSectie(2, true)).toBe(
      'Er zijn 2 goedgekeurde voorbeeldoffertes in voorbeelden/. Volg de indeling en toon van template.md.',
    );
    expect(voorbeeldenSectie(0, true)).toBe(
      'Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl. Volg de indeling en toon van template.md.',
    );
  });

  it('verstuurde tekst = systeemprompt + scheiding + opdracht', () => {
    expect(verstuurdeTekst('S', 'O')).toBe('S\n\n---\n\nO');
  });
});
