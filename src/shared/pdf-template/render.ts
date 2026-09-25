import type { Bedrijf, Klant, OfferteInhoud, Opmaak, Totalen } from '../types';
import { veiligeAccentkleur } from './kleuren';
import { compactCss } from './layouts/compact';
import { klassiekCss } from './layouts/klassiek';
import { modernCss } from './layouts/modern';
import { LETTERTYPES } from './lettertypes';
import * as s from './secties';

// HTML-template voor offerte-PDF en -voorbeeld (TDO §12.1, §12.2). Eén pure functie voor beide,
// zodat het voorbeeld in de app gelijk is aan de PDF (FE-050). Geen Node, geen DOM, geen scripts:
// het voorbeeld draait in een `<iframe sandbox="">`, de PDF in een venster met `javascript: false`.

/** Alles wat de template nodig heeft, al ingevuld en berekend (§12.3 stap 1). De template rekent niets. */
export interface PdfModel {
  bedrijf: Bedrijf;
  /** `data:image/…;base64,…`; al het andere wordt genegeerd. */
  logoDataUri: string | null;
  opmaak: Opmaak;
  /** `@font-face`-regels met data-URI's, uit `src/main/pdf/fonts.ts`. */
  fontCss: string;
  klant: Klant;
  /** `null` → "CONCEPT". */
  nummer: string | null;
  /** `YYYY-MM-DD` */
  offertedatum: string;
  /** `YYYY-MM-DD` */
  geldigTot: string;
  aanhefregel: string;
  /** Ingevuld (§11.4): zonder plaatshouders. */
  inhoud: OfferteInhoud;
  totalen: Totalen;
  garantietekst: string;
  betalingsvoorwaarden: string;
  geldigheidDagen: number;
  voetnoot: string;
}

export type PdfModus = 'pdf' | 'voorbeeld';

export const LAYOUT_CSS: Record<Opmaak['layout'], string> = {
  klassiek: klassiekCss,
  modern: modernCss,
  compact: compactCss,
};

/** Gemeenschappelijke CSS; de lay-outs voegen daar alleen plaatsing, kleurgebruik en typografie aan toe. */
export const BASIS_CSS = `
@page { size: A4; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-tekst); font-size: 10pt; line-height: 1.4; color: #1A1A1A; background: #FFFFFF;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1, h2 { font-family: var(--font-kop); font-weight: 700; line-height: 1.25; margin: 0 0 6pt; }
h1 { font-size: 15pt; }
h2 { font-size: 11.5pt; }
p { margin: 0 0 6pt; }
section { margin: 0 0 14pt; break-inside: avoid-page; }
section.werkomschrijving, section.prijsopgave { break-inside: auto; }
h2 { break-after: avoid-page; }
ol { margin: 0; padding-left: 18pt; }
li { margin: 0 0 3pt; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { text-align: left; vertical-align: top; padding: 3pt 5pt; }
th { font-weight: 700; }
.getal { text-align: right; white-space: nowrap; }
.kop { display: flex; gap: 12pt; }
.logo { display: block; max-height: 22mm; max-width: 60mm; object-fit: contain; }
.bedrijfsnaam { font-family: var(--font-kop); font-size: 14pt; font-weight: 700; }
.gegevens span, .klant span { display: block; }
.adres { display: flex; justify-content: space-between; gap: 24pt; }
.offertegegevens table { width: auto; }
.offertegegevens th { font-weight: 400; padding: 0 10pt 0 0; }
.offertegegevens td { padding: 0; }
.werkadres { margin: 4pt 0 0; }
.aanhef { margin-bottom: 8pt; }
.prijstabel .omschrijving { width: 52%; }
.totalen { width: 60%; margin: 6pt 0 0 auto; break-inside: avoid; }
.totalen td { padding: 2pt 5pt; }
.totalen .totaal td { font-weight: 700; color: var(--accent); border-top: 1pt solid currentColor; padding-top: 4pt; }
.ondertekening { margin-top: 10pt; }
.akkoord .lijnen { display: flex; gap: 18pt; margin-top: 8pt; }
.akkoord .lijn { flex: 1; border-bottom: 0.75pt solid #1A1A1A; height: 32pt; position: relative; }
.akkoord .lijn.handtekening { flex: 1.6; }
.akkoord .lijn span { position: absolute; left: 0; top: 0; font-size: 8.5pt; color: #555555; }
.voetnoot { font-size: 8pt; color: #555555; }
body.voorbeeld { width: 210mm; min-height: 297mm; padding: 20mm 20mm 25mm; position: relative; }
.voettekst {
  margin-top: 18pt; padding-top: 4pt; border-top: 0.5pt solid #CCCCCC;
  font-family: sans-serif; font-size: 8pt; color: #555555;
}
.watermerk {
  position: absolute; top: 148mm; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
  font-family: sans-serif; font-size: 110pt; font-weight: 700; letter-spacing: 8pt;
  color: rgba(0, 0, 0, 0.07); pointer-events: none; z-index: 10; white-space: nowrap;
}
`;

/** Voorkomt dat CSS uit het model de `<style>` afsluit: `<` wordt de CSS-escape `\3c`. */
function veiligeCss(css: string): string {
  return css.replace(/</g, '\\3c ');
}

/**
 * Rendert de complete offerte als HTML-document. Modus `voorbeeld` voegt een statische voettekst toe
 * en bij een concept (`nummer: null`) een diagonaal watermerk; modus `pdf` niet (de voettekst komt
 * dan uit de `footerTemplate` van `printToPDF`).
 */
export function renderOfferteHtml(model: PdfModel, modus: PdfModus): string {
  const { layout, lettertype, accentkleur } = model.opmaak;
  const letters = LETTERTYPES[lettertype];
  const variabelen =
    `:root { --accent: ${veiligeAccentkleur(accentkleur)}; ` +
    `--font-tekst: ${letters.tekst}; --font-kop: ${letters.kop}; }`;
  const voorbeeld = modus === 'voorbeeld';

  const body = [
    voorbeeld && model.nummer === null ? s.watermerk() : '',
    s.kop(model),
    s.adresblok(model),
    s.titel(model),
    s.inleiding(model),
    s.werkomschrijving(model),
    s.prijsopgave(model),
    s.uitvoering(model),
    s.garantie(model),
    s.opmerkingen(model),
    s.voorwaarden(model),
    s.afsluiting(model),
    s.akkoord(),
    s.voetnoot(model),
    voorbeeld ? s.voettekst(model) : '',
  ].join('\n');

  const titel = model.nummer ? `Offerte ${model.nummer}` : 'Offerte (concept)';
  return (
    `<!doctype html>\n<html lang="nl"><head><meta charset="utf-8">` +
    `<title>${s.escapeHtml(titel)}</title>\n` +
    `<style>${veiligeCss(model.fontCss)}</style>\n` +
    `<style>${variabelen}${BASIS_CSS}${LAYOUT_CSS[layout]}</style>\n` +
    `</head>\n<body class="layout-${layout} ${modus}">\n${body}\n</body></html>\n`
  );
}
