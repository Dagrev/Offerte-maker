import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// OFM-031: PDOK-opzoeken met een lokale nep-server (geen echte netwerkaanroepen).

const nepLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../log', () => ({ log: nepLog }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));

const { PDOK_URL, kiesDoc, leesAntwoord, pdokUrl, zoekAdres, zoekUrl } = await import('./pdok');
const { maakIpcHandler } = await import('../ipc/registreer');
const { adresHandlers } = await import('../ipc/adres');

let server: Server;
let basis: string;
const verzoeken: URL[] = [];
let antwoord: { status: number; body: unknown; wacht?: number } = { status: 200, body: {} };

beforeAll(async () => {
  server = createServer((req, res) => {
    verzoeken.push(new URL(req.url ?? '/', 'http://x'));
    const stuur = () => {
      res.writeHead(antwoord.status, { 'content-type': 'application/json' });
      res.end(typeof antwoord.body === 'string' ? antwoord.body : JSON.stringify(antwoord.body));
    };
    if (antwoord.wacht) setTimeout(stuur, antwoord.wacht);
    else stuur();
  });
  await new Promise<void>((klaar) => server.listen(0, '127.0.0.1', klaar));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/free`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
beforeEach(() => {
  verzoeken.length = 0;
  nepLog.info.mockClear();
});

const doc = (straatnaam: string, extra: Record<string, string> = {}) => ({
  straatnaam,
  woonplaatsnaam: 'Eindhoven',
  ...extra,
});

describe('pdokUrl en zoekUrl', () => {
  it('standaard de Locatieserver, anders OFFERTE_MAKER_PDOK_URL', () => {
    expect(pdokUrl({})).toBe(PDOK_URL);
    expect(pdokUrl({ OFFERTE_MAKER_PDOK_URL: 'http://127.0.0.1:1/x' })).toBe('http://127.0.0.1:1/x');
  });

  it('alleen postcode en huisnummer gaan mee', () => {
    const url = new URL(zoekUrl(PDOK_URL, '5611 AB', { nummer: 12, toevoeging: 'A' }));
    expect(url.origin + url.pathname).toBe(PDOK_URL);
    expect(url.searchParams.getAll('fq')).toEqual(['type:adres', 'postcode:5611AB', 'huisnummer:12']);
    expect(url.searchParams.get('rows')).toBe('20');
  });
});

describe('leesAntwoord en kiesDoc', () => {
  const docs = [
    doc('Straat zonder'),
    doc('Straat A', { huisletter: 'A' }),
    doc('Straat 2', { huisnummertoevoeging: '2' }),
  ];

  it('kiest op huisletter, toevoeging of geen van beide', () => {
    expect(kiesDoc(docs, '')?.straatnaam).toBe('Straat zonder');
    expect(kiesDoc(docs, 'A')?.straatnaam).toBe('Straat A');
    expect(kiesDoc(docs, '2')?.straatnaam).toBe('Straat 2');
    expect(kiesDoc([doc('X', { huisletter: 'B', huisnummertoevoeging: '1' })], 'B1')?.straatnaam).toBe('X');
    expect(kiesDoc(docs, 'Z')?.straatnaam).toBe('Straat zonder'); // niets past → eerste
    expect(kiesDoc([], '')).toBeUndefined();
  });

  it('null bij geen docs, een raar antwoord of een onvolledige treffer', () => {
    expect(leesAntwoord({ response: { docs } }, 'A')).toEqual({ straat: 'Straat A', plaats: 'Eindhoven' });
    expect(leesAntwoord({ response: { docs: [] } }, '')).toBeNull();
    expect(leesAntwoord({ response: {} }, '')).toBeNull();
    expect(leesAntwoord(null, '')).toBeNull();
    expect(leesAntwoord({ response: { docs: [{ straatnaam: 'X', woonplaatsnaam: 3 }] } }, '')).toBeNull();
  });
});

describe('zoekAdres', () => {
  it('gevonden: straat en plaats, log zonder waarden', async () => {
    antwoord = { status: 200, body: { response: { docs: [doc('Dorpsstraat')] } } };
    expect(await zoekAdres({ postcode: '5611ab', huisnummer: '12' }, { basis })).toEqual({
      straat: 'Dorpsstraat',
      plaats: 'Eindhoven',
    });
    expect(verzoeken[0]?.searchParams.getAll('fq')).toEqual([
      'type:adres',
      'postcode:5611AB',
      'huisnummer:12',
    ]);
    const regel = String(nepLog.info.mock.calls[0]?.[0]);
    expect(regel).toMatch(/^adres opgezocht: gevonden, \d+ ms$/);
    expect(regel).not.toMatch(/5611|Dorpsstraat|Eindhoven/);
  });

  it('geen treffer, http-fout, kapotte json, geen verbinding en time-out geven null', async () => {
    antwoord = { status: 200, body: { response: { docs: [] } } };
    expect(await zoekAdres({ postcode: '5611 AB', huisnummer: '999' }, { basis })).toBeNull();
    antwoord = { status: 500, body: {} };
    expect(await zoekAdres({ postcode: '5611 AB', huisnummer: '1' }, { basis })).toBeNull();
    antwoord = { status: 200, body: 'geen json' };
    expect(await zoekAdres({ postcode: '5611 AB', huisnummer: '1' }, { basis })).toBeNull();
    expect(
      await zoekAdres({ postcode: '5611 AB', huisnummer: '1' }, { basis: 'http://127.0.0.1:1/x' }),
    ).toBeNull();
    antwoord = { status: 200, body: { response: { docs: [doc('Laat')] } }, wacht: 500 };
    expect(await zoekAdres({ postcode: '5611 AB', huisnummer: '1' }, { basis, timeoutMs: 50 })).toBeNull();
    const regels = nepLog.info.mock.calls.map((c) => String(c[0]).replace(/\d+ ms$/, 'n ms'));
    expect(regels).toEqual([
      'adres opgezocht: niet gevonden, n ms',
      'adres opgezocht: niet gevonden (http 500), n ms',
      'adres opgezocht: niet gevonden (geen verbinding), n ms',
      'adres opgezocht: niet gevonden (geen verbinding), n ms',
      'adres opgezocht: niet gevonden (time-out), n ms',
    ]);
  });

  it('ongeldige invoer: geen aanroep', async () => {
    const haal = vi.fn();
    expect(await zoekAdres({ postcode: '', huisnummer: '12' }, { haal })).toBeNull();
    expect(await zoekAdres({ postcode: '12345', huisnummer: '12' }, { haal })).toBeNull();
    expect(await zoekAdres({ postcode: '5611 AB', huisnummer: 'x' }, { haal })).toBeNull();
    expect(haal).not.toHaveBeenCalled();
  });

  it('IPC: kanaal adres:zoek met OFFERTE_MAKER_PDOK_URL; ongeldige invoer → VALIDATIE', async () => {
    vi.stubEnv('OFFERTE_MAKER_PDOK_URL', basis);
    antwoord = { status: 200, body: { response: { docs: [doc('Kerkstraat')] } } };
    const zoek = maakIpcHandler('adres:zoek', adresHandlers['adres:zoek']);
    expect(await zoek({} as never, { postcode: '5611 AB', huisnummer: '3' })).toEqual({
      ok: true,
      data: { straat: 'Kerkstraat', plaats: 'Eindhoven' },
    });
    expect(await zoek({} as never, { postcode: '1234 SA', huisnummer: '3' })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE' },
    });
    expect(await zoek({} as never, { postcode: '5611 AB', huisnummer: '' })).toMatchObject({ ok: false });
    expect(await zoek({} as never, { postcode: '5611 AB', huisnummer: '3', naam: 'Jansen' })).toMatchObject({
      ok: true,
    });
    vi.unstubAllEnvs();
  });
});
