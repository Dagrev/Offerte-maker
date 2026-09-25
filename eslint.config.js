// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const verbodenInRendererEnShared = {
  paths: [
    { name: 'electron', message: 'Alleen main en preload mogen electron importeren.' },
    { name: 'better-sqlite3', message: 'Alleen main mag de database gebruiken.' },
  ],
  patterns: [{ group: ['node:*'], message: 'Geen Node-modules in shared of renderer.' }],
};

export default defineConfig(
  // Worktrees (.trees, .claude) en build-/testuitvoer nooit linten (NFE-023).
  globalIgnores([
    'node_modules/',
    'out/',
    'dist/',
    'release/',
    'coverage/',
    'test-results/',
    'playwright-report/',
    '.trees/',
    '.claude/',
  ]),
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactHooks.configs.flat.recommended,
  {
    files: ['src/shared/**', 'src/renderer/**'],
    rules: {
      'no-restricted-imports': ['error', verbodenInRendererEnShared],
    },
  },
  {
    // Losse JS-bestanden (configuratie, scripts, nep-CLI) vallen buiten de tsconfigs.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
