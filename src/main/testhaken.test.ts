import { afterEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({ app: { isPackaged: false } }));
vi.mock('electron', () => electron);

async function laadMet(waarde: string | undefined, verpakt: boolean) {
  vi.resetModules();
  electron.app.isPackaged = verpakt;
  if (waarde === undefined) delete process.env['OFFERTE_MAKER_TESTHAAK'];
  else process.env['OFFERTE_MAKER_TESTHAAK'] = waarde;
  return import('./testhaken');
}

const origineel = process.env['OFFERTE_MAKER_TESTHAAK'];
afterEach(() => {
  vi.useRealTimers();
  if (origineel === undefined) delete process.env['OFFERTE_MAKER_TESTHAAK'];
  else process.env['OFFERTE_MAKER_TESTHAAK'] = origineel;
});

describe('leesTesthaken', () => {
  it('leest vlaggen en waarden, kommagescheiden', async () => {
    const { leesTesthaken } = await laadMet(undefined, false);
    const haken = leesTesthaken(
      ' pdf-bezet , vandaag=2026-03-01,agent-timeout=500,ipc-fout,privacyfilter-uit',
      false,
    );
    expect(haken.get('pdf-bezet')).toBe(true);
    expect(haken.get('vandaag')).toBe('2026-03-01');
    expect(haken.get('agent-timeout')).toBe('500');
    expect(haken.get('ipc-fout')).toBe(true);
    expect(haken.get('privacyfilter-uit')).toBe(true);
  });

  it('negeert onbekende haken en een lege waarde', async () => {
    const { leesTesthaken } = await laadMet(undefined, false);
    expect([...leesTesthaken('onbekend,,x=1', false).keys()]).toEqual([]);
    expect(leesTesthaken(undefined, false).size).toBe(0);
  });

  it('doet niets in een verpakte app', async () => {
    const { leesTesthaken } = await laadMet(undefined, false);
    expect(leesTesthaken('pdf-bezet,vandaag=2026-03-01', true).size).toBe(0);
  });
});

describe('testhaak en vandaag', () => {
  it('leest OFFERTE_MAKER_TESTHAAK bij het laden', async () => {
    const { testhaak, vandaag } = await laadMet('vandaag=2026-02-14,pdf-bezet', false);
    expect(testhaak('pdf-bezet')).toBe(true);
    expect(testhaak('ipc-fout')).toBe(false);
    expect(vandaag()).toBe('2026-02-14');
  });

  it('heeft geen effect als app.isPackaged', async () => {
    const { testhaak, vandaag, lokaleDatum } = await laadMet('vandaag=2026-02-14,pdf-bezet', true);
    expect(testhaak('pdf-bezet')).toBe(false);
    expect(vandaag()).toBe(lokaleDatum(new Date()));
  });

  it('vandaag() zonder haak geeft de lokale datum', async () => {
    const { vandaag } = await laadMet(undefined, false);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30));
    expect(vandaag()).toBe('2026-01-05');
  });

  it('negeert een ongeldige vandaag-waarde', async () => {
    const { vandaag, zetTesthakenVoorTest, lokaleDatum } = await laadMet(undefined, false);
    zetTesthakenVoorTest(new Map([['vandaag', '5 januari']]));
    expect(vandaag()).toBe(lokaleDatum(new Date()));
  });

  it('lokaleDatum gebruikt lokale tijd met voorloopnullen', async () => {
    const { lokaleDatum } = await laadMet(undefined, false);
    expect(lokaleDatum(new Date(2026, 8, 3))).toBe('2026-09-03');
  });
});
