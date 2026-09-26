import type { OfferteInhoud, Offerteregel, Prijspost } from '@shared/types';
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

Werkzaamheden
- De klusgegevens bevatten de gekozen werkzaamheden, elk met aantal, eenheid, prijs, materialen en opties. Maak per werkzaamheid één regel en zet de materialen en opties als eigen regels direct eronder, met in onderdeelVan het volgnummer (vanaf 1) van de regel van die werkzaamheid; alle andere regels krijgen onderdeelVan null. Neem naam, aantal, eenheid, prijsEuro en prijspostId exact over, met prijsbron "prijslijst"; is prijsEuro null, schat de prijs zoals hierboven. Verwerk een notitie in de werkomschrijving.

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

/** Eerste Werkwijze-bullet in de Claude Code-modus (voorbeelden in de werkmap). */
const WERKWIJZE_MAP =
  '- In de map waarin je werkt staan geanonimiseerde voorbeeldoffertes in voorbeelden/{{#template}} en het template in template.md{{/template}}. Lees die voordat je schrijft (bij meer dan vijf voorbeelden: de vijf die het best passen bij de klus). Je mag alleen lezen; doe verder niets.';

/** V-17: in API-modus staan de voorbeelden in de opdracht zelf. */
export const WERKWIJZE_API =
  '- De geanonimiseerde voorbeeldoffertes{{#template}} en het template{{/template}} staan hieronder in de opdracht. Gebruik ze als voorbeeld.';

/**
 * Systeemprompt; de template-delen alleen als er een goedgekeurd template is. Met `api` vervangt de
 * vaste zin uit V-17 de eerste Werkwijze-bullet (OFM-020).
 */
export function bouwSysteemprompt(opties: { template: boolean; api?: boolean }): string {
  const sjabloon = opties.api
    ? SYSTEEMPROMPT_SJABLOON.replace(WERKWIJZE_MAP, WERKWIJZE_API)
    : SYSTEEMPROMPT_SJABLOON;
  return sjabloon.replace(TEMPLATE_DEEL, (_, deel: string) => (opties.template ? deel : ''));
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

/** API-modus (§10.5, V-17): maximaal 10 voorbeelden en 200.000 tekens voor template + voorbeelden. */
export const API_MAX_VOORBEELDEN = 10;
export const API_MAX_TEKENS = 200_000;

export interface VoorbeeldenVoorApi {
  /** Tekst van het goedgekeurde template, of `null`. */
  template: string | null;
  /** Goedgekeurde voorbeelden (zonder template), nieuwste eerst. */
  voorbeelden: readonly string[];
}

/**
 * Sectie Voorbeelden in API-modus: de volledige teksten, zonder de zin over de map. Eerst het template,
 * dan de voorbeelden (nieuwste eerst) zolang template + voorbeelden samen binnen de grens blijven.
 */
export function voorbeeldenSectieApi(v: VoorbeeldenVoorApi): string {
  let tekens = v.template?.length ?? 0;
  const gekozen: string[] = [];
  for (const tekst of v.voorbeelden.slice(0, API_MAX_VOORBEELDEN)) {
    if (tekens + tekst.length > API_MAX_TEKENS) break;
    tekens += tekst.length;
    gekozen.push(tekst);
  }
  const delen: string[] = [];
  if (gekozen.length === 0) {
    delen.push('Er zijn geen voorbeeldoffertes; schrijf in een gangbare, zakelijke stijl.');
  }
  if (v.template !== null) {
    delen.push(`Volg de indeling en toon van het template.\n\n### Template\n\n${v.template}`);
  }
  gekozen.forEach((tekst, i) => delen.push(`### Voorbeeldofferte ${i + 1}\n\n${tekst}`));
  return delen.join('\n\n');
}

const json = (waarde: unknown): string => JSON.stringify(waarde, null, 2);
const blok = (waarde: unknown): string => `\`\`\`json\n${json(waarde)}\n\`\`\``;

export interface OpdrachtMaken {
  klus: KlusVoorAgent;
  prijslijst: readonly Prijspost[];
  teksten: Standaardteksten;
  aantalVoorbeelden: number;
  template: boolean;
  /** Alleen in API-modus: de volledige teksten in plaats van de verwijzing naar de werkmap (V-17). */
  api?: VoorbeeldenVoorApi;
}

/** Sectie Voorbeelden in CLI- of API-modus. */
export function voorbeeldenKop(o: Pick<OpdrachtMaken, 'aantalVoorbeelden' | 'template' | 'api'>): string {
  return `## Voorbeelden\n${o.api ? voorbeeldenSectieApi(o.api) : voorbeeldenSectie(o.aantalVoorbeelden, o.template)}`;
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
    voorbeeldenKop(o),
  ].join('\n');
}

// ---------- Opdracht `aanpassen` (OFM-017, §10.5, V-06) ----------

