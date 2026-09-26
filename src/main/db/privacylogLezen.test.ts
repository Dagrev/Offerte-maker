import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

const nep = vi.hoisted(() => ({
  agentMap: '',
  logMap: 'C:\\data\\logs',
  documentenMap: 'C:\\docs\\Offertes',
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  openPath: vi.fn<(pad: string) => Promise<string>>(() => Promise.resolve('')),
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getVersion: () => '0.1.0' },
  shell: { openPath: nep.openPath },
}));
vi.mock('../log', () => ({ log: nep.log }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
    logMap: nep.logMap,
    documentenMap: nep.documentenMap,
    dataMap: 'C:\\data',
  },
}));

const { schrijfLogregel, lijstPrivacylog, haalPrivacylog, PRIVACYLOG_LIMIET } =
  await import('./repo/privacylog');
const { schoonOp } = await import('./opschonen');
const { maakIpcHandler } = await import('../ipc/registreer');
const { privacylogHandlers } = await import('../ipc/privacylog');
const { appHandlers } = await import('../ipc/app');
const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('./repo/offertesInvoer');
const { maakOfferte } = await import('../agent/taken');
const { legeStatusCache } = await import('../agent/claudeStatus');

const nepEvent = {} as Parameters<ReturnType<typeof maakIpcHandler>>[0];
const lijst = maakIpcHandler('privacylog:lijst', privacylogHandlers['privacylog:lijst']);
const haal = maakIpcHandler('privacylog:haal', privacylogHandlers['privacylog:haal']);

