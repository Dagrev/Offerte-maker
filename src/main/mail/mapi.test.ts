import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeCommando, ProcesUitkomst } from '../agent/proces';
import { MAPI_TIMEOUT_MS, leesUitkomst, mapiCommandos, mapiGelukt, openViaMapi, type Starter } from './mapi';

const NEP_MAIL = join(process.cwd(), 'test', 'fake-mail', 'fake-mail.mjs');

function proces(deel: Partial<ProcesUitkomst>): ProcesUitkomst {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timeout: false,
    afgebroken: false,
    startFout: false,
    ...deel,
  };
}

const invoer = { aan: 'a@b.nl', onderwerp: 'Offerte', tekst: 'Tekst', pad: 'C:\\pdf\\a.pdf' };

describe('mapiCommandos (OFM-041)', () => {
  it('OFFERTE_MAKER_MAIL_CMD wint; bestaat het niet, dan niets (nooit het echte script)', () => {
    const nep = mapiCommandos({
      env: { OFFERTE_MAKER_MAIL_CMD: 'nep.mjs' },
      scriptMap: 'x',
      bestaat: () => true,
    });
    expect(nep).toEqual([
      { command: process.execPath, prefixArgs: ['nep.mjs'], env: { ELECTRON_RUN_AS_NODE: '1' } },
    ]);
    expect(
      mapiCommandos({ env: { OFFERTE_MAKER_MAIL_CMD: 'nep.mjs' }, scriptMap: 'x', bestaat: () => false }),
    ).toEqual([]);
  });

  it('echt: 64-bit en daarna 32-bit PowerShell met het script, alleen wat bestaat', () => {
    const alles = mapiCommandos({
      env: { SystemRoot: 'C:\\Win' },
      scriptMap: 'C:\\res\\mail',
      bestaat: () => true,
    });
    expect(alles.map((c) => c.command)).toEqual([
      join('C:\\Win', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      join('C:\\Win', 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ]);
    expect(alles[0]?.prefixArgs).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join('C:\\res\\mail', 'mapi.ps1'),
    ]);
    const alleen64 = mapiCommandos({
      env: {},
      scriptMap: 'C:\\res\\mail',
      bestaat: (p) => !p.includes('SysWOW64'),
    });
    expect(alleen64).toHaveLength(1);
    expect(alleen64[0]?.command.startsWith(join('C:\\Windows', 'System32'))).toBe(true);
    expect(
      mapiCommandos({ env: {}, scriptMap: 'C:\\res\\mail', bestaat: (p) => !p.endsWith('.ps1') }),
    ).toEqual([]);
  });

  it('het script staat in resources/mail (gaat mee in de installer)', () => {
    expect(
      mapiCommandos({ env: {}, scriptMap: join(process.cwd(), 'resources', 'mail') }).length,
    ).toBeGreaterThan(0);
  });
});

describe('leesUitkomst', () => {
  it('leest de laatste JSON-regel', () => {
    expect(leesUitkomst(proces({ stdout: 'rommel\r\n{"mapi":0,"mailto":true}\r\n' }))).toEqual({
      mapi: 0,
      mailto: true,
      timeout: false,
    });
    expect(leesUitkomst(proces({ stdout: '{"mapi":null,"mailto":false}' }))).toEqual({
      mapi: null,
      mailto: false,
      timeout: false,
    });
    expect(leesUitkomst(proces({ stdout: '{"mapi":1.5,"mailto":"ja"}' }))).toEqual({
      mapi: null,
      mailto: null,
      timeout: false,
    });
  });

  it('fout, startfout, onleesbaar of geen object: niet aan te roepen', () => {
    const niets = { mapi: null, mailto: null, timeout: false };
    expect(leesUitkomst(proces({ exitCode: 1, stdout: '{"mapi":0}' }))).toEqual(niets);
    expect(leesUitkomst(proces({ startFout: true, exitCode: null }))).toEqual(niets);
    expect(leesUitkomst(proces({ stdout: 'geen json' }))).toEqual(niets);
    expect(leesUitkomst(proces({ stdout: '3' }))).toEqual(niets);
    expect(leesUitkomst(proces({ stdout: 'null' }))).toEqual(niets);
  });

  it('time-out: het concept stond open, telt als gelukt', () => {
    const u = leesUitkomst(proces({ timeout: true, exitCode: null }));
    expect(u).toEqual({ mapi: 0, mailto: null, timeout: true });
    expect(mapiGelukt(u)).toBe(true);
  });

  it('0 en 1 (gesloten zonder verzenden) zijn gelukt, andere codes niet', () => {
    expect(mapiGelukt({ mapi: 1, mailto: null, timeout: false })).toBe(true);
    expect(mapiGelukt({ mapi: 2, mailto: true, timeout: false })).toBe(false);
    expect(mapiGelukt({ mapi: null, mailto: true, timeout: false })).toBe(false);
  });
});

describe('openViaMapi', () => {
  const cmd = (naam: string): ClaudeCommando => ({ command: naam, prefixArgs: [], env: {} });

  it('stuurt de invoer als JSON via stdin, met de lange time-out', async () => {
    const start = vi.fn<Starter>(() => Promise.resolve(proces({ stdout: '{"mapi":0,"mailto":true}' })));
    expect(await openViaMapi(invoer, [cmd('a'), cmd('b')], start)).toEqual({
      mapi: 0,
      mailto: true,
      timeout: false,
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(cmd('a'), [], {
      stdin: JSON.stringify(invoer),
      timeoutMs: MAPI_TIMEOUT_MS,
    });
  });

  it('probeert het volgende commando als MAPI mislukt en onthoudt mailto', async () => {
    const start = vi
      .fn<Starter>()
      .mockResolvedValueOnce(proces({ stdout: '{"mapi":2,"mailto":true}' }))
      .mockResolvedValueOnce(proces({ exitCode: 1 }));
    expect(await openViaMapi(invoer, [cmd('a'), cmd('b')], start)).toEqual({
      mapi: null,
      mailto: true,
      timeout: false,
    });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('zonder commando: niet aan te roepen', async () => {
    expect(await openViaMapi(invoer, [])).toEqual({ mapi: null, mailto: null, timeout: false });
  });

  it('met het nep-hulpscript als echt subproces', async () => {
    const [nep] = mapiCommandos({ env: { OFFERTE_MAKER_MAIL_CMD: NEP_MAIL }, scriptMap: 'x' });
    expect(nep).toBeDefined();
    const vorige = process.env['FAKE_MAIL_MODE'];
    process.env['FAKE_MAIL_MODE'] = 'geen-programma';
    try {
      expect(await openViaMapi(invoer, [nep as ClaudeCommando])).toEqual({
        mapi: 2,
        mailto: false,
        timeout: false,
      });
    } finally {
      if (vorige === undefined) delete process.env['FAKE_MAIL_MODE'];
      else process.env['FAKE_MAIL_MODE'] = vorige;
    }
  });
});
