import { describe, expect, it, vi } from 'vitest';
import type { Resultaat } from '@shared/fouten';
import { formatVerstreken, lopendeAgentTaak, startAgentTaak } from '../../src/renderer/src/stores/agentTaken';

describe('startAgentTaak', () => {
  it('start één aanroep per id, ook bij een tweede start (StrictMode)', async () => {
    let klaar: (r: Resultaat<number>) => void = () => undefined;
    const aanroep = vi.fn(() => new Promise<Resultaat<number>>((r) => (klaar = r)));
    const eerste = startAgentTaak({ id: 'a' }, aanroep);
    const tweede = startAgentTaak({ id: 'a' }, aanroep);
    expect(tweede).toBe(eerste);
    expect(aanroep).toHaveBeenCalledTimes(1);
    expect(lopendeAgentTaak('a')).toBe(eerste);

    klaar({ ok: true, data: 3 });
    await expect(eerste.belofte).resolves.toEqual({ ok: true, data: 3 });
    await Promise.resolve();
    expect(lopendeAgentTaak('a')).toBeNull();
  });

  it('bewaart een bijSucces-callback', () => {
    const bijSucces = vi.fn();
    const taak = startAgentTaak(
      { id: 'b' },
      () => Promise.resolve<Resultaat<string>>({ ok: true, data: 'x' }),
      bijSucces,
    );
    taak.bijSucces?.('x');
    expect(bijSucces).toHaveBeenCalledWith('x');
  });
});

describe('formatVerstreken', () => {
  it('m:ss', () => {
    expect(formatVerstreken(0)).toBe('0:00');
    expect(formatVerstreken(7.9)).toBe('0:07');
    expect(formatVerstreken(65)).toBe('1:05');
    expect(formatVerstreken(300)).toBe('5:00');
    expect(formatVerstreken(-3)).toBe('0:00');
  });
});