let t: TestDatabase;
let claude: NepClaude | undefined;
beforeEach(async () => {
  t = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm021-'));
  legeStatusCache();
  vi.clearAllMocks();
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  t.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

function offerte(id: string, nummer: string | null): void {
  t.db
    .prepare(
      `INSERT INTO offertes (id, status, jaar, volgnummer, nummer, offertedatum, geldig_tot, klant_json, invoer_json,
         aangemaakt_op, bijgewerkt_op)
       VALUES (?, ?, ?, ?, ?, '2026-09-25', '2026-10-25', '{}', '{}', '2026-09-25T08:00:00Z', '2026-09-25T08:00:00Z')`,
    )
    .run(
      id,
      nummer ? 'klaar' : 'concept',
      nummer ? 2026 : null,
      nummer ? Number(nummer.slice(5)) : null,
      nummer,
    );
}

const regel = (deel: Partial<Parameters<typeof schrijfLogregel>[0]> = {}) => ({
  soort: 'maken' as const,
  offerteId: null,
  opdracht: 'systeemprompt\n\n---\n\nopdracht voor [KLANT_NAAM]',
  antwoord: '{"ok":true}',
  resultaat: 'ok' as const,
  foutcode: null,
  ...deel,
});

describe('lijstPrivacylog (V-18, V-27)', () => {
  it('nieuwste eerst, met weergavenummer; null bij concept, verwijderd, test en template', () => {
    offerte('o1', '2026-007');
    offerte('o2', null);
    t.db
      .prepare(
        `INSERT INTO pdf_bestanden VALUES ('p1', 'o1', '', 'a', '2026-09-25T09:00:00Z'), ('p2', 'o1', 'b', 'b', '2026-09-25T10:00:00Z')`,
      )
      .run();
    schrijfLogregel(regel({ offerteId: 'o1' }), new Date('2026-09-20T10:00:00Z'));
    schrijfLogregel(regel({ offerteId: 'o2', soort: 'aanpassen' }), new Date('2026-09-21T10:00:00Z'));
    schrijfLogregel(
      regel({ offerteId: 'weg', resultaat: 'fout', foutcode: 'GEEN_INTERNET' }),
      new Date('2026-09-22T10:00:00Z'),
    );
    schrijfLogregel(regel({ soort: 'test', resultaat: 'afgebroken' }), new Date('2026-09-23T10:00:00Z'));
    schrijfLogregel(regel({ soort: 'template_teksten', offerteId: 'o1' }), new Date('2026-09-24T10:00:00Z'));

    const items = lijstPrivacylog();
    expect(items.map((i) => [i.soort, i.offerteNummer, i.resultaat, i.foutcode])).toEqual([
      ['template_teksten', null, 'ok', null],
      ['test', null, 'afgebroken', null],
      ['maken', null, 'fout', 'GEEN_INTERNET'],
      ['aanpassen', null, 'ok', null],
      ['maken', '2026-007b', 'ok', null],
    ]);
    expect(items[0]).not.toHaveProperty('opdracht');
  });

  it(`geeft maximaal ${PRIVACYLOG_LIMIET} regels`, () => {
    const alles = t.db.transaction(() => {
      for (let i = 0; i < PRIVACYLOG_LIMIET + 3; i++)
        schrijfLogregel(regel(), new Date(Date.UTC(2026, 8, 1, 0, 0, i)));
    });
    alles();
    const items = lijstPrivacylog();
    expect(items).toHaveLength(PRIVACYLOG_LIMIET);
    expect(items[0]?.tijdstip).toBe(
      new Date(Date.UTC(2026, 8, 1, 0, 0, PRIVACYLOG_LIMIET + 2)).toISOString(),
    );
  });

  it('regels ouder dan 365 dagen zijn na het opschonen weg (FE-040)', () => {
    schrijfLogregel(regel(), new Date('2025-09-01T10:00:00Z'));
    schrijfLogregel(regel(), new Date('2026-09-01T10:00:00Z'));
    schoonOp(t.db, new Date('2026-09-25T10:00:00Z'));
    expect(lijstPrivacylog().map((i) => i.tijdstip)).toEqual(['2026-09-01T10:00:00.000Z']);
  });
});

describe('privacylog-kanalen', () => {
  it('haal geeft de tekst precies zoals opgeslagen; onbekend of ongeldig id geeft een fout (NFE-014)', async () => {
    const id = schrijfLogregel(regel({ antwoord: null, resultaat: 'fout', foutcode: 'AGENT_TIMEOUT' }));
    const r = await haal(nepEvent, { id });
    expect(r).toEqual({
      ok: true,
      data: expect.objectContaining({
        id,
        opdracht: 'systeemprompt\n\n---\n\nopdracht voor [KLANT_NAAM]',
        antwoord: null,
        foutcode: 'AGENT_TIMEOUT',
        offerteNummer: null,
      }) as unknown,
    });
    for (const invoer of [{ id: 'bestaat-niet' }, { id: '' }, {}, 42]) {
      const fout = await haal(nepEvent, invoer);
      expect(fout.ok ? null : fout.fout.code).toBe('VALIDATIE');
    }
    const l = await lijst(nepEvent, undefined);
    expect(l.ok && l.data.map((i) => i.id)).toEqual([id]);
  });

  it('na één offerte met de nep-CLI: één regel "maken" met de exacte tekst, zonder echte klantgegevens (FE-040)', async () => {
    claude = gebruikNepClaude('ok');
    const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    const klant = maakKlant({
      voornaam: '',
      achternaam: 'Jansen',
      adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
      telefoon: '06-12345678',
      email: 'jansen@mail.nl',
    });
    bewaarInvoer({ id, klant, invoer: maakInvoer({ overig: 'Graag voor de winter' }), wizardStap: 4 }, 30);
    await maakOfferte(id);

    const items = lijstPrivacylog();
    expect(items).toEqual([
      expect.objectContaining({ soort: 'maken', resultaat: 'ok', offerteNummer: null }),
    ]);
    const detail = haalPrivacylog(items[0]!.id);
    const opgeslagen = t.db.prepare('SELECT opdracht FROM privacylog').get() as { opdracht: string };
    expect(detail.opdracht).toBe(opgeslagen.opdracht);
    expect(detail.opdracht).toContain('\n\n---\n\n');
    for (const w of ['Jansen', 'Dorpsstraat', 'Veldhoven', '12345678', 'jansen@mail.nl']) {
      expect(detail.opdracht).not.toContain(w);
      expect(detail.antwoord ?? '').not.toContain(w);
    }
    // NFE-019: opdracht en antwoord niet in het technische log.
    const gelogd = JSON.stringify([
      nep.log.info.mock.calls,
      nep.log.warn.mock.calls,
      nep.log.error.mock.calls,
    ]);
    expect(gelogd).not.toContain(detail.opdracht.slice(0, 80));
  }, 30_000);
});

describe('app:openMap (V-17)', () => {
  const openMap = maakIpcHandler('app:openMap', appHandlers['app:openMap']);

  it('opent alleen de logmap of de documentenmap; ander invoer wordt geweigerd', async () => {
    expect(await openMap(nepEvent, { welke: 'log' })).toEqual({ ok: true, data: null });
    expect(await openMap(nepEvent, { welke: 'offertes' })).toEqual({ ok: true, data: null });
    expect(nep.openPath.mock.calls.map((c) => c[0])).toEqual([nep.logMap, nep.documentenMap]);

    for (const invoer of [{ welke: 'C:\\Windows' }, { pad: 'C:\\' }, undefined]) {
      const r = await openMap(nepEvent, invoer);
      expect(r.ok ? null : r.fout.code).toBe('VALIDATIE');
    }
    expect(nep.openPath).toHaveBeenCalledTimes(2);
  });

  it('een fout van shell.openPath wordt ONBEKEND', async () => {
    nep.openPath.mockResolvedValueOnce('Map niet gevonden');
    const r = await openMap(nepEvent, { welke: 'log' });
    expect(r.ok ? null : r.fout.code).toBe('ONBEKEND');
  });

  it('app:info levert ook dataMap en documentenMap', async () => {
    const info = maakIpcHandler('app:info', appHandlers['app:info']);
    const r = await info(nepEvent, undefined);
    expect(r.ok && r.data).toMatchObject({
      versie: '0.1.0',
      dataMap: 'C:\\data',
      documentenMap: nep.documentenMap,
    });
  });
});
