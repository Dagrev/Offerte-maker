import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const alias = { '@shared': resolve(import.meta.dirname, 'src/shared') };

// Alleen in dev: de <meta>-CSP uit index.html halen. Main zet dan via de responseheader een CSP
// die de dev-server, ws: en de inline React Refresh-preamble toestaat (src/main/venster.ts).
const devZonderMetaCsp: Plugin = {
  name: 'offerte-maker-dev-zonder-meta-csp',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\s*/, ''),
};

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      // Gesandboxte preload (OFM-002 zet sandbox: true): één CommonJS-bundel, zonder externe modules
      // behalve `electron` zelf.
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: '[name].cjs', inlineDynamicImports: true },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    resolve: { alias },
    plugins: [devZonderMetaCsp, react(), tailwindcss()],
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/renderer/index.html') } },
    },
  },
});
