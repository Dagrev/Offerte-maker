import { describe, expect, it } from 'vitest';
import { berekenTotalen } from '../calc/bedragen';
import { tekstenSchema } from '../schemas';
import type { Klant, Offerteregel } from '../types';
import { STANDAARD_ACCENTKLEUR, VASTE_ACCENTKLEUREN, veiligeAccentkleur } from './kleuren';
import { ALLE_FONTBESTANDEN, LETTERTYPES } from './lettertypes';
import { type PdfModel, renderOfferteHtml } from './render';
import { alineas, escapeHtml, klantRegels, voettekstRegel } from './secties';
import { VOORBEELD_BEDRIJF, VOORBEELD_INHOUD, VOORBEELD_KLANT, opmaakVoorbeeldModel } from './voorbeeldData';

const FONT_CSS =
  "@font-face { font-family: 'Inter'; src: url(data:font/woff2;base64,AAAA) format('woff2'); }";
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const TEKSTEN = tekstenSchema.parse({});

function model(over: Partial<PdfModel> = {}): PdfModel {
  return {
    bedrijf: VOORBEELD_BEDRIJF,
    logoDataUri: LOGO,
    opmaak: { layout: 'klassiek', accentkleur: '#1F4E79', lettertype: 'inter' },
    fontCss: FONT_CSS,
    klant: VOORBEELD_KLANT,
    nummer: '2026-014',
    offertedatum: '2026-09-25',
    geldigTot: '2026-10-25',
    aanhefregel: 'Geachte familie De Vries,',
    inhoud: VOORBEELD_INHOUD,
    totalen: berekenTotalen(VOORBEELD_INHOUD.regels),
    garantietekst: TEKSTEN.garantie10,
    betalingsvoorwaarden: TEKSTEN.betalingsvoorwaarden,
    geldigheidDagen: 30,
    voetnoot: '',
    ...over,
  };
}

function klant(over: Partial<Klant>): Klant {
  return { ...VOORBEELD_KLANT, ...over };
}

function regel(over: Partial<Offerteregel>): Offerteregel {
  return {
    id: 'r',
    omschrijving: 'Regel',
    aantalHonderdsten: 100,
    eenheid: 'post',
    prijsCent: 10000,
    btwTarief: 21,
    prijsbron: 'handmatig',
    prijspostId: null,
    ...over,
  };
}

/** De tekst van alle `<section>`s, zonder tags, in volgorde. */
function sectieKlassen(html: string): string[] {
  return [...html.matchAll(/<section class="([^"]+)"/g)].map((m) => m[1] ?? '');
}

const LAYOUTS = ['klassiek', 'modern', 'compact'] as const;

