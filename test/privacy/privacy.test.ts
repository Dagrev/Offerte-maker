import { describe, expect, it } from 'vitest';
import { KEUZE_STARTSET } from '@shared/keuzelijsten';
import { PRIJS_STARTSET } from '@shared/prijsStartset';
import { standaardInstelling } from '@shared/schemas';
import type { Klant, OfferteInhoud, Prijspost } from '@shared/types';
import {
  bouwOpdrachtAanpassen,
  bouwOpdrachtMaken,
  bouwSysteemprompt,
  verstuurdeTekst,
} from '../../src/main/agent/prompts';
import { anonimiseer } from '../../src/main/privacy/anonimiseer';
import { controleer } from '../../src/main/privacy/controle';
import { invullen, tekstvelden, terugNaarPlaatshouders } from '../../src/main/privacy/invullen';
import { bouwKlusVoorAgent, gebruikersTekst } from '../../src/main/privacy/klusVoorAgent';
import { bouwPiiSet, telefoonCijfers } from '../../src/main/privacy/piiSet';
import { type Privacygeval, testset } from './testset';

// Privacytest (TDO §11.6, NFE-008, FE-031, V-02). Bouwt per geval de volledige verstuurde tekst
// (systeemprompt + opdracht `maken`) met dezelfde code als productie: `bouwKlusVoorAgent()` en
// `prompts.ts` (OFM-013). Bij een geval met een aanpassingsinstructie komen de gefilterde instructie
// en de echte opdracht `aanpassen` (OFM-017) erbij.

/** Prijslijst en standaardteksten zoals een nieuwe installatie ze heeft (vaste tekst). */
const prijslijst: Prijspost[] = PRIJS_STARTSET.map((p, i) => ({
  id: `start-${p.sleutel}`,
  sleutel: p.sleutel,
  omschrijving: p.omschrijving,
  eenheid: p.eenheid,
  prijsCent: i % 2 === 0 ? 1000 + i * 250 : null,
  btwTarief: p.btwTarief,
  volgorde: (i + 1) * 10,
}));
const teksten = standaardInstelling('teksten');

/** Inhoud met alle toegestane plaatshouders, voor de aanpassing en de roundtrip. */
const inhoudMetPlaatshouders: OfferteInhoud = {
  titel: 'Offerte [KLANT_NAAM]',
  inleiding:
    '[KLANT_AANHEF] [KLANT_NAAM],\nHierbij ontvangt u onze offerte voor [WERK_ADRES] te [WERK_PLAATS].',
  werkomschrijving: ['Oude bedekking verwijderen', 'Nieuwe EPDM aanbrengen voor [KLANT_BEDRIJF]'],
  regels: [
    {
      id: 'r1',
      omschrijving: 'EPDM 1,1 mm op [WERK_ADRES]',
      aantalHonderdsten: 3480,
      eenheid: 'm²',
      prijsCent: 5500,
      btwTarief: 21,
      prijsbron: 'prijslijst',
      prijspostId: null,
    },
  ],
  uitvoering: 'Planning in overleg; post naar [KLANT_ADRES], [KLANT_POSTCODE] [KLANT_PLAATS].',
  opmerkingen: '',
  afsluiting: 'Met vriendelijke groet',
  controlepunten: ['Controleer [VERWIJDERD] de maten', 'Kijk naar [BEDRIJF] voorwaarden'],
};

interface Opdracht {
  /** Wat de agent te zien krijgt: systeemprompt + opdracht (plus bij aanpassen inhoud en instructie). */
  tekst: string;
  /** Alleen de delen uit invoer van de gebruiker, voor de eindcontrole. */
  payload: string;
  json: string;
}

