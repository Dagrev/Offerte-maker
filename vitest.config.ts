import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// Draait onder Electron-als-Node (zie `test` in package.json, V-04), zodat better-sqlite3 met de
// Electron-ABI laadt.
const nietTesten = ['.trees/**', '.claude/**', 'out/**', 'dist/**', 'release/**', 'test/e2e/**'];

export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(import.meta.dirname, 'src/shared') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...nietTesten],
    coverage: {
      provider: 'v8',
      include: ['src/main/**', 'src/shared/**'],
      exclude: [
        ...nietTesten,
        '**/*.test.ts',
        '**/*.d.ts',
        // App-lifecycle; wordt gedekt door de E2E-tests (Playwright), niet door unit-tests.
        'src/main/index.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        'src/shared/calc/**': { branches: 100 },
        'src/shared/validatie.ts': { branches: 100 },
        // OFM-045: de omzetting van oude offertes (migratie 005).
        'src/shared/omzetting.ts': { branches: 100 },
        // OFM-046: alle vormen van de klantnaam.
        'src/shared/naam.ts': { branches: 100 },
      },
    },
  },
});
