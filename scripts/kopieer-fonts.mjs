// Kopieert de PDF-lettertypes uit @fontsource naar resources/fonts/ (TDO §2.4, §16, V-22).
// Alleen de latin-subset in gewicht 400 en 700. De gekopieerde bestanden worden gecommit;
// draai dit script opnieuw na een update van een @fontsource-pakket:
//   node scripts/kopieer-fonts.mjs
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const doel = join(root, 'resources', 'fonts');

/** [pakket, bestand] — precies deze zes (V-22); `src/main/pdf/fonts.ts` verwacht dezelfde namen. */
const FONTS = [
  ['inter', 'inter-latin-400-normal.woff2'],
  ['inter', 'inter-latin-700-normal.woff2'],
  ['merriweather', 'merriweather-latin-400-normal.woff2'],
  ['merriweather', 'merriweather-latin-700-normal.woff2'],
  ['source-sans-3', 'source-sans-3-latin-400-normal.woff2'],
  ['source-sans-3', 'source-sans-3-latin-700-normal.woff2'],
];

mkdirSync(doel, { recursive: true });
for (const [pakket, bestand] of FONTS) {
  copyFileSync(join(root, 'node_modules', '@fontsource', pakket, 'files', bestand), join(doel, bestand));
  console.log(`gekopieerd: ${bestand}`);
}
