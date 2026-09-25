import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLE_FONTBESTANDEN } from '@shared/pdf-template/lettertypes';

const root = join(import.meta.dirname, '..', '..', '..');
const nep = vi.hoisted(() => ({ app: { isPackaged: false, getAppPath: (): string => '' } }));
vi.mock('electron', () => nep);

const fs = vi.hoisted(() => ({ gelezen: [] as string[] }));
vi.mock('node:fs', async (origineel) => {
  const echt = await origineel<typeof import('node:fs')>();
  return {
    ...echt,
    readFileSync: (pad: string) => {
      fs.gelezen.push(pad);
      return echt.readFileSync(pad);
    },
  };
});

const { fontCss, fontMap, leegFontCache } = await import('./fonts');

afterEach(() => {
  leegFontCache();
  fs.gelezen.length = 0;
  nep.app.isPackaged = false;
});

describe('fontMap', () => {
  it('dev: resources/fonts in de projectmap', () => {
    nep.app.getAppPath = () => root;
    expect(fontMap()).toBe(join(root, 'resources', 'fonts'));
  });

  it('productie: process.resourcesPath/fonts', () => {
    nep.app.isPackaged = true;
    const oud = process.resourcesPath;
    Object.defineProperty(process, 'resourcesPath', { value: 'C:\\app\\resources', configurable: true });
    try {
      expect(fontMap()).toBe(join('C:\\app\\resources', 'fonts'));
    } finally {
      Object.defineProperty(process, 'resourcesPath', { value: oud, configurable: true });
    }
  });
});

describe('fontCss', () => {
  it('levert @font-face met data-URI voor Inter 400 en 700', () => {
    nep.app.getAppPath = () => root;
    const css = fontCss('inter');
    const inter400 = readFileSync(join(root, 'resources', 'fonts', 'inter-latin-400-normal.woff2')).toString(
      'base64',
    );
    expect(css).toContain(
      `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; font-display: block; ` +
        `src: url(data:font/woff2;base64,${inter400}) format('woff2'); }`,
    );
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain('font-weight: 700');
    expect(css).not.toMatch(/https?:|file:/);
  });

  it('Merriweather neemt Inter mee voor de tekst; elk bestand wordt maar één keer gelezen', () => {
    nep.app.getAppPath = () => root;
    const eerste = fontCss('merriweather');
    expect(eerste).toContain("font-family: 'Merriweather'");
    expect(eerste).toContain("font-family: 'Inter'");
    fontCss('inter');
    fontCss('merriweather');
    expect(fs.gelezen).toHaveLength(4);
  });

  it('alle zes bestanden staan in resources/fonts', () => {
    nep.app.getAppPath = () => root;
    expect(fontCss('source-sans-3')).toContain("font-family: 'Source Sans 3'");
    for (const f of ALLE_FONTBESTANDEN) {
      expect(readFileSync(join(root, 'resources', 'fonts', f.bestand)).byteLength).toBeGreaterThan(1000);
    }
  });
});
