import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { standaardInstelling } from '@shared/schemas';
import type { Prijspost } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: nepLog }));

const { bewaarInstelling, haalInstelling, wijzigInstelling } = await import('./repo/instellingen');
const { bewaarPrijspost, haalPrijspost, haalPrijspostOpSleutel, lijstPrijsposten, verwijderPrijspost } =
  await import('./repo/prijsposten');
const { gebruikDatabase, openDatabase } = await import('./verbinding');

let t: TestDatabase;
beforeEach(async () => {
  t = await maakTestDatabase();
  nepLog.warn.mockClear();
});
afterEach(() => t.opruimen());

describe('instellingen (§4.3)', () => {
  it('ontbrekende sleutels geven de standaardwaarden en worden niet opgeslagen (V-13)', () => {
    expect(haalInstelling('bedrijf')).toEqual(standaardInstelling('bedrijf'));
    expect(haalInstelling('opmaak')).toEqual({
      layout: 'klassiek',
      accentkleur: '#1F4E79',
      lettertype: 'inter',
    });
    expect(haalInstelling('claude')).toEqual({
      pad: null,
      model: 'opus',
      effort: 'medium',
      apiSleutelVersleuteld: null,
    });
    expect(haalInstelling('app')).toEqual({
      welkomVoltooid: false,
      laatsteBackupDatum: null,
      laatsteClaudeFout: null,
    });
    const teksten = haalInstelling('teksten');
    expect(teksten.geldigheidDagen).toBe(30);
    expect(teksten.betalingsvoorwaarden).toBe(
      'Betaling binnen 14 dagen na oplevering en ontvangst van de factuur.',
    );
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM instellingen').get()).toEqual({ n: 0 });
  });

  it('bewaart en leest terug, ook na sluiten en opnieuw openen', () => {
    bewaarInstelling('opmaak', { layout: 'modern', accentkleur: '#2E7D32', lettertype: 'merriweather' });
    t.db.close();
    const opnieuw = openDatabase(t.pad);
    gebruikDatabase(opnieuw);
    expect(haalInstelling('opmaak')).toEqual({
      layout: 'modern',
      accentkleur: '#2E7D32',
      lettertype: 'merriweather',
    });
    opnieuw.close();
  });

  it('wijzigInstelling past een deel aan', () => {
    expect(wijzigInstelling('app', { welkomVoltooid: true }).welkomVoltooid).toBe(true);
    expect(haalInstelling('app')).toEqual({
      welkomVoltooid: true,
      laatsteBackupDatum: null,
      laatsteClaudeFout: null,
    });
  });

  it('ongeldige opgeslagen waarde: waarschuwing zonder waarde, standaard, rij blijft staan (V-12)', () => {
    const geheim = '{"layout":"geheim-onzin"}';
    t.db.prepare("INSERT INTO instellingen (sleutel, waarde_json) VALUES ('opmaak', ?)").run(geheim);
    expect(haalInstelling('opmaak')).toEqual(standaardInstelling('opmaak'));
    expect(nepLog.warn).toHaveBeenCalledTimes(1);
    expect(String(nepLog.warn.mock.calls[0]?.[0])).not.toContain('geheim');
    expect(t.db.prepare("SELECT waarde_json FROM instellingen WHERE sleutel = 'opmaak'").get()).toEqual({
      waarde_json: geheim,
    });
  });

  it('kapotte JSON geeft ook de standaardwaarde', () => {
    t.db.prepare("INSERT INTO instellingen (sleutel, waarde_json) VALUES ('app', '{kapot')").run();
    expect(haalInstelling('app')).toEqual(standaardInstelling('app'));
  });

  it('bewaren valideert met het schema', () => {
    expect(() =>
      bewaarInstelling('opmaak', { layout: 'klassiek', accentkleur: 'rood', lettertype: 'inter' }),
    ).toThrow();
  });
});

describe('prijsposten (V-15)', () => {
  const nieuw: Prijspost = {
    id: '',
    sleutel: 'sloop',
    omschrijving: 'Eigen post',
    eenheid: 'stuk',
    prijsCent: 1250,
    btwTarief: 9,
    volgorde: 0,
  };

  it('lijst staat op volgorde', () => {
    const lijst = lijstPrijsposten();
    expect(lijst).toHaveLength(22);
    expect(lijst[0]).toMatchObject({ id: 'start-epdm_11', volgorde: 10, prijsCent: null });
    expect(lijst.map((p) => p.volgorde)).toEqual([...lijst.map((p) => p.volgorde)].sort((a, b) => a - b));
  });

  it('nieuw krijgt een id, sleutel null en volgorde max + 10', () => {
    const { id } = bewaarPrijspost(nieuw);
    expect(id).not.toBe('');
    expect(haalPrijspost(id)).toEqual({ ...nieuw, id, sleutel: null, volgorde: 230 });
  });

  it('bijwerken houdt de sleutel; onbekende id geeft VALIDATIE', () => {
    const start = haalPrijspostOpSleutel('hwa');
    expect(start).not.toBeNull();
    bewaarPrijspost({ ...start!, prijsCent: 4500, sleutel: null });
    expect(haalPrijspostOpSleutel('hwa')).toMatchObject({ id: 'start-hwa', prijsCent: 4500 });
    expect(() => bewaarPrijspost({ ...nieuw, id: 'bestaat-niet' })).toThrow(AppFout);
  });

  it('verwijderen', () => {
    verwijderPrijspost('start-hwa');
    expect(haalPrijspost('start-hwa')).toBeNull();
    expect(haalPrijspostOpSleutel('hwa')).toBeNull();
    expect(lijstPrijsposten()).toHaveLength(21);
  });
});
