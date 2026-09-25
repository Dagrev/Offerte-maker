import type { Prijspost } from '@shared/types';
import type { KlusVoorAgent } from '../privacy/klusVoorAgent';

// Prompts (TDO §10.5). De systeemprompt staat er letterlijk; alleen de `{{#template}}…{{/template}}`-
// delen worden weggelaten als er geen goedgekeurd template is. `KlusVoorAgent` komt altijd uit
// `bouwKlusVoorAgent()` (V-26), nooit uit deze module.
// OFM-017 voegt de opdracht `aanpassen` toe, OFM-024 `template_teksten`, OFM-020 de API-modus.

/** Letterlijk uit §10.5, met de template-markeringen. */
export const SYSTEEMPROMPT_SJABLOON = `Je bent de offerteschrijver van een klein Nederlands dakdekkersbedrijf. Je schrijft zakelijke, vriendelijke offertes in helder Nederlands, in de stijl van de voorbeeldoffertes{{#template}} en volgens de indeling van het template{{/template}}.

Werkwijze
- In de map waarin je werkt staan geanonimiseerde voorbeeldoffertes in voorbeelden/{{#template}} en het template in template.md{{/template}}. Lees die voordat je schrijft (bij meer dan vijf voorbeelden: de vijf die het best passen bij de klus). Je mag alleen lezen; doe verder niets.
- Je antwoord is uitsluitend JSON volgens het opgegeven schema.

Persoonsgegevens
- Persoonsgegevens zijn vervangen door plaatshouders. Verwijs naar de klant uitsluitend met: [KLANT_NAAM], [KLANT_BEDRIJF], [KLANT_ADRES], [KLANT_POSTCODE], [KLANT_PLAATS], [WERK_ADRES], [WERK_PLAATS]. Verzin nooit namen, adressen, telefoonnummers of e-mailadressen.
- [VERWIJDERD] en [BEDRIJF] zijn weggelaten gegevens: neem ze niet over.
- Begin de inleiding niet met een aanhef ("Geachte …"); die zet het programma er zelf boven.

Prijzen en bedragen
- Heeft een post in de prijslijst een prijs, gebruik dan exact die prijs, eenheid en dat btw-tarief, met prijsbron "prijslijst" en het id van de post als prijspostId.
- Heeft een post geen prijs: leid hem af uit de voorbeelden (prijsbron "voorbeeld") of maak een realistische schatting voor de Nederlandse markt van dit jaar (prijsbron "schatting"), met prijspostId van de post als die bestaat, anders null. (Het programma meldt schattingen zelf aan de dakdekker; zet ze niet in controlepunten.)
- Bij een aanpassing: regels met prijsbron "handmatig" heeft de dakdekker zelf geprijsd. Laat hun prijs ongewijzigd en geef ze hun ref terug. Geef elke regel die uit de huidige offerte komt zijn ref; nieuwe regels krijgen ref null.
- Neem maten en aantallen over uit de klusgegevens. Gebruik totaalM2 voor posten per m².
- Prijzen zijn in euro exclusief btw. Reken geen totalen uit en noem geen totaalbedragen in je teksten; dat doet het programma.
- Btw-tarief is 21, tenzij de prijslijst anders zegt.

Inhoud
- titel: kort, bijvoorbeeld "Offerte vervangen dakbedekking plat dak".
- inleiding en afsluiting: gebruik de standaardteksten als basis en pas alleen aan wat de klus nodig maakt.
- werkomschrijving: concrete stappen in de volgorde van uitvoering, één stap per item, zonder nummering.
- uitvoering: planning en praktische zaken (steiger, bereikbaarheid, weersafhankelijkheid), mede op basis van de gewenste uitvoering.
- opmerkingen: alleen als er iets bijzonders is, anders een lege tekst.
- Garantie en betalingsvoorwaarden voegt het programma zelf toe; schrijf daar niets over.
- Het veld overig bevat wensen van de dakdekker zelf; verwerk die in regels, werkomschrijving of opmerkingen.
- controlepunten: maximaal 10 korte punten die de dakdekker moet nakijken.`;

const TEMPLATE_DEEL = /\{\{#template\}\}([\s\S]*?)\{\{\/template\}\}/g;

/** Systeemprompt; de template-delen alleen als er een goedgekeurd template is. */
export function bouwSysteemprompt(opties: { template: boolean }): string {
  return SYSTEEMPROMPT_SJABLOON.replace(TEMPLATE_DEEL, (_, deel: string) => (opties.template ? deel : ''));
}

/** Een prijspost zoals de agent hem ziet (§10.5): `prijsEuro` = `prijs_cent / 100` of `null`. */
export interface PrijsVoorAgent {
  id: string;
  omschrijving: string;
  eenheid: string;
  prijsEuro: number | null;
  btwTarief: number;
}

export function prijslijstVoorAgent(posten: readonly Prijspost[]): PrijsVoorAgent[] {
  return posten.map((p) => ({
    id: p.id,
    omschrijving: p.omschrijving,
    eenheid: p.eenheid,
    prijsEuro: p.prijsCent === null ? null : p.prijsCent / 100,
    btwTarief: p.btwTarief,
  }));
}

export interface Standaardteksten {
  inleiding: string;
  afsluiting: string;
}

/** Sectie Voorbeelden (§10.5), met de zin voor n = 0 en de template-zin. */
export function voorbeeldenSectie(aantalVoorbeelden: number, template: boolean): string {
  const basis =
    aantalVoorbeelden === 0
      ? 'Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl.'
      : `Er zijn ${aantalVoorbeelden} goedgekeurde voorbeeldoffertes in voorbeelden/.`;
  return template ? `${basis} Volg de indeling en toon van template.md.` : basis;
}

const json = (waarde: unknown): string => JSON.stringify(waarde, null, 2);
const blok = (waarde: unknown): string => `\`\`\`json\n${json(waarde)}\n\`\`\``;

export interface OpdrachtMaken {
  klus: KlusVoorAgent;
  prijslijst: readonly Prijspost[];
  teksten: Standaardteksten;
  aantalVoorbeelden: number;
  template: boolean;
}

/** Gedeelde secties Prijslijst en Voorbeelden (ook voor `aanpassen`, OFM-017). */
export function prijslijstSectie(prijslijst: readonly Prijspost[]): string {
  return `## Prijslijst\n${blok(prijslijstVoorAgent(prijslijst))}`;
}

/** Opdracht bij `maken` (§10.5). */
export function bouwOpdrachtMaken(o: OpdrachtMaken): string {
  return [
    '# Opdracht: schrijf een offerte',
    '',
    `## Klusgegevens\n${blok(o.klus)}`,
    '',
    prijslijstSectie(o.prijslijst),
    '',
    `## Standaardteksten\n${blok({ inleiding: o.teksten.inleiding, afsluiting: o.teksten.afsluiting })}`,
    '',
    `## Voorbeelden\n${voorbeeldenSectie(o.aantalVoorbeelden, o.template)}`,
  ].join('\n');
}

/** Wat er naar de agent gaat en in het privacylog komt (§10.7 stap 5). */
export function verstuurdeTekst(systeemprompt: string, opdracht: string): string {
  return `${systeemprompt}\n\n---\n\n${opdracht}`;
}
