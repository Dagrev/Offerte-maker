import { describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { IPC_KANALEN, type Kanaal } from '@shared/ipcKanalen';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../log', () => ({ log: nepLog }));
vi.mock('../db/repo/instellingen', () => ({ haalInstelling: () => ({ welkomVoltooid: true }) }));
vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3', getPath: () => 'C:\\x', isPackaged: false },
}));

const { alleHandlers, maakIpcHandler, registreerIpc } = await import('./registreer');
const domeinen = await Promise.all(
  [
    './app',
    './welkom',
    './overzicht',
    './offerteInvoer',
    './offerteAgent',
    './offerteInhoud',
    './offerteDefinitief',
    './offerteBeheer',
    './instellingen',
    './prijzen',
    './voorbeelden',
    './claude',
    './privacylog',
    './backup',
  ].map((pad) => import(pad) as Promise<Record<string, Record<string, unknown>>>),
);

type Aanroep = (event: IpcMainInvokeEvent, invoer: unknown) => Promise<unknown>;
const event = {} as IpcMainInvokeEvent;

function registreerMetSpies() {
  const geregistreerd = new Map<string, Aanroep>();
  const spies = Object.fromEntries(IPC_KANALEN.map((k) => [k, vi.fn(() => null)])) as unknown as Record<
    Kanaal,
    ReturnType<typeof vi.fn>
  >;
  const ipc: Pick<IpcMain, 'handle'> = {
    handle: (kanaal, fn) => {
      geregistreerd.set(kanaal, fn as Aanroep);
    },
  };
  registreerIpc(ipc, spies as never);
  return { geregistreerd, spies };
}

describe('registreerIpc', () => {
  it('registreert elk kanaal precies één keer', () => {
    const { geregistreerd } = registreerMetSpies();
    expect([...geregistreerd.keys()].sort()).toEqual([...IPC_KANALEN].sort());
  });

  it('elk kanaal staat in precies één domeinbestand (V-03)', () => {
    const sleutels = domeinen.flatMap((mod) => Object.values(mod).flatMap((h) => Object.keys(h)));
    expect(sleutels.length).toBe(IPC_KANALEN.length);
    expect(new Set(sleutels)).toEqual(new Set(IPC_KANALEN));
  });

  it.each(IPC_KANALEN)(
    'NFE-014: %s weigert ongeldige invoer zonder de handler aan te roepen',
    async (kanaal) => {
      const { geregistreerd, spies } = registreerMetSpies();
      const resultaat = await geregistreerd.get(kanaal)?.(event, 12345);
      expect(resultaat).toEqual({ ok: false, fout: { code: 'VALIDATIE', melding: 'Ongeldige invoer.' } });
      expect(spies[kanaal]).not.toHaveBeenCalled();
    },
  );
});

describe('maakIpcHandler', () => {
  it('geeft gevalideerde invoer door en verpakt de uitkomst', async () => {
    const handler = vi.fn(() => ({ controlepunten: 2 }));
    const uitvoeren = maakIpcHandler('offerte:maak', handler);
    expect(await uitvoeren(event, { id: 'o1', extra: 'weg' })).toEqual({
      ok: true,
      data: { controlepunten: 2 },
    });
    expect(handler).toHaveBeenCalledWith({ id: 'o1' }, event);
  });

  it('zet een exception om in ONBEKEND en logt zonder invoerwaarden', async () => {
    const uitvoeren = maakIpcHandler('offerte:haal', () => {
      throw new Error('kapot');
    });
    expect(await uitvoeren(event, { id: 'o7' })).toEqual({
      ok: false,
      fout: { code: 'ONBEKEND', melding: 'Er ging iets mis. Je werk is bewaard.' },
    });
    expect(nepLog.error).toHaveBeenCalledWith('ipc offerte:haal: ONBEKEND offerte=o7', expect.any(Error));
  });

  it('zet een AppFout om in zijn code en melding', async () => {
    const uitvoeren = maakIpcHandler('offerte:openPdf', () => {
      throw new AppFout('PDF_BESTAND_BEZET');
    });
    expect(await uitvoeren(event, { id: 'o2' })).toEqual({
      ok: false,
      fout: {
        code: 'PDF_BESTAND_BEZET',
        melding: 'Het bestand is nog open in een ander programma. Sluit het en druk op Opnieuw.',
      },
    });
    expect(nepLog.warn).toHaveBeenCalledWith('ipc offerte:openPdf: PDF_BESTAND_BEZET offerte=o2');
  });

  it('logt bij ongeldige invoer alleen pad en soort, geen waarden', async () => {
    nepLog.warn.mockClear();
    const uitvoeren = maakIpcHandler('overzicht:zoek', vi.fn());
    await uitvoeren(event, { tekst: '' });
    const regel = String(nepLog.warn.mock.calls[0]?.[0]);
    expect(regel).toBe('ipc overzicht:zoek: VALIDATIE (tekst: too_small)');
  });

  it('logt zonder offerte-ID als de invoer geen id heeft', async () => {
    const uitvoeren = maakIpcHandler('backup:maak', () => {
      throw new AppFout('BACKUP_MISLUKT');
    });
    await uitvoeren(event, undefined);
    expect(nepLog.warn).toHaveBeenCalledWith('ipc backup:maak: BACKUP_MISLUKT');
  });
});

describe('standaardhandlers', () => {
  it('app:info levert versie, welkomVoltooid, vandaag en de mappen', async () => {
    const resultaat = await maakIpcHandler('app:info', alleHandlers['app:info'])(event, undefined);
    expect(resultaat).toMatchObject({
      ok: true,
      data: { versie: '1.2.3', welkomVoltooid: true },
    });
    if (!resultaat.ok) throw new Error('verwacht ok');
    expect(resultaat.data.vandaag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof resultaat.data.dataMap).toBe('string');
    expect(typeof resultaat.data.documentenMap).toBe('string');
  });

  it('stubs geven VALIDATIE "Nog niet beschikbaar."', async () => {
    const resultaat = await maakIpcHandler(
      'offerte:maakZonderClaude',
      alleHandlers['offerte:maakZonderClaude'],
    )(event, { id: 'o1' });
    expect(resultaat).toEqual({ ok: false, fout: { code: 'VALIDATIE', melding: 'Nog niet beschikbaar.' } });
  });
});
