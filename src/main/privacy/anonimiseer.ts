import { vervangGeneriekePatronen, vervangPostcodes } from './patronen';
import { type PiiWaarde, zoekpatroon } from './piiSet';

// Privacyfilter (TDO §11.2). Volgorde: (1) e-mail, IBAN, telefoon; (2) PII-waarden, langste eerst;
// (2b) overgebleven postcodes.
//
// Een ingezette plaatshouder mag in een latere stap niet opnieuw geraakt worden (een klant die
// "Klant" of "Werk" heet, zou anders `[KLANT_NAAM]` stukmaken). Daarom wordt elke plaatshouder,
// ook een die al in de tekst stond, tijdelijk vervangen door een token uit tekens in het
// privégebruikbereik van Unicode (U+E000 en verder): geen letter, geen cijfer, geen woordteken.

const PRIVE = 0xe000;
const TOKEN_BEGIN = String.fromCharCode(PRIVE);
const TOKEN_EIND = String.fromCharCode(PRIVE + 1);
/** Cijfers van de tokenindex (grondtal 256) liggen op U+E100 … U+E1FF. */
const CIJFER_BASIS = PRIVE + 0x100;
const TOKEN = new RegExp(`${TOKEN_BEGIN}([^${TOKEN_EIND}]+)${TOKEN_EIND}`, 'g');
const PLAATSHOUDER = /\[[A-Z_]+\]/g;

class Tokens {
  private readonly lijst: string[] = [];

  zet(tekst: string): string {
    let index = this.lijst.push(tekst) - 1;
    let code = '';
    do {
      code = String.fromCharCode(CIJFER_BASIS + (index % 256)) + code;
      index = Math.floor(index / 256);
    } while (index > 0);
    return TOKEN_BEGIN + code + TOKEN_EIND;
  }

  herstel(tekst: string): string {
    return tekst.replace(TOKEN, (_, code: string) => {
      const index = [...code].reduce((n, c) => n * 256 + c.charCodeAt(0) - CIJFER_BASIS, 0);
      return this.lijst[index] ?? '';
    });
  }
}

export function anonimiseer(tekst: string, piiSet: readonly PiiWaarde[]): string {
  const tokens = new Tokens();
  let uit = tekst.replace(PLAATSHOUDER, (p) => tokens.zet(p));

  // 1. generieke patronen
  uit = vervangGeneriekePatronen(uit).replace(PLAATSHOUDER, (p) => tokens.zet(p));

  // 2. PII-waarden, langste eerst (de set is al zo gesorteerd)
  for (const pii of piiSet) {
    uit = uit.replace(zoekpatroon(pii), () => tokens.zet(pii.plaatshouder));
  }

  // 2b. postcodes die geen klantpostcode waren
  uit = vervangPostcodes(uit);

  return tokens.herstel(uit);
}
