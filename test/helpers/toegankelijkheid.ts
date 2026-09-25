import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Toegankelijkheid per scherm (NFE-005, OFM-027): axe-core (WCAG 2.1 A/AA) zonder het iframe met het
// PDF-voorbeeld (V-24), plus een stijlcontrole: basisfont ≥ 18 px en klikbare elementen ≥ 48 × 48 px.

export const MIN_FONT_PX = 18;
export const MIN_DOEL_PX = 48;

export interface Schermuitkomst {
  scherm: string;
  /** Alle axe-overtredingen: `regel (aantal knopen)`. */
  axe: string[];
  contrastfouten: number;
  basisfontPx: number;
  /** Klikbare elementen kleiner dan 48 × 48 px. */
  teKlein: string[];
  aantalKlikbaar: number;
}

interface Rechthoek {
  width: number;
  height: number;
}
interface MiniElement {
  tagName: string;
  id: string;
  textContent: string | null;
  parentElement: MiniElement | null;
  getAttribute: (naam: string) => string | null;
  getBoundingClientRect: () => Rechthoek;
  closest: (selector: string) => MiniElement | null;
  getClientRects: () => { length: number };
}
interface MiniDocument {
  body: MiniElement;
  documentElement: MiniElement;
  querySelectorAll: (selector: string) => ArrayLike<MiniElement>;
  querySelector: (selector: string) => MiniElement | null;
}
interface MiniVenster {
  document: MiniDocument;
  getComputedStyle: (el: MiniElement) => { fontSize: string; visibility: string; display: string };
}

/** Meet in de pagina: font-size van body en de afmetingen van alle zichtbare klikbare elementen. */
async function stijlcontrole(
  page: Page,
): Promise<{ basisfontPx: number; teKlein: string[]; aantal: number }> {
  return page.evaluate(
    ([minDoel]) => {
      const w = globalThis as unknown as MiniVenster;
      const doc = w.document;
      // Basisfont = de lettergrootte van body (`--text-base`); html blijft 16 px als rem-basis.
      const basisfontPx = parseFloat(w.getComputedStyle(doc.body).fontSize);
      const selector =
        'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
      const teKlein: string[] = [];
      let aantal = 0;
      for (const el of Array.from(doc.querySelectorAll(selector))) {
        if (el.getClientRects().length === 0) continue; // niet weergegeven
        const stijl = w.getComputedStyle(el);
        if (stijl.visibility === 'hidden') continue;
        // Een vinkje of keuzerondje wordt via zijn label aangeklikt; dan telt het label.
        let doel: MiniElement = el;
        const type = el.getAttribute('type');
        if (el.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio')) {
          doel = el.closest('label') ?? (el.id ? doc.querySelector(`label[for="${el.id}"]`) : null) ?? el;
        }
        const r = doel.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) continue; // sr-only
        aantal += 1;
        if (r.width < minDoel || r.height < minDoel) {
          const naam =
            el.getAttribute('aria-label') ??
            (el.textContent ?? '').trim().slice(0, 40) ??
            el.getAttribute('type');
          teKlein.push(
            `${el.tagName.toLowerCase()} "${naam}" ${Math.round(r.width)}×${Math.round(r.height)}`,
          );
        }
      }
      return { basisfontPx, teKlein, aantal };
    },
    [MIN_DOEL_PX] as const,
  );
}

/** axe + stijlcontrole op het huidige scherm; voegt de uitkomst toe aan `uitkomsten`. */
export async function controleerScherm(
  page: Page,
  scherm: string,
  uitkomsten: Schermuitkomst[],
): Promise<Schermuitkomst> {
  // Even laten uitrusten: geen animatie of laadtekst halverwege meten.
  await page.waitForTimeout(150);
  // Legacy-modus: de standaardmodus opent een extra pagina (Target.createTarget), wat Electron niet kan.
  const resultaat = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe')
    .analyze();
  const stijl = await stijlcontrole(page);
  const uitkomst: Schermuitkomst = {
    scherm,
    axe: resultaat.violations.map(
      (v) =>
        `${v.id} (${v.nodes.length}): ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    ),
    contrastfouten: resultaat.violations
      .filter((v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced')
      .reduce((som, v) => som + v.nodes.length, 0),
    basisfontPx: stijl.basisfontPx,
    teKlein: stijl.teKlein,
    aantalKlikbaar: stijl.aantal,
  };
  uitkomsten.push(uitkomst);
  await test.info().attach(`a11y ${scherm}`, {
    body: JSON.stringify(uitkomst, null, 2),
    contentType: 'application/json',
  });
  expect.soft(uitkomst.contrastfouten, `contrastfouten op ${scherm}`).toBe(0);
  expect.soft(uitkomst.axe, `axe-overtredingen op ${scherm}`).toEqual([]);
  expect.soft(uitkomst.basisfontPx, `basisfont op ${scherm}`).toBeGreaterThanOrEqual(MIN_FONT_PX);
  expect.soft(uitkomst.teKlein, `klikdoelen < 48 px op ${scherm}`).toEqual([]);
  return uitkomst;
}