describe('renderOfferteHtml', () => {
  it.each(LAYOUTS)('snapshot lay-out %s', (layout) => {
    expect(
      renderOfferteHtml(model({ opmaak: { layout, accentkleur: '#2E7D32', lettertype: 'inter' } }), 'pdf'),
    ).toMatchSnapshot();
  });

  it('bevat de onderdelen uit FO §9 in de juiste volgorde', () => {
    const html = renderOfferteHtml(model({ inhoud: { ...VOORBEELD_INHOUD, opmerkingen: 'Let op.' } }), 'pdf');
    expect(sectieKlassen(html)).toEqual([
      'kop',
      'adres',
      'titel',
      'inleiding',
      'werkomschrijving',
      'prijsopgave',
      'uitvoering',
      'garantie',
      'opmerkingen',
      'voorwaarden',
      'afsluiting',
      'akkoord',
    ]);
  });

  it('zonder garantietekst geen sectie Garantie (OFM-049: geen garantiekeuze)', () => {
    const html = renderOfferteHtml(model({ garantietekst: '' }), 'pdf');
    expect(sectieKlassen(html)).not.toContain('garantie');
  });

  it('gebruikt de sectiekoppen letterlijk (V-22)', () => {
    const html = renderOfferteHtml(model({ inhoud: { ...VOORBEELD_INHOUD, opmerkingen: 'x' } }), 'pdf');
    const koppen = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(koppen).toEqual([
      'Werkomschrijving',
      'Prijsopgave',
      'Uitvoering en planning',
      'Garantie',
      'Opmerkingen',
      'Voorwaarden',
      'Voor akkoord',
    ]);
  });

  it('escapet alle tekst uit het model', () => {
    const gevaarlijk = '<b>"Tom & Jerry"</b>';
    const html = renderOfferteHtml(
      model({
        klant: klant({ achternaam: gevaarlijk }),
        inhoud: {
          ...VOORBEELD_INHOUD,
          titel: gevaarlijk,
          regels: [regel({ omschrijving: gevaarlijk })],
          werkomschrijving: [gevaarlijk],
        },
      }),
      'pdf',
    );
    expect(html).not.toContain('<b>');
    const ge = '&lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;';
    expect(html).toContain(`<h1>${ge}</h1>`);
    expect(html).toContain(`<td class="omschrijving">${ge}</td>`);
    expect(html).toContain(`<span>Fam. ${ge}</span>`);
    expect(html).toContain(`<li>${ge}</li>`);
    expect(escapeHtml(`'`)).toBe('&#39;');
  });

  it('toont de offertegegevens en "CONCEPT" zonder nummer', () => {
    const met = renderOfferteHtml(model(), 'pdf');
    expect(met).toContain('<tr><th>Offertenummer</th><td>2026-014</td></tr>');
    expect(met).toContain('<tr><th>Datum</th><td>25-09-2026</td></tr>');
    expect(met).toContain('<tr><th>Geldig tot</th><td>25-10-2026</td></tr>');
    const zonder = renderOfferteHtml(model({ nummer: null }), 'pdf');
    expect(zonder).toContain('<tr><th>Offertenummer</th><td>CONCEPT</td></tr>');
    expect(zonder).toContain('<title>Offerte (concept)</title>');
  });

  it('laat opmerkingen weg bij lege tekst', () => {
    expect(
      renderOfferteHtml(model({ inhoud: { ...VOORBEELD_INHOUD, opmerkingen: ' \n ' } }), 'pdf'),
    ).not.toContain('Opmerkingen');
    expect(
      renderOfferteHtml(
        model({ inhoud: { ...VOORBEELD_INHOUD, opmerkingen: 'Regel 1\nRegel 2\n\nAlinea 2' } }),
        'pdf',
      ),
    ).toContain('<h2>Opmerkingen</h2><p>Regel 1<br>Regel 2</p><p>Alinea 2</p>');
  });

  it('modus voorbeeld: voettekst, en watermerk alleen bij een concept', () => {
    const concept = renderOfferteHtml(model({ nummer: null }), 'voorbeeld');
    expect(concept).toContain('<div class="watermerk" aria-hidden="true">CONCEPT</div>');
    expect(concept).toContain(
      '<footer class="voettekst">KvK 12345678 · btw NL001234567B01 · IBAN NL00 BANK 0123 4567 89</footer>',
    );
    expect(concept).toContain('<body class="layout-klassiek voorbeeld">');
    expect(renderOfferteHtml(model(), 'voorbeeld')).not.toContain('class="watermerk"');
  });

  it('modus pdf: geen voettekst en geen watermerk', () => {
    const html = renderOfferteHtml(model({ nummer: null }), 'pdf');
    expect(html).not.toContain('<footer');
    expect(html).not.toContain('class="watermerk"');
    expect(html).toContain('<body class="layout-klassiek pdf">');
  });

  it('OFM-044: materialen en opties ingesprongen onder hun werkzaamheid, met een subtotaal', () => {
    const regels = [
      regel({ id: 'w', omschrijving: 'Isoleren', prijsCent: 1000 }),
      regel({ id: 'm', omschrijving: 'PIR 80 mm', prijsCent: 500, onderdeelVan: 'w' }),
      regel({ id: 'x', omschrijving: 'Voorrijkosten', prijsCent: 2500 }),
    ];
    const html = renderOfferteHtml(
      model({ inhoud: { ...VOORBEELD_INHOUD, regels }, totalen: berekenTotalen(regels) }),
      'pdf',
    );
    const isoleren = html.indexOf('>Isoleren<');
    const pir = html.indexOf('<tr class="sub"><td class="omschrijving">PIR 80 mm</td>');
    const sub = html.indexOf(
      '<tr class="groepstotaal"><td class="omschrijving" colspan="4">Subtotaal Isoleren</td><td class="getal">€ 15,00</td></tr>',
    );
    const voorrij = html.indexOf('>Voorrijkosten<');
    expect([isoleren, pir, sub, voorrij].every((i) => i > 0)).toBe(true);
    expect(isoleren < pir && pir < sub && sub < voorrij).toBe(true);
    // Een regel zonder materialen of opties krijgt geen subtotaal.
    expect(html).not.toContain('Subtotaal Voorrijkosten');
  });

  it('prijstabel met bedragen en een btw-regel per tarief in totalen', () => {
    const regels = [
      regel({ omschrijving: 'A', aantalHonderdsten: 3480, prijsCent: 1250 }),
      regel({ omschrijving: 'B', btwTarief: 0, prijsCent: 5000 }),
    ];
    const html = renderOfferteHtml(
      model({ inhoud: { ...VOORBEELD_INHOUD, regels }, totalen: berekenTotalen(regels) }),
      'pdf',
    );
    expect(html).toContain(
      '<td class="omschrijving">A</td><td class="getal">34,8</td><td class="eenheid">post</td>' +
        '<td class="getal">€ 12,50</td><td class="getal">€ 435,00</td>',
    );
    expect(html).toContain('<td>Subtotaal excl. btw</td><td class="getal">€ 485,00</td>');
    expect(html).toContain('<td>Btw 21% over € 435,00</td><td class="getal">€ 91,35</td>');
    expect(html).toContain('<td>Btw 0% over € 50,00</td><td class="getal">€ 0,00</td>');
    expect(html).toContain(
      '<tr class="totaal"><td>Totaal incl. btw</td><td class="getal">€ 576,35</td></tr>',
    );

    const alleen21 = renderOfferteHtml(model(), 'pdf');
    expect(alleen21).toContain('Btw 21% over');
    expect(alleen21).not.toContain('Btw 0%');
    expect(alleen21).not.toContain('Btw 9%');
  });

  it('klantblok bij aanhef bedrijf en fam (V-22)', () => {
    expect(
      klantRegels(
        klant({ aanhef: 'bedrijf', voornaam: 'Piet', achternaam: 'Jansen', bedrijfsnaam: 'Jansen B.V.' }),
      ),
    ).toEqual(['Jansen B.V.', 't.a.v. P. Jansen', 'Lindelaan 12', '5611 AB Eindhoven']);
    expect(klantRegels(klant({ aanhef: 'fam' }))).toEqual([
      'Fam. De Vries',
      'Lindelaan 12',
      '5611 AB Eindhoven',
    ]);
    // Randgevallen: bedrijf zonder bedrijfsnaam, bedrijf zonder contactnaam.
    expect(
      klantRegels(klant({ aanhef: 'bedrijf', voornaam: 'Piet', achternaam: 'Jansen', bedrijfsnaam: ' ' }))[0],
    ).toBe('P. Jansen');
    expect(
      klantRegels(klant({ aanhef: 'bedrijf', voornaam: '', achternaam: '', bedrijfsnaam: 'Jansen B.V.' })),
    ).not.toContain('t.a.v. ');
    const html = renderOfferteHtml(
      model({
        klant: klant({
          aanhef: 'bedrijf',
          voornaam: 'Piet',
          achternaam: 'Jansen',
          bedrijfsnaam: 'Jansen B.V.',
        }),
      }),
      'pdf',
    );
    expect(html).toContain(
      '<div class="klant"><span>Jansen B.V.</span><span>t.a.v. P. Jansen</span><span>Lindelaan 12</span>' +
        '<span>5611 AB Eindhoven</span></div>',
    );
  });

  it('werkadresregel alleen bij een werkadres', () => {
    expect(renderOfferteHtml(model(), 'pdf')).not.toContain('Werkadres');
    const html = renderOfferteHtml(
      model({
        klant: klant({
          heeftWerkadres: true,
          werkadres: { straatHuisnummer: 'Kerkstraat 3', postcode: '5612 CD', plaats: 'Veldhoven' },
        }),
      }),
      'pdf',
    );
    expect(html).toContain('<p class="werkadres">Werkadres: Kerkstraat 3, Veldhoven</p>');
  });

  it('geldigheidszin onder Voorwaarden, na de betalingsvoorwaarden', () => {
    const html = renderOfferteHtml(model(), 'pdf');
    expect(html).toContain(
      '<h2>Voorwaarden</h2><p>Betaling binnen 14 dagen na oplevering en ontvangst van de factuur.</p>' +
        '<p class="geldigheid">Deze offerte is geldig tot en met 25 oktober 2026.</p>',
    );
  });

  it('ondertekening met en zonder contactpersoon', () => {
    expect(renderOfferteHtml(model(), 'pdf')).toContain(
      '<p class="ondertekening">Met vriendelijke groet,<br><br>J. Voorbeeld<br>Dakdekkersbedrijf Voorbeeld</p>',
    );
    expect(
      renderOfferteHtml(model({ bedrijf: { ...VOORBEELD_BEDRIJF, contactpersoon: '  ' } }), 'pdf'),
    ).toContain('<p class="ondertekening">Met vriendelijke groet,<br><br>Dakdekkersbedrijf Voorbeeld</p>');
  });

  it('akkoordblok met lijnen voor Naam, Datum en Handtekening', () => {
    expect(renderOfferteHtml(model(), 'pdf')).toContain(
      '<h2>Voor akkoord</h2><div class="lijnen"><div class="lijn naam"><span>Naam</span></div>' +
        '<div class="lijn datum"><span>Datum</span></div><div class="lijn handtekening"><span>Handtekening</span></div>',
    );
  });

  it('kop zonder logo, met lege bedrijfsvelden, en een onveilig logo wordt genegeerd', () => {
    const leeg = {
      ...VOORBEELD_BEDRIJF,
      naam: '',
      adres: '',
      postcode: '',
      plaats: '',
      telefoon: '',
      email: '',
      website: '',
    };
    expect(renderOfferteHtml(model({ logoDataUri: null, bedrijf: leeg }), 'pdf')).toContain(
      '<section class="kop"><div class="bedrijf"><div class="gegevens"></div></div></section>',
    );
    expect(renderOfferteHtml(model({ logoDataUri: 'https://voorbeeld.nl/logo.png' }), 'pdf')).not.toContain(
      '<img',
    );
    expect(renderOfferteHtml(model(), 'pdf')).toContain(`<img class="logo" src="${LOGO}" alt="">`);
  });

  it('OFM-030: telefoon van het bedrijf leesbaar in de kop (+31 6 12345678)', () => {
    const html = renderOfferteHtml(
      model({ bedrijf: { ...VOORBEELD_BEDRIJF, telefoon: '+31612345678' } }),
      'pdf',
    );
    expect(html).toContain('+31 6 12345678');
  });

  it('voetnoot alleen als hij is ingevuld', () => {
    expect(renderOfferteHtml(model(), 'pdf')).not.toContain('class="voetnoot"');
    expect(renderOfferteHtml(model({ voetnoot: 'Prijzen onder voorbehoud.' }), 'pdf')).toContain(
      '<section class="voetnoot"><p>Prijzen onder voorbehoud.</p></section>',
    );
  });

  it('CSS: A4, 10 pt, regelafstand 1,4, herhalende tabelkop, pagina-afbreking', () => {
    const html = renderOfferteHtml(model(), 'pdf');
    expect(html).toContain('@page { size: A4; }');
    expect(html).toContain('font-size: 10pt; line-height: 1.4;');
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('tr { break-inside: avoid; }');
    expect(html).toContain('section { margin: 0 0 14pt; break-inside: avoid-page; }');
    expect(html).toContain('section.werkomschrijving, section.prijsopgave { break-inside: auto; }');
    expect(html).not.toMatch(/<script/i);
  });

  it('accentkleur uit de opmaak, ook een eigen kleur; ongeldige waarde valt terug op de standaard', () => {
    expect(
      renderOfferteHtml(
        model({ opmaak: { layout: 'modern', accentkleur: '#a1b2c3', lettertype: 'inter' } }),
        'pdf',
      ),
    ).toContain('--accent: #A1B2C3;');
    expect(
      renderOfferteHtml(
        model({ opmaak: { layout: 'modern', accentkleur: 'red;}', lettertype: 'inter' } }),
        'pdf',
      ),
    ).toContain(`--accent: ${STANDAARD_ACCENTKLEUR};`);
    expect(veiligeAccentkleur('#1f4e79')).toBe('#1F4E79');
    expect(VASTE_ACCENTKLEUREN.map((k) => k.kleur)).toEqual([
      '#1F4E79',
      '#2E7D32',
      '#B71C1C',
      '#E65100',
      '#37474F',
      '#6A1B9A',
    ]);
  });

  it('lettertypes: Merriweather voor koppen met Inter voor tekst', () => {
    const html = renderOfferteHtml(
      model({ opmaak: { layout: 'klassiek', accentkleur: '#1F4E79', lettertype: 'merriweather' } }),
      'pdf',
    );
    expect(html).toContain("--font-tekst: 'Inter', sans-serif; --font-kop: 'Merriweather', serif;");
    expect(
      renderOfferteHtml(
        model({ opmaak: { layout: 'klassiek', accentkleur: '#1F4E79', lettertype: 'source-sans-3' } }),
        'pdf',
      ),
    ).toContain("--font-tekst: 'Source Sans 3', sans-serif; --font-kop: 'Source Sans 3', sans-serif;");
    expect(LETTERTYPES.merriweather.bestanden.map((b) => b.bestand)).toEqual([
      'merriweather-latin-400-normal.woff2',
      'merriweather-latin-700-normal.woff2',
      'inter-latin-400-normal.woff2',
      'inter-latin-700-normal.woff2',
    ]);
    expect(ALLE_FONTBESTANDEN.map((b) => b.bestand)).toEqual([
      'inter-latin-400-normal.woff2',
      'inter-latin-700-normal.woff2',
      'merriweather-latin-400-normal.woff2',
      'merriweather-latin-700-normal.woff2',
      'source-sans-3-latin-400-normal.woff2',
      'source-sans-3-latin-700-normal.woff2',
    ]);
  });

  it('fontCss kan de <style> niet afsluiten', () => {
    const html = renderOfferteHtml(model({ fontCss: '</style><script>x</script>' }), 'pdf');
    expect(html).not.toContain('<script>');
  });

  it.each(LAYOUTS)('verwijst nergens naar een externe bron (lay-out %s, NFE-009)', (layout) => {
    for (const modus of ['pdf', 'voorbeeld'] as const) {
      const html = renderOfferteHtml(
        model({ nummer: null, opmaak: { layout, accentkleur: '#1F4E79', lettertype: 'merriweather' } }),
        modus,
      );
      expect(html).not.toMatch(/https?:|file:/i);
    }
  });
});

