import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

// Rooktest (V-04): bewijst dat de Electron-build van better-sqlite3 onder vitest laadt
// (vitest draait met ELECTRON_RUN_AS_NODE=1 onder Electron).
describe('better-sqlite3', () => {
  it('opent een in-memory database', () => {
    const db = new Database(':memory:');
    try {
      const rij = db.prepare('SELECT 1 + 1 AS uitkomst').get() as { uitkomst: number };
      expect(rij.uitkomst).toBe(2);
      expect(process.versions.electron).toBeDefined();
    } finally {
      db.close();
    }
  });
});
