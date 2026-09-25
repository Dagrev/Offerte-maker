import { defineConfig } from '@playwright/test';

// Alleen test/e2e: zo worden worktrees in .trees/ en .claude/ nooit meegenomen (NFE-023).
export default defineConfig({
  testDir: 'test/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
});
