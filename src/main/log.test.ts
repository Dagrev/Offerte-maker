import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nepLog = vi.hoisted(() => {
  const file: Record<string, unknown> = {};
  const console: Record<string, unknown> = {};
  return {
    transports: { file, console },
    initialize: vi.fn(),
    errorHandler: { startCatching: vi.fn() },
  };
});
vi.mock('electron-log/main', () => ({ default: nepLog }));

const { AANTAL_ARCHIEVEN, MAX_LOGGROOTTE, initLogging, roteerLog } = await import('./log');

describe('roteerLog', () => {
  let map = '';
  afterEach(() => rmSync(map, { recursive: true, force: true }));

  it('schuift archieven door en bewaart er maximaal vijf', () => {
    map = mkdtempSync(join(tmpdir(), 'ofm-log-'));
    const pad = join(map, 'main.log');
    for (let ronde = 1; ronde <= 7; ronde++) {
      writeFileSync(pad, `ronde ${ronde}`);
      roteerLog(pad);
    }
    expect(existsSync(pad)).toBe(false);
    expect(readFileSync(join(map, 'main.1.log'), 'utf8')).toBe('ronde 7');
    expect(readFileSync(join(map, 'main.5.log'), 'utf8')).toBe('ronde 3');
    expect(existsSync(join(map, 'main.6.log'))).toBe(false);
  });
});

describe('initLogging', () => {
  it('schrijft naar logMap\\main.log met 1 MB en 5 archieven, debug in ontwikkeling', () => {
    initLogging('C:\\data\\logs', false);
    const bestand = nepLog.transports.file;
    expect((bestand['resolvePathFn'] as () => string)()).toBe(join('C:\\data\\logs', 'main.log'));
    expect(bestand['maxSize']).toBe(MAX_LOGGROOTTE);
    expect(MAX_LOGGROOTTE).toBe(1024 * 1024);
    expect(AANTAL_ARCHIEVEN).toBe(5);
    expect(bestand['level']).toBe('debug');
    expect(nepLog.transports.console['level']).toBe('debug');
    expect(nepLog.initialize).toHaveBeenCalledWith({ preload: true });
    expect(nepLog.errorHandler.startCatching).toHaveBeenCalled();
  });

  it('gebruikt niveau info in de verpakte app en roteert via roteerLog', () => {
    initLogging('C:\\data\\logs', true);
    expect(nepLog.transports.file['level']).toBe('info');
    expect(nepLog.transports.console['level']).toBe(false);

    const map = mkdtempSync(join(tmpdir(), 'ofm-log-'));
    const pad = join(map, 'main.log');
    writeFileSync(pad, 'x');
    (nepLog.transports.file['archiveLogFn'] as (b: { path: string }) => void)({ path: pad });
    expect(existsSync(join(map, 'main.1.log'))).toBe(true);
    rmSync(map, { recursive: true, force: true });
  });
});
