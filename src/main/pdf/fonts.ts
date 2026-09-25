import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { LETTERTYPES, type Lettertype } from '@shared/pdf-template/lettertypes';

// Lettertypes voor PDF en voorbeeld als @font-face met data-URI's (TDO §12.2, §16, NFE-009/021).
// Bron: in dev `resources/fonts` in de projectmap, in productie `process.resourcesPath/fonts`
// (extraResources in electron-builder.yml). Elk bestand wordt één keer gelezen en gecachet.

export function fontMap(): string {
  return app.isPackaged ? join(process.resourcesPath, 'fonts') : join(app.getAppPath(), 'resources', 'fonts');
}

const cache = new Map<string, string>();

function base64(bestand: string): string {
  let data = cache.get(bestand);
  if (data === undefined) {
    data = readFileSync(join(fontMap(), bestand)).toString('base64');
    cache.set(bestand, data);
  }
  return data;
}

/** De `@font-face`-regels voor één lettertype-instelling (inclusief Inter voor tekst bij Merriweather). */
export function fontCss(lettertype: Lettertype): string {
  return LETTERTYPES[lettertype].bestanden
    .map(
      (f) =>
        `@font-face { font-family: '${f.familie}'; font-style: normal; font-weight: ${f.gewicht}; ` +
        `font-display: block; src: url(data:font/woff2;base64,${base64(f.bestand)}) format('woff2'); }`,
    )
    .join('\n');
}

/** Alleen voor tests. */
export function leegFontCache(): void {
  cache.clear();
}
