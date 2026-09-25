import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: (naam: string) =>
      naam === 'userData' ? 'C:\\Users\\x\\AppData\\Roaming\\Offerte maker' : 'C:\\Users\\x\\Documents',
  },
}));

const { berekenPaden, maakMappenAan, paden } = await import('./paden');

const userData = 'C:\\Users\\x\\AppData\\Roaming\\Offerte maker';
const documenten = 'C:\\Users\\x\\Documents';

describe('berekenPaden', () => {
  it('gebruikt standaard userData en Documenten\\Offertes', () => {
    const p = berekenPaden({ userData, documenten, env: {} });
    expect(p.dataMap).toBe(userData);
    expect(p.database).toBe(join(userData, 'offerte-maker.sqlite'));
    expect(p.logMap).toBe(join(userData, 'logs'));
    expect(p.tmpMap).toBe(join(userData, 'tmp'));
    expect(p.agentMap).toBe(join(userData, 'agent'));
    expect(p.documentenMap).toBe(join(documenten, 'Offertes'));
    expect(p.pdfMap(2026)).toBe(join(documenten, 'Offertes', '2026'));
    expect(p.backupMap).toBe(join(documenten, 'Offertes', 'Back-ups'));
  });

  it('OFFERTE_MAKER_DATA verschuift dataMap en alles eronder', () => {
    const data = resolve('D:\\test\\data');
    const p = berekenPaden({ userData, documenten, env: { OFFERTE_MAKER_DATA: data } });
    expect(p.dataMap).toBe(data);
    expect(p.database).toBe(join(data, 'offerte-maker.sqlite'));
    expect(p.logMap).toBe(join(data, 'logs'));
    expect(p.tmpMap).toBe(join(data, 'tmp'));
    expect(p.agentMap).toBe(join(data, 'agent'));
    expect(p.documentenMap).toBe(join(documenten, 'Offertes'));
  });

  it('OFFERTE_MAKER_DOCS vervangt de hele Offertes-map', () => {
    const docs = resolve('D:\\test\\docs');
    const p = berekenPaden({ userData, documenten, env: { OFFERTE_MAKER_DOCS: docs } });
    expect(p.dataMap).toBe(userData);
    expect(p.documentenMap).toBe(docs);
    expect(p.pdfMap(2027)).toBe(join(docs, '2027'));
    expect(p.backupMap).toBe(join(docs, 'Back-ups'));
  });

  it('negeert lege overrides', () => {
    const p = berekenPaden({
      userData,
      documenten,
      env: { OFFERTE_MAKER_DATA: '  ', OFFERTE_MAKER_DOCS: '' },
    });
    expect(p.dataMap).toBe(userData);
    expect(p.documentenMap).toBe(join(documenten, 'Offertes'));
  });

  it('exporteert één object op basis van app.getPath', () => {
    expect(paden.dataMap).toBe(
      process.env['OFFERTE_MAKER_DATA'] ? resolve(process.env['OFFERTE_MAKER_DATA']) : userData,
    );
  });
});

describe('maakMappenAan', () => {
  let basis = '';
  afterEach(() => rmSync(basis, { recursive: true, force: true }));

  it('maakt alle mappen aan en maakt tmp leeg', async () => {
    basis = mkdtempSync(join(tmpdir(), 'ofm-paden-'));
    const p = berekenPaden({
      userData: join(basis, 'data'),
      documenten: join(basis, 'docs'),
      env: {},
    });
    mkdirSync(p.tmpMap, { recursive: true });
    writeFileSync(join(p.tmpMap, 'oud.txt'), 'weg');

    await maakMappenAan(p);

    for (const map of [p.dataMap, p.logMap, p.tmpMap, p.agentMap, p.documentenMap, p.backupMap]) {
      expect(existsSync(map)).toBe(true);
    }
    expect(readdirSync(p.tmpMap)).toEqual([]);
  });
});