export interface HuidigeRegelVoorAgent {
  ref: string;
  omschrijving: string;
  aantal: number;
  eenheid: Offerteregel['eenheid'];
  prijsEuro: number;
  btwTarief: Offerteregel['btwTarief'];
  prijsbron: Offerteregel['prijsbron'];
  prijspostId: string | null;
  /** OFM-044: volgnummer van de werkzaamheidregel waar deze regel onder valt, of `null`. */
  onderdeelVan: number | null;
}

export interface HuidigeOfferteVoorAgent {
  titel: string;
  inleiding: string;
  werkomschrijving: string[];
  regels: HuidigeRegelVoorAgent[];
  uitvoering: string;
  opmerkingen: string;
  afsluiting: string;
}

function volgnummerVan(regels: readonly Offerteregel[], id: string | null | undefined): number | null {
  const index = id ? regels.findIndex((r) => r.id === id) : -1;
  return index < 0 ? null : index + 1;
}

/**
 * "## Huidige offerte" (§10.5): de inhoud zonder regel-id's en zonder controlepunten; prijzen als
 * `prijsEuro`, aantallen als decimaal getal; per regel `ref` (`r1`, `r2`, … in volgorde) en `prijsbron`
 * (V-06). `prijspostId` blijft, zodat een prijslijstregel aan zijn post gekoppeld blijft. OFM-044:
 * `onderdeelVan` is het volgnummer van de werkzaamheidregel erboven.
 */
export function huidigeOfferteVoorAgent(inhoud: OfferteInhoud): HuidigeOfferteVoorAgent {
  return {
    titel: inhoud.titel,
    inleiding: inhoud.inleiding,
    werkomschrijving: inhoud.werkomschrijving,
    regels: inhoud.regels.map((r, i) => ({
      ref: `r${i + 1}`,
      omschrijving: r.omschrijving,
      aantal: r.aantalHonderdsten / 100,
      eenheid: r.eenheid,
      prijsEuro: r.prijsCent / 100,
      btwTarief: r.btwTarief,
      prijsbron: r.prijsbron,
      prijspostId: r.prijspostId,
      onderdeelVan: volgnummerVan(inhoud.regels, r.onderdeelVan),
    })),
    uitvoering: inhoud.uitvoering,
    opmerkingen: inhoud.opmerkingen,
    afsluiting: inhoud.afsluiting,
  };
}

export const SLOTZIN_AANPASSEN =
  'Lever de volledige aangepaste offerte. Laat ongewijzigd wat niet genoemd wordt.';

export interface OpdrachtAanpassen {
  /** Opgeslagen inhoud (met plaatshouders), al door het filter. */
  huidige: OfferteInhoud;
  /** Instructie na het privacyfilter. */
  instructie: string;
  prijslijst: readonly Prijspost[];
  aantalVoorbeelden: number;
  template: boolean;
  api?: VoorbeeldenVoorApi;
}

/** Opdracht bij `aanpassen` (§10.5): dezelfde secties Prijslijst en Voorbeelden als bij `maken`. */
export function bouwOpdrachtAanpassen(o: OpdrachtAanpassen): string {
  return [
    '# Opdracht: pas deze offerte aan',
    '',
    `## Huidige offerte\n${blok(huidigeOfferteVoorAgent(o.huidige))}`,
    '',
    prijslijstSectie(o.prijslijst),
    '',
    voorbeeldenKop(o),
    '',
    `## Wat moet er anders\n${o.instructie.trim()}`,
    '',
    SLOTZIN_AANPASSEN,
  ].join('\n');
}

/** Wat er naar de agent gaat en in het privacylog komt (§10.7 stap 5). */
export function verstuurdeTekst(systeemprompt: string, opdracht: string): string {
  return `${systeemprompt}\n\n---\n\n${opdracht}`;
}

// ---------- Standaardteksten uit het template (OFM-024, §10.5, FE-084) ----------

/** Systeemprompt-variant bij `template_teksten` (§10.5, letterlijk). */
export const SYSTEEMPROMPT_TEMPLATE_TEKSTEN =
  'Je krijgt een geanonimiseerd offertetemplate. Stel standaardteksten voor. Antwoord uitsluitend met JSON volgens het schema.';

/** De standaardteksten die de agent mag voorstellen, in deze volgorde. */
export const TEMPLATE_TEKST_VELDEN = [
  'inleiding',
  'afsluiting',
  'betalingsvoorwaarden',
  'garantie10',
  'garantie20',
  'voetnoot',
] as const;

/** JSON-schema: object met optionele strings (§10.5). De nep-CLI herkent het aan `"garantie10"` (V-08). */
export const TEMPLATE_TEKSTEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(TEMPLATE_TEKST_VELDEN.map((veld) => [veld, { type: 'string' }])),
};

/**
 * Opdracht bij `template_teksten`: de inhoud van template.md (`# Template` + tekst, §10.3, §10.5). Zo
 * staat de volledige templatetekst ook in API-modus in de opdracht.
 */
export function bouwOpdrachtTemplateTeksten(templateTekst: string): string {
  return `# Template\n\n${templateTekst}`;
}
