import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resultaat } from '@shared/fouten';
import type { Klant, OfferteInhoud } from '@shared/types';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';
import type { MapiInvoer, MapiUitkomst } from './mapi';

const nep = vi.hoisted(() => ({
  tmp: '',
  docs: '',
  shell: { openExternal: vi.fn(() => Promise.resolve()), showItemInFolder: vi.fn(), openPath: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\nergens', isPackaged: false, getAppPath: () => process.cwd() },
  shell: nep.shell,
  BrowserWindow: class {},
}));
vi.mock('../log', () => ({ log: nep.log }));
vi.mock('../venster', () => ({ huidigVenster: () => null }));
vi.mock('../paden', () => ({
  paden: {
    get tmpMap() {
      return nep.tmp;
    },
    pdfMap: (jaar: number) => join(nep.docs, String(jaar)),
  },
}));

const { maakOfferte: nieuweOfferte, bewaarInvoer } = await import('../db/repo/offertesInvoer');
const { bewaarNieuweVersie } = await import('../db/repo/offertesInhoud');
const { wijzigInstelling } = await import('../db/repo/instellingen');
const { maakDefinitief } = await import('../pdf/definitief');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { maakIpcHandler } = await import('../ipc/registreer');
const { mailHandlers } = await import('../ipc/mail');
const { mailOfferte, mailShell, standaardMailDeps } = await import('./versturen');

let db: TestDatabase;
beforeEach(async () => {
  db = await maakTestDatabase();
  nep.tmp = mkdtempSync(join(tmpdir(), 'ofm-mail-tmp-'));
  nep.docs = mkdtempSync(join(tmpdir(), 'ofm-mail-docs-'));
  vi.clearAllMocks();
  zetTesthakenVoorTest(new Map([['vandaag', '2026-09-26']]));
  wijzigInstelling('bedrijf', { naam: 'Dakwerken Test' });
});
afterEach(() => {
  db.opruimen();
  rmSync(nep.tmp, { recursive: true, force: true });
  rmSync(nep.docs, { recursive: true, force: true });
});

const inhoud: OfferteInhoud = {
  titel: 'Offerte dak',
  inleiding: 'Beste [KLANT_NAAM],',
  werkomschrijving: ['Stap 1'],
  regels: [],
  uitvoering: '',
  opmerkingen: '',
  afsluiting: '',
  controlepunten: [],
};

const jansen: Klant = maakKlant({ voornaam: 'Jan', achternaam: 'Jansen', email: 'jan@voorbeeld.nl' });

function offerte(klant: Klant = jansen): string {
  const id = nieuweOfferte({ vandaag: '2026-09-26', geldigheidDagen: 30 });
  bewaarInvoer({ id, klant, invoer: maakInvoer(), wizardStap: 4 }, 30);
  bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  return id;
}

async function definitief(klant?: Klant): Promise<{ id: string; pad: string }> {
  const id = offerte(klant);
  const { pad } = await maakDefinitief(id, () => Promise.resolve(Buffer.from('%PDF-nep')));
  return { id, pad };
}

function deps(uitkomst: MapiUitkomst, openExternal = () => Promise.resolve()) {
  let t = 1000;
  return {
    mapi: vi.fn<(invoer: MapiInvoer) => Promise<MapiUitkomst>>(() => Promise.resolve(uitkomst)),
    shell: { openExternal: vi.fn(openExternal), showItemInFolder: vi.fn() },
    nu: () => (t += 25),
  };
}

const allesGelogd = () => JSON.stringify([nep.log.info.mock.calls, nep.log.warn.mock.calls]);

describe('mailOfferte (OFM-041)', () => {
  it('MAPI: concept met aan, onderwerp, tekst en PDF; logt methode en duur zonder adres of naam', async () => {
    const { id, pad } = await definitief();
    const d = deps({ mapi: 0, mailto: true, timeout: false });
    expect(await mailOfferte(id, d)).toEqual({ methode: 'mapi' });
    const invoer = d.mapi.mock.calls[0]?.[0];
    expect(invoer?.aan).toBe('jan@voorbeeld.nl');
    expect(invoer?.onderwerp).toBe('Offerte 2026-09-26-001 van Dakwerken Test');
    expect(invoer?.tekst.startsWith('Geachte heer Jansen,\r\n')).toBe(true);
    expect(invoer?.tekst).toContain('geldig tot 26 oktober 2026');
    expect(invoer?.pad).toBe(pad);
    expect(d.shell.openExternal).not.toHaveBeenCalled();
    expect(nep.log.info).toHaveBeenCalledWith(`mail ${id}: methode mapi (code 0), 25 ms`);
    expect(allesGelogd()).not.toMatch(/jan@|Jansen/);
  });

  it('gebruikt de eigen e-mailtekst en de versieletter van de laatste PDF', async () => {
    const { id } = await definitief();
    wijzigInstelling('teksten', { emailTekst: 'Beste {achternaam}, zie {nummer}.' });
    bewaarNieuweVersie({ id, inhoud: { ...inhoud, titel: 'Anders' }, bron: 'handmatig', wizardStap: 4 });
    await maakDefinitief(id, () => Promise.resolve(Buffer.from('%PDF-nep')));
    const d = deps({ mapi: 1, mailto: null, timeout: true });
    expect(await mailOfferte(id, d)).toEqual({ methode: 'mapi' });
    expect(d.mapi.mock.calls[0]?.[0].tekst).toBe('Beste Jansen, zie 2026-09-26-001b.');
    expect(nep.log.info).toHaveBeenCalledWith(expect.stringContaining('methode mapi (code 1, time-out)'));
  });

  it('MAPI mislukt: mailto zonder bijlage en de PDF in Verkenner', async () => {
    const { id, pad } = await definitief();
    const d = deps({ mapi: null, mailto: true, timeout: false });
    expect(await mailOfferte(id, d)).toEqual({ methode: 'mailto' });
    expect(d.shell.openExternal).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:jan%40voorbeeld\.nl\?subject=/),
    );
    expect(d.shell.showItemInFolder).toHaveBeenCalledWith(pad);
    expect(nep.log.info).toHaveBeenCalledWith(`mail ${id}: methode mailto (mapi null), 25 ms`);
  });

  it('geen standaardmailprogramma: MAIL_GEEN_PROGRAMMA, niets geopend', async () => {
    const { id } = await definitief();
    const d = deps({ mapi: 2, mailto: false, timeout: false });
    await expect(mailOfferte(id, d)).rejects.toMatchObject({ code: 'MAIL_GEEN_PROGRAMMA' });
    expect(d.shell.openExternal).not.toHaveBeenCalled();
  });

  it('mailto lukt niet: MAIL_GEEN_PROGRAMMA', async () => {
    const { id } = await definitief();
    const d = deps({ mapi: 2, mailto: null, timeout: false }, () => Promise.reject(new Error('x')));
    await expect(mailOfferte(id, d)).rejects.toMatchObject({ code: 'MAIL_GEEN_PROGRAMMA' });
    expect(d.shell.showItemInFolder).not.toHaveBeenCalled();
    expect(nep.log.warn).toHaveBeenCalledWith(expect.stringContaining('mailto mislukt'));
  });

  it('concept zonder PDF: VALIDATIE "Maak de offerte eerst definitief.", MAPI niet aangeroepen', async () => {
    const id = offerte();
    const d = deps({ mapi: 0, mailto: true, timeout: false });
    await expect(mailOfferte(id, d)).rejects.toMatchObject({ code: 'VALIDATIE' });
    expect(d.mapi).not.toHaveBeenCalled();
  });

  it('via het kanaal offerte:mail met het nep-hulpscript (OFFERTE_MAKER_MAIL_CMD)', async () => {
    const { id, pad } = await definitief();
    const log = join(nep.tmp, 'nep-mail.jsonl');
    const vorige = { ...process.env };
    process.env['OFFERTE_MAKER_MAIL_CMD'] = join(process.cwd(), 'test', 'fake-mail', 'fake-mail.mjs');
    process.env['FAKE_MAIL_LOG'] = log;
    process.env['FAKE_MAIL_MODE'] = 'ok';
    try {
      const handler = maakIpcHandler('offerte:mail', mailHandlers['offerte:mail']);
      const r: Resultaat<{ methode: string }> = await handler({} as IpcMainInvokeEvent, { id });
      expect(r).toEqual({ ok: true, data: { methode: 'mapi' } });
      const aanroep = JSON.parse(readFileSync(log, 'utf8').trim()) as { stdin: MapiInvoer };
      expect(aanroep.stdin).toMatchObject({ aan: 'jan@voorbeeld.nl', pad });
      expect(nep.shell.openExternal).not.toHaveBeenCalled();
    } finally {
      process.env = vorige;
    }
  });
});

describe('mailShell', () => {
  it('echt: electron-shell', async () => {
    const s = standaardMailDeps().shell;
    await s.openExternal('mailto:x');
    s.showItemInFolder('a.pdf');
    expect(nep.shell.openExternal).toHaveBeenCalledWith('mailto:x');
    expect(nep.shell.showItemInFolder).toHaveBeenCalledWith('a.pdf');
  });

  it('testhaak mail-shell=<pad>: vastleggen in plaats van openen', async () => {
    const log = join(nep.tmp, 'shell.jsonl');
    zetTesthakenVoorTest(new Map([['mail-shell', log]]));
    const s = mailShell();
    await s.openExternal('mailto:x');
    s.showItemInFolder('a.pdf');
    expect(nep.shell.openExternal).not.toHaveBeenCalled();
    expect(nep.shell.showItemInFolder).not.toHaveBeenCalled();
    expect(readFileSync(log, 'utf8')).toBe('{"openExternal":"mailto:x"}\n{"showItemInFolder":"a.pdf"}\n');
  });
});
