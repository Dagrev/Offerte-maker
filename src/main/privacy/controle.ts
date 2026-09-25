import { type PiiWaarde, zoekpatroon } from './piiSet';

// Eindcontrole (TDO §11.3, FE-033). Zelfstandig van het filter: ook als het filter is
// overgeslagen (testhaak `privacyfilter-uit`) draait deze controle altijd.
//
// `payload` = alleen de delen van de opdracht die uit invoer van de gebruiker komen, na het
// filter, aan elkaar geplakt met `\n` (zie `gebruikersTekst` in `klusVoorAgent.ts`). Vaste tekst
// (systeemprompt, labels, prijslijst, standaardteksten) hoort er niet in.
//
// `gevonden` bevat klantgegevens: nooit loggen, hooguit het aantal.

export type Controleresultaat = { ok: true } | { ok: false; gevonden: string[] };

/** Plaatshouders tellen niet mee: een klant die "Klant" heet, mag `[KLANT_NAAM]` niet blokkeren. */
const PLAATSHOUDER = /\[[A-Z_]+\]/g;

export function controleer(payload: string, piiSet: readonly PiiWaarde[]): Controleresultaat {
  const tekst = payload.replace(PLAATSHOUDER, ' ');
  const gevonden = piiSet
    .filter((p) => (p.soort === 'telefoon' ? p.waarde.length >= 8 : p.waarde.length >= 3))
    .filter((p) => zoekpatroon(p, false).test(tekst))
    .map((p) => p.waarde);
  return gevonden.length === 0 ? { ok: true } : { ok: false, gevonden };
}
