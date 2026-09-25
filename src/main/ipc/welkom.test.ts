import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-023: `welkom:voltooi` en `app:info.welkomVoltooid` (TDO §6.2, §13.4, FE-003, FE-004).

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getVersion: () => '0.1.0' },
  shell: { openPath: vi.fn() },
}));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { maakIpcHandler } = await import('./registreer');
const { welkomHandlers } = await import('./welkom');
const { appHandlers } = await import('./app');
const { bewaarInstelling, haalInstelling } = await import('../db/repo/instellingen');
const { openDatabase, gebruikDatabase } = await import('../db/verbinding');
const { standaardInstelling } = await import('@shared/schemas');

const event = {} as never;
const info = maakIpcHandler('app:info', appHandlers['app:info']);
const voltooi = maakIpcHandler('welkom:voltooi', welkomHandlers['welkom:voltooi']);

let t: TestDatabase;
let heropend: ReturnType<typeof openDatabase> | null = null;
beforeEach(async () => {
  t = await maakTestDatabase();
});
afterEach(() => {
  if (heropend?.open) heropend.close();
  heropend = null;
  t.opruimen();
});

/** Database sluiten en opnieuw openen, zoals bij een herstart van de app. */
function herstart(): void {
  t.db.close();
  heropend = openDatabase(t.pad);
  gebruikDatabase(heropend);
}

describe('welkomstscherm (FE-003, FE-004)', () => {
  it('lege database: app:info geeft welkomVoltooid false met de vaste velden', async () => {
    const uit = await info(event, undefined);
    expect(uit).toMatchObject({ ok: true, data: { versie: '0.1.0', welkomVoltooid: false } });
    expect(uit.ok && Object.keys(uit.data).sort()).toEqual(
      ['dataMap', 'documentenMap', 'vandaag', 'versie', 'welkomVoltooid'].sort(),
    );
  });

  it('welkom:voltooi zet app.welkomVoltooid; na een herstart blijft dat zo', async () => {
    expect(await voltooi(event, undefined)).toEqual({ ok: true, data: null });
    expect(haalInstelling('app').welkomVoltooid).toBe(true);
    herstart();
    expect(await info(event, undefined)).toMatchObject({ ok: true, data: { welkomVoltooid: true } });
  });

  it('halverwege afsluiten: welkomstscherm komt terug, ingevulde bedrijfsgegevens zijn bewaard', async () => {
    bewaarInstelling('bedrijf', { ...standaardInstelling('bedrijf'), naam: 'Dakwerken Zuid' });
    herstart();
    expect(await info(event, undefined)).toMatchObject({ ok: true, data: { welkomVoltooid: false } });
    expect(haalInstelling('bedrijf').naam).toBe('Dakwerken Zuid');
  });

  it('twee keer voltooien is geen fout; ongeldige invoer wordt geweigerd (NFE-014)', async () => {
    expect(await voltooi(event, {})).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    expect(haalInstelling('app').welkomVoltooid).toBe(false);
    await voltooi(event, undefined);
    expect(await voltooi(event, undefined)).toEqual({ ok: true, data: null });
    expect(haalInstelling('app').welkomVoltooid).toBe(true);
  });
});