function bouwOpdracht(geval: Privacygeval): Opdracht {
  const klus = bouwKlusVoorAgent({
    invoer: geval.invoer,
    klant: geval.klant,
    offertedatum: '2026-09-25',
    keuzes: KEUZE_STARTSET,
  });
  const json = JSON.stringify(klus, null, 2);
  const delen = gebruikersTekst(klus);
  const opdracht = bouwOpdrachtMaken({
    klus,
    prijslijst,
    teksten: { inleiding: teksten.inleiding, afsluiting: teksten.afsluiting },
    aantalVoorbeelden: 3,
    template: true,
  });
  let tekst = verstuurdeTekst(bouwSysteemprompt({ template: true }), opdracht);
  expect(tekst).toContain(json);
  if (geval.instructie !== undefined) {
    // OFM-017: de echte opdracht `aanpassen`, gebouwd zoals `pasAanMetClaude` dat doet.
    const piiSet = bouwPiiSet(geval.klant);
    const huidig = terugNaarPlaatshouders(invullen(inhoudMetPlaatshouders, geval.klant), geval.klant);
    const instructie = anonimiseer(geval.instructie, piiSet);
    const aanpassen = bouwOpdrachtAanpassen({
      huidige: huidig,
      instructie,
      prijslijst,
      aantalVoorbeelden: 3,
      template: true,
    });
    expect(aanpassen).toContain(`## Wat moet er anders\n${instructie.trim()}`);
    tekst += `\n\n${verstuurdeTekst(bouwSysteemprompt({ template: true }), aanpassen)}`;
    delen.push(instructie, ...tekstvelden(huidig));
  }
  return { tekst, payload: delen.join('\n'), json };
}

const normaliseer = (t: string): string => t.replace(/\s+/g, ' ');
const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Heel woord, witruimte genormaliseerd; hoofdletterongevoelig tenzij `hoofdlettergevoelig`. */
function bevat(tekst: string, waarde: string, hoofdlettergevoelig: boolean): boolean {
  const kern = normaliseer(waarde.trim()).split(' ').map(escape).join('\\s+');
  const vlaggen = hoofdlettergevoelig ? 'u' : 'iu';
  return new RegExp(`(?<![\\p{L}\\p{N}])${kern}(?![\\p{L}\\p{N}])`, vlaggen).test(tekst);
}

function isPlaats(klant: Klant, waarde: string): boolean {
  return [klant.adres.plaats, klant.werkadres.plaats].some((p) => p !== '' && p === waarde);
}

/** Alle ingevulde klantgegevens (FE-031), met hun hoofdlettergevoeligheid. */
function ingevuldeWaarden(klant: Klant): { waarde: string; hoofdlettergevoelig: boolean }[] {
  const postcodes = [klant.adres.postcode, klant.werkadres.postcode].flatMap((p) => {
    const compact = p.replace(/\s+/g, '');
    return compact === '' ? [] : [compact, `${compact.slice(0, 4)} ${compact.slice(4)}`];
  });
  const ci = [
    klant.voornaam,
    klant.achternaam,
    `${klant.voornaam} ${klant.achternaam}`.trim(),
    klant.bedrijfsnaam,
    klant.adres.straatHuisnummer,
    klant.werkadres.straatHuisnummer,
    klant.email,
    ...postcodes,
  ];
  const cs = [klant.adres.plaats, klant.werkadres.plaats];
  return [
    ...ci.map((waarde) => ({ waarde, hoofdlettergevoelig: false })),
    ...cs.map((waarde) => ({ waarde, hoofdlettergevoelig: true })),
  ].filter((w) => w.waarde.trim().length >= 2);
}

/** Cijferreeksen in de tekst, genormaliseerd zoals telefoonnummers. */
function bevatTelefoon(tekst: string, telefoon: string): boolean {
  const cijfers = telefoonCijfers(telefoon);
  if (cijfers.length < 8) return false;
  const reeksen = tekst.match(/[\d\s\-()+]{8,}/g) ?? [];
  return reeksen.some((r) => telefoonCijfers(r).includes(cijfers.slice(1)));
}

