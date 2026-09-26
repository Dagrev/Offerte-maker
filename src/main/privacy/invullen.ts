import type { Aanhef, Klant, OfferteInhoud } from '@shared/types';
import { volledigeNaam } from '@shared/labels';
import { anonimiseer } from './anonimiseer';
import { bouwPiiSet } from './piiSet';

// Opslaginvariant (TDO §11.4, V-02, V-27). `inhoud_json` bevat alleen plaatshouders; `invullen`
// zet voor weergave en PDF de echte waarden terug, `terugNaarPlaatshouders` doet het omgekeerde
// voor tekst die de renderer terugstuurt of die de agent schreef.

const AANHEF_KORT: Record<Aanhef, string> = { dhr: 'Dhr.', mevr: 'Mevr.', fam: 'Fam.', bedrijf: '' };

/** Plaatshouders die `invullen` vervangt; al het andere tussen blokhaken blijft staan. */
export const TOEGESTANE_PLAATSHOUDERS = [
  '[KLANT_AANHEF]',
  '[KLANT_NAAM]',
  '[KLANT_BEDRIJF]',
  '[KLANT_ADRES]',
  '[KLANT_POSTCODE]',
  '[KLANT_PLAATS]',
  '[WERK_ADRES]',
  '[WERK_PLAATS]',
] as const;

/** Weggelaten gegevens; verdwijnen bij `invullen`. */
export const WEGGELATEN_PLAATSHOUDERS = ['[VERWIJDERD]', '[BEDRIJF]'] as const;

/** Past `f` toe op elk tekstveld van de inhoud (§11.4: titel t/m controlepunten). */
export function mapTekstvelden(inhoud: OfferteInhoud, f: (tekst: string) => string): OfferteInhoud {
  return {
    ...inhoud,
    titel: f(inhoud.titel),
    inleiding: f(inhoud.inleiding),
    werkomschrijving: inhoud.werkomschrijving.map(f),
    regels: inhoud.regels.map((r) => ({ ...r, omschrijving: f(r.omschrijving) })),
    uitvoering: f(inhoud.uitvoering),
    opmerkingen: f(inhoud.opmerkingen),
    afsluiting: f(inhoud.afsluiting),
    controlepunten: inhoud.controlepunten.map(f),
  };
}

/** Alle tekstvelden van de inhoud als lijst, in de volgorde van `mapTekstvelden`. */
export function tekstvelden(inhoud: OfferteInhoud): string[] {
  const velden: string[] = [];
  mapTekstvelden(inhoud, (t) => {
    velden.push(t);
    return t;
  });
  return velden;
}

function waarden(klant: Klant): Record<string, string> {
  const werk = klant.heeftWerkadres ? klant.werkadres : klant.adres;
  return {
    '[KLANT_AANHEF]': AANHEF_KORT[klant.aanhef],
    '[KLANT_NAAM]': volledigeNaam(klant),
    '[KLANT_BEDRIJF]': klant.bedrijfsnaam.trim() || volledigeNaam(klant),
    '[KLANT_ADRES]': klant.adres.straatHuisnummer.trim(),
    '[KLANT_POSTCODE]': klant.adres.postcode.trim(),
    '[KLANT_PLAATS]': klant.adres.plaats.trim(),
    '[WERK_ADRES]': werk.straatHuisnummer.trim(),
    '[WERK_PLAATS]': werk.plaats.trim(),
    '[VERWIJDERD]': '',
    '[BEDRIJF]': '',
  };
}

const TE_VERVANGEN =
  /\[(?:KLANT_AANHEF|KLANT_NAAM|KLANT_BEDRIJF|KLANT_ADRES|KLANT_POSTCODE|KLANT_PLAATS|WERK_ADRES|WERK_PLAATS|VERWIJDERD|BEDRIJF)\]/g;

/** Vervangt de plaatshouders in één tekst en ruimt dubbele spaties en spaties aan regelranden op. */
export function vulTekstIn(tekst: string, klant: Klant): string {
  const w = waarden(klant);
  return tekst
    .replace(TE_VERVANGEN, (p) => w[p] ?? p)
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/gm, '');
}

/** Plaatshouders → echte waarden, voor weergave en PDF (§11.4). */
export function invullen(inhoud: OfferteInhoud, klant: Klant): OfferteInhoud {
  return mapTekstvelden(inhoud, (t) => vulTekstIn(t, klant));
}

/** Echte waarden → plaatshouders, met het privacyfilter op elk tekstveld (§11.4). */
export function terugNaarPlaatshouders(inhoud: OfferteInhoud, klant: Klant): OfferteInhoud {
  const piiSet = bouwPiiSet(klant);
  return mapTekstvelden(inhoud, (t) => anonimiseer(t, piiSet));
}