describe('hulpfuncties', () => {
  it('alineas', () => {
    expect(alineas('')).toBe('');
    expect(alineas('a\r\nb\r\n\r\n\r\nc & d')).toBe('<p>a<br>b</p><p>c &amp; d</p>');
  });

  it('voettekstRegel laat lege delen weg', () => {
    expect(voettekstRegel({ kvk: '123', btwNummer: ' ', iban: 'NL00' })).toBe('KvK 123 · IBAN NL00');
    expect(voettekstRegel({ kvk: '', btwNummer: '', iban: '' })).toBe('');
  });
});

describe('opmaakVoorbeeldModel', () => {
  const opmaak = { layout: 'compact', accentkleur: '#6A1B9A', lettertype: 'inter' } as const;
  const leegBedrijf = { ...VOORBEELD_BEDRIJF, naam: '', contactpersoon: '' };

  it('gebruikt het voorbeeldbedrijf zonder logo als er geen bedrijfsnaam is', () => {
    const m = opmaakVoorbeeldModel({
      bedrijf: leegBedrijf,
      logoDataUri: LOGO,
      opmaak,
      fontCss: FONT_CSS,
      teksten: TEKSTEN,
      vandaag: '2026-09-25',
    });
    expect(m.bedrijf).toBe(VOORBEELD_BEDRIJF);
    expect(m.logoDataUri).toBeNull();
    expect(m.nummer).toBe('2026-09-25-001');
    expect(m.geldigTot).toBe('2026-10-25');
    expect(m.aanhefregel).toBe('Geachte familie De Vries,');
    expect(m.totalen.totaalCent).toBeGreaterThan(0);
  });

  it('gebruikt de echte bedrijfsgegevens en het logo als die zijn ingevuld', () => {
    const echt = { ...VOORBEELD_BEDRIJF, naam: 'Echt Dak' };
    const m = opmaakVoorbeeldModel({
      bedrijf: echt,
      logoDataUri: LOGO,
      opmaak,
      fontCss: FONT_CSS,
      teksten: TEKSTEN,
      vandaag: '2026-09-25',
    });
    expect(m.bedrijf).toBe(echt);
    expect(m.logoDataUri).toBe(LOGO);
    const html = renderOfferteHtml(m, 'voorbeeld');
    expect(html).toContain('Echt Dak');
    expect(html).not.toContain('class="watermerk"');
  });
});