describe('privacytestset (NFE-008)', () => {
  it('bevat minstens 50 gevallen', () => {
    expect(testset.length).toBeGreaterThanOrEqual(50);
  });

  describe.each(testset.map((g) => [g.omschrijving, g] as const))('%s', (_, geval) => {
    const opdracht = bouwOpdracht(geval);

    it('niets uit nietInOpdracht staat in de opdracht', () => {
      for (const waarde of geval.verwacht.nietInOpdracht) {
        const cs = isPlaats(geval.klant, waarde);
        expect(bevat(opdracht.tekst, waarde, cs), `"${waarde}" staat in de opdracht`).toBe(false);
      }
    });

    it('welInOpdracht staat er wel in', () => {
      for (const waarde of geval.verwacht.welInOpdracht ?? []) {
        expect(normaliseer(opdracht.tekst)).toContain(normaliseer(waarde));
      }
    });

    it('de eindcontrole slaagt', () => {
      expect(controleer(opdracht.payload, bouwPiiSet(geval.klant))).toEqual({ ok: true });
    });

    it('FE-031: geen ingevuld klantgegeven en geen aanhef in de klusgegevens', () => {
      for (const { waarde, hoofdlettergevoelig } of ingevuldeWaarden(geval.klant)) {
        expect(bevat(opdracht.tekst, waarde, hoofdlettergevoelig), `"${waarde}" staat in de opdracht`).toBe(
          false,
        );
      }
      expect(bevatTelefoon(opdracht.tekst, geval.klant.telefoon)).toBe(false);
      // De app zet zelf geen aanhef in de klusgegevens (vrije tekst van de gebruiker kan wel "Dhr." bevatten).
      expect(opdracht.json).not.toMatch(/"aanhef"|: "(?:dhr|mevr|fam|bedrijf)"/);
      const zonderVrijeTekst = bouwKlusVoorAgent({
        invoer: { ...geval.invoer, gewensteUitvoering: '', overig: '', werkzaamheden: [], dakvlakken: [] },
        klant: geval.klant,
        offertedatum: '2026-09-25',
        keuzes: KEUZE_STARTSET,
      });
      expect(JSON.stringify(zonderVrijeTekst)).not.toMatch(
        /\b(?:Dhr|Mevr|Fam)\.|Geachte|heer|mevrouw|familie/i,
      );
      expect(opdracht.json).toContain('"naam": "[KLANT_NAAM]"');
    });

    it('zonder filter blokkeert de eindcontrole zodra er een klantgegeven in staat (FE-033)', () => {
      const klus = bouwKlusVoorAgent(
        { invoer: geval.invoer, klant: geval.klant, offertedatum: '2026-09-25', keuzes: KEUZE_STARTSET },
        { filteren: false },
      );
      const ruw = [...gebruikersTekst(klus), geval.instructie ?? ''].join('\n');
      const piiSet = bouwPiiSet(geval.klant);
      // Staat er een klantgegeven van controleerbare lengte in de ruwe tekst (het filter zou het
      // vervangen), dan moet de controle blokkeren.
      const geraakt = piiSet
        .filter((p) => p.soort === 'telefoon' || p.waarde.length >= 3)
        .some((p) => anonimiseer(ruw, [p]) !== anonimiseer(ruw, []));
      if (geraakt) expect(controleer(ruw, piiSet).ok).toBe(false);
    });
  });
});

describe('roundtrip (V-02, V-27)', () => {
  const gevallen = testset.filter(
    (g) => g.klant.voornaam !== '' || g.klant.achternaam !== '' || g.klant.adres.plaats !== '',
  );

  it('over minstens 20 gevallen', () => {
    expect(gevallen.length).toBeGreaterThanOrEqual(20);
  });

  it.each(gevallen.map((g) => [g.omschrijving, g] as const))('%s', (_, geval) => {
    const ingevuld = invullen(inhoudMetPlaatshouders, geval.klant);
    const terug = terugNaarPlaatshouders(ingevuld, geval.klant);
    // Weergave-invariant: opnieuw invullen geeft precies dezelfde tekst.
    expect(invullen(terug, geval.klant)).toEqual(ingevuld);
    // En wat wordt opgeslagen bevat geen klantgegeven.
    expect(controleer(tekstvelden(terug).join('\n'), bouwPiiSet(geval.klant))).toEqual({ ok: true });
  });

  it('is exact gelijk als geen plaatshouder van vorm hoeft te wisselen', () => {
    const klant = testset[0]!.klant;
    const x: OfferteInhoud = {
      ...inhoudMetPlaatshouders,
      inleiding: 'Beste [KLANT_NAAM], hierbij de offerte voor [KLANT_ADRES] in [KLANT_PLAATS].',
      werkomschrijving: ['Dak vervangen'],
      uitvoering: 'In overleg.',
      controlepunten: [],
      regels: inhoudMetPlaatshouders.regels.map((r) => ({ ...r, omschrijving: 'EPDM op [KLANT_ADRES]' })),
    };
    expect(terugNaarPlaatshouders(invullen(x, klant), klant)).toEqual(x);
  });
});
