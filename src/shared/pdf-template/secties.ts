import { regelbedragCent } from '../calc/bedragen';
import { formatAantal, formatDatum, formatDatumLang, formatEuro } from '../formatteer';
import { klantWeergave, naamMetVoorletters } from '../labels';
import type { Bedrijf, Klant } from '../types';
import { telefoonWeergave } from '../validatie';
import type { PdfModel } from './render';

// De onderdelen van de offerte, in de volgorde van FO §9. Elke functie geeft één `<section>`
// (of een lege string als het onderdeel wegvalt). Alle tekst uit het model gaat door `escapeHtml`.
// Vaste teksten letterlijk volgens TDO V-22.

export const SECTIEKOPPEN = {
  werkomschrijving: 'Werkomschrijving',
  prijsopgave: 'Prijsopgave',
  uitvoering: 'Uitvoering en planning',
  garantie: 'Garantie',
  opmerkingen: 'Opmerkingen',
  voorwaarden: 'Voorwaarden',
  akkoord: 'Voor akkoord',
} as const;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(tekst: string): string {
  return tekst.replace(/[&<>"']/g, (t) => ESCAPES[t] ?? t);
}

/** Vrije tekst → alinea's: lege regel = nieuwe alinea, enkele regelovergang = `<br>`. */
export function alineas(tekst: string): string {
  return tekst
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter((a) => a !== '')
    .map((a) => `<p>${a.split('\n').map(escapeHtml).join('<br>')}</p>`)
    .join('');
}

function regels(delen: readonly string[], klasse?: string): string {
  const attr = klasse ? ` class="${klasse}"` : '';
  return delen
    .map((d) => d.trim())
    .filter((d) => d !== '')
    .map((d) => `<span${attr}>${escapeHtml(d)}</span>`)
    .join('');
}

/** "5611 AB Eindhoven" (lege delen weggelaten). */
function postcodePlaats(postcode: string, plaats: string): string {
  return [postcode.trim(), plaats.trim()].filter((d) => d !== '').join(' ');
}

/**
 * Voettekst: `KvK <kvk> · btw <btwNummer> · IBAN <iban>`, lege delen weggelaten (TDO §12.3 stap 4).
 * Platte tekst, niet ge-escaped. Ook bruikbaar voor de `footerTemplate` van `printToPDF` (OFM-015).
 */
export function voettekstRegel(bedrijf: Pick<Bedrijf, 'kvk' | 'btwNummer' | 'iban'>): string {
  const delen: [string, string][] = [
    ['KvK', bedrijf.kvk],
    ['btw', bedrijf.btwNummer],
    ['IBAN', bedrijf.iban],
  ];
  return delen
    .filter(([, waarde]) => waarde.trim() !== '')
    .map(([label, waarde]) => `${label} ${waarde.trim()}`)
    .join(' · ');
}

/** Alleen een `data:image/…`-URI wordt als logo gebruikt; al het andere zou een externe bron zijn (NFE-009). */
function veiligLogo(logoDataUri: string | null): string | null {
  return logoDataUri !== null && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(logoDataUri)
    ? logoDataUri
    : null;
}

// 1. Kop: logo, bedrijfsnaam, bedrijfsgegevens.
export function kop(m: PdfModel): string {
  const b = m.bedrijf;
  const logo = veiligLogo(m.logoDataUri);
  const logoHtml = logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="">` : '';
  const naam = b.naam.trim() ? `<div class="bedrijfsnaam">${escapeHtml(b.naam.trim())}</div>` : '';
  // Telefoon staat als E.164 opgeslagen (OFM-030); op papier leesbaar: +31 6 12345678.
  const tel = telefoonWeergave(b.telefoon);
  const gegevens = regels([b.adres, postcodePlaats(b.postcode, b.plaats), tel, b.email, b.website]);
  return (
    `<section class="kop">${logoHtml}<div class="bedrijf">${naam}` +
    `<div class="gegevens">${gegevens}</div></div></section>`
  );
}

/**
 * Klantblok (V-22, OFM-038): bedrijf → bedrijfsnaam + "t.a.v. J. Jansen"; anders
 * `<Dhr./Mevr.> J. Jansen` of `Fam. Jansen`.
 */
export function klantRegels(klant: Klant): string[] {
  const naam = naamMetVoorletters(klant);
  const eerste = klantWeergave(klant);
  const tav =
    klant.aanhef === 'bedrijf' && klant.bedrijfsnaam.trim() !== '' && naam !== '' ? [`t.a.v. ${naam}`] : [];
  return [
    eerste,
    ...tav,
    klant.adres.straatHuisnummer,
    postcodePlaats(klant.adres.postcode, klant.adres.plaats),
  ];
}

// 2. Adresblok klant met rechts de offertegegevens.
export function adresblok(m: PdfModel): string {
  const k = m.klant;
  const gegevens: [string, string][] = [
    ['Offertenummer', m.nummer ?? 'CONCEPT'],
    ['Datum', formatDatum(m.offertedatum)],
    ['Geldig tot', formatDatum(m.geldigTot)],
  ];
  const tabel = gegevens
    .map(([label, waarde]) => `<tr><th>${label}</th><td>${escapeHtml(waarde)}</td></tr>`)
    .join('');
  const werk = k.heeftWerkadres
    ? `<p class="werkadres">Werkadres: ${escapeHtml(
        [k.werkadres.straatHuisnummer.trim(), k.werkadres.plaats.trim()].filter((d) => d !== '').join(', '),
      )}</p>`
    : '';
  const klassenummer = m.nummer === null ? ' concept' : '';
  return (
    `<section class="adres"><div class="klant">${regels(klantRegels(k))}</div>` +
    `<div class="offertegegevens${klassenummer}"><table>${tabel}</table>${werk}</div></section>`
  );
}

// 3. Titel.
export function titel(m: PdfModel): string {
  return `<section class="titel"><h1>${escapeHtml(m.inhoud.titel)}</h1></section>`;
}

// 4. Aanhef en inleiding.
export function inleiding(m: PdfModel): string {
  return (
    `<section class="inleiding"><p class="aanhef">${escapeHtml(m.aanhefregel)}</p>` +
    `${alineas(m.inhoud.inleiding)}</section>`
  );
}

// 5. Werkomschrijving als genummerde lijst.
export function werkomschrijving(m: PdfModel): string {
  const items = m.inhoud.werkomschrijving.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  return `<section class="werkomschrijving"><h2>${SECTIEKOPPEN.werkomschrijving}</h2><ol>${items}</ol></section>`;
}

// 6. Prijsopgave: tabel en totalen.
export function prijsopgave(m: PdfModel): string {
  const rijen = m.inhoud.regels
    .map(
      (r) =>
        `<tr><td class="omschrijving">${escapeHtml(r.omschrijving)}</td>` +
        `<td class="getal">${formatAantal(r.aantalHonderdsten)}</td>` +
        `<td class="eenheid">${escapeHtml(r.eenheid)}</td>` +
        `<td class="getal">${formatEuro(r.prijsCent)}</td>` +
        `<td class="getal">${formatEuro(regelbedragCent(r))}</td></tr>`,
    )
    .join('');
  const t = m.totalen;
  const btw = t.btw
    .map(
      (b) =>
        `<tr class="btw"><td>Btw ${b.tarief}% over ${formatEuro(b.grondslagCent)}</td>` +
        `<td class="getal">${formatEuro(b.bedragCent)}</td></tr>`,
    )
    .join('');
  return (
    `<section class="prijsopgave"><h2>${SECTIEKOPPEN.prijsopgave}</h2>` +
    `<table class="prijstabel"><thead><tr><th class="omschrijving">Omschrijving</th>` +
    `<th class="getal">Aantal</th><th class="eenheid">Eenheid</th><th class="getal">Prijs</th>` +
    `<th class="getal">Bedrag</th></tr></thead><tbody>${rijen}</tbody></table>` +
    `<table class="totalen"><tbody>` +
    `<tr class="subtotaal"><td>Subtotaal excl. btw</td><td class="getal">${formatEuro(t.subtotaalCent)}</td></tr>` +
    btw +
    `<tr class="totaal"><td>Totaal incl. btw</td><td class="getal">${formatEuro(t.totaalCent)}</td></tr>` +
    `</tbody></table></section>`
  );
}

// 7. Uitvoering en planning.
export function uitvoering(m: PdfModel): string {
  return `<section class="uitvoering"><h2>${SECTIEKOPPEN.uitvoering}</h2>${alineas(m.inhoud.uitvoering)}</section>`;
}

// 8. Garantie.
export function garantie(m: PdfModel): string {
  return `<section class="garantie"><h2>${SECTIEKOPPEN.garantie}</h2>${alineas(m.garantietekst)}</section>`;
}

// 9. Opmerkingen, alleen als er iets staat.
export function opmerkingen(m: PdfModel): string {
  if (m.inhoud.opmerkingen.trim() === '') return '';
  return `<section class="opmerkingen"><h2>${SECTIEKOPPEN.opmerkingen}</h2>${alineas(m.inhoud.opmerkingen)}</section>`;
}

// 10. Voorwaarden: betalingsvoorwaarden en geldigheid.
export function voorwaarden(m: PdfModel): string {
  return (
    `<section class="voorwaarden"><h2>${SECTIEKOPPEN.voorwaarden}</h2>${alineas(m.betalingsvoorwaarden)}` +
    `<p class="geldigheid">Deze offerte is geldig tot en met ${escapeHtml(formatDatumLang(m.geldigTot))}.</p></section>`
  );
}

// 11. Afsluiting en ondertekening: "Met vriendelijke groet," / lege regel / contactpersoon / bedrijfsnaam.
export function afsluiting(m: PdfModel): string {
  const onder = ['Met vriendelijke groet,', '', m.bedrijf.contactpersoon.trim(), m.bedrijf.naam.trim()];
  const html = onder
    .filter((r, i) => i < 2 || r !== '')
    .map(escapeHtml)
    .join('<br>');
  return `<section class="afsluiting">${alineas(m.inhoud.afsluiting)}<p class="ondertekening">${html}</p></section>`;
}

// 12. Akkoordblok voor de klant.
export function akkoord(): string {
  const lijnen = ['Naam', 'Datum', 'Handtekening']
    .map((l) => `<div class="lijn ${l.toLowerCase()}"><span>${l}</span></div>`)
    .join('');
  return `<section class="akkoord"><h2>${SECTIEKOPPEN.akkoord}</h2><div class="lijnen">${lijnen}</div></section>`;
}

/** Vrije voetnoot uit de teksten (§9.4), onderaan als kleine tekst; weg als hij leeg is. */
export function voetnoot(m: PdfModel): string {
  if (m.voetnoot.trim() === '') return '';
  return `<section class="voetnoot">${alineas(m.voetnoot)}</section>`;
}

// 13. Voettekst, alleen in modus `voorbeeld` (in de PDF komt hij uit de footerTemplate).
export function voettekst(m: PdfModel): string {
  return `<footer class="voettekst">${escapeHtml(voettekstRegel(m.bedrijf))}</footer>`;
}

/** Diagonaal watermerk, alleen in modus `voorbeeld` bij een concept. */
export function watermerk(): string {
  return '<div class="watermerk" aria-hidden="true">CONCEPT</div>';
}
