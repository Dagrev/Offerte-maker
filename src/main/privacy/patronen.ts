// Generieke patronen voor het privacyfilter (TDO §11.2). Letterlijk uit het ontwerp.
// Let op: globale regexen hebben `lastIndex`-toestand. Gebruik ze met `String.replace`/`matchAll`
// (die resetten zelf), niet met `.test()`.

/** Stap 1: e-mailadres. */
export const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;

/** Stap 1: IBAN, met of zonder spaties per vier tekens. */
export const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/gi;

/** Stap 1: Nederlands telefoonnummer (0, +31 of 0031 en negen cijfers). */
export const TELEFOON_NL = /(?<![\d,.])(?:\+31|0031|0)(?:[\s-]?\d){9}(?![\d,.])/g;

/** Stap 2b: postcode in hoofdletters, met of zonder spatie. */
export const POSTCODE = /\b[1-9]\d{3}\s?[A-Z]{2}\b/g;

/** Stap 2b: postcode aaneengeschreven in kleine letters. */
export const POSTCODE_KLEIN = /\b[1-9]\d{3}[a-z]{2}\b/g;

/** Plaatshouder voor weggelaten gegevens. */
export const VERWIJDERD = '[VERWIJDERD]';

/** Stap 1 van §11.2 (ook gebruikt door de voorbeeldredactie, §11.5 stap 2). */
export function vervangGeneriekePatronen(tekst: string): string {
  return tekst.replace(EMAIL, VERWIJDERD).replace(IBAN, VERWIJDERD).replace(TELEFOON_NL, VERWIJDERD);
}

/** Stap 2b van §11.2: postcodes die niet als PII-waarde bekend waren. */
export function vervangPostcodes(tekst: string): string {
  return tekst.replace(POSTCODE, VERWIJDERD).replace(POSTCODE_KLEIN, VERWIJDERD);
}
