import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../db/repo/instellingen', () => ({ haalInstelling: () => ({ pad: null }) }));

const { kiesUitWhere, padUitCmdShim, zoekClaude } = await import('./claudePad');

const SHIM = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*
`;

let map = '';
afterEach(() => {
  if (map) rmSync(map, { recursive: true, force: true });
  map = '';
});

describe('padUitCmdShim (§10.2, §15.4)', () => {
  it('haalt het .exe-pad uit een npm-shim en vervangt %dp0% door de map van het .cmd-bestand', () => {
    expect(padUitCmdShim('C:\\npm\\claude.cmd', SHIM)).toBe(
      join('C:\\npm', 'node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe'),
    );
    expect(padUitCmdShim('C:\\npm\\claude.cmd', '@echo off\nnode cli.js %*')).toBeNull();
  });
});

describe('kiesUitWhere', () => {
  it('neemt de eerste .exe', () => {
    expect(kiesUitWhere(['C:\\a\\claude', 'C:\\a\\claude.exe', 'C:\\b\\claude.exe'], () => true)).toBe(
      'C:\\a\\claude.exe',
    );
  });

  it('valt terug op de .cmd-shim, maar alleen als het .exe bestaat', () => {
    map = mkdtempSync(join(tmpdir(), 'ofm-shim-'));
    const cmd = join(map, 'claude.cmd');
    writeFileSync(cmd, SHIM);
    const exe = join(map, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    expect(kiesUitWhere([join(map, 'claude'), cmd])).toBeNull();
    mkdirSync(join(exe, '..'), { recursive: true });
    writeFileSync(exe, '');
    expect(kiesUitWhere([join(map, 'claude'), cmd])).toBe(exe);
  });

  it('niets bruikbaars of onleesbare .cmd → null', () => {
    expect(kiesUitWhere([])).toBeNull();
    expect(kiesUitWhere(['C:\\bestaat\\niet\\claude.cmd'])).toBeNull();
  });
});

describe('zoekClaude (§10.2)', () => {
  const where = vi.fn(() => Promise.resolve(['C:\\where\\claude.exe']));
  const alles = () => true;

  it('1. OFFERTE_MAKER_CLAUDE_CMD → process.execPath met ELECTRON_RUN_AS_NODE', async () => {
    const cmd = await zoekClaude({ env: { OFFERTE_MAKER_CLAUDE_CMD: 'C:\\nep.mjs' }, bestaat: alles, where });
    expect(cmd).toEqual({
      command: process.execPath,
      prefixArgs: ['C:\\nep.mjs'],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    });
  });

  it('1. gezet maar bestaat niet → direct niet gevonden, zonder verder te zoeken', async () => {
    where.mockClear();
    const cmd = await zoekClaude({
      env: { OFFERTE_MAKER_CLAUDE_CMD: 'C:\\bestaat-niet.mjs' },
      bestaat: (p) => p !== 'C:\\bestaat-niet.mjs',
      instellingPad: 'C:\\claude.exe',
      where,
    });
    expect(cmd).toBeNull();
    expect(where).not.toHaveBeenCalled();
  });

  it('2. instelling claude.pad (alleen .exe die bestaat)', async () => {
    expect(
      await zoekClaude({ env: {}, instellingPad: 'C:\\eigen\\claude.exe', bestaat: alles, where }),
    ).toMatchObject({
      command: 'C:\\eigen\\claude.exe',
      prefixArgs: [],
    });
    const zonderInstelling = await zoekClaude({
      env: {},
      instellingPad: 'C:\\eigen\\claude.exe',
      gebruikersmap: 'C:\\Users\\x',
      bestaat: (p) => p !== 'C:\\eigen\\claude.exe',
      where,
    });
    expect(zonderInstelling?.command).toBe(join('C:\\Users\\x', '.local', 'bin', 'claude.exe'));
  });

  it('3. %USERPROFILE%\\.local\\bin\\claude.exe, 4. where.exe, 5. niets', async () => {
    const standaard = join('C:\\Users\\x', '.local', 'bin', 'claude.exe');
    expect(
      (await zoekClaude({ env: { USERPROFILE: 'C:\\Users\\x' }, instellingPad: null, bestaat: alles, where }))
        ?.command,
    ).toBe(standaard);
    expect(
      (
        await zoekClaude({
          env: {},
          instellingPad: null,
          gebruikersmap: 'C:\\Users\\x',
          bestaat: (p) => p !== standaard,
          where,
        })
      )?.command,
    ).toBe('C:\\where\\claude.exe');
    expect(
      await zoekClaude({
        env: {},
        instellingPad: null,
        gebruikersmap: 'C:\\Users\\x',
        bestaat: () => false,
        where,
      }),
    ).toBeNull();
  });

  it('leest standaard de instelling claude.pad', async () => {
    expect(
      await zoekClaude({
        env: {},
        gebruikersmap: 'C:\\Users\\x',
        bestaat: () => false,
        where: () => Promise.resolve([]),
      }),
    ).toBeNull();
  });
});
