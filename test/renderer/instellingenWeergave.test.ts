import { beforeEach, describe, expect, it } from 'vitest';
import { useInstellingenWeergave } from '../../src/renderer/src/stores/instellingenWeergave';

// OFM-056: open/dicht-stand van de werkzaamheidkaarten in Instellingen.

beforeEach(() => useInstellingenWeergave.setState({ openWerk: {} }));

describe('useInstellingenWeergave', () => {
  it('begint met alle kaarten dicht', () => {
    expect(useInstellingenWeergave.getState().openWerk).toEqual({});
  });

  it('opent en sluit één kaart', () => {
    const { zetWerkOpen } = useInstellingenWeergave.getState();
    zetWerkOpen('a', true);
    zetWerkOpen('b', true);
    expect(useInstellingenWeergave.getState().openWerk).toEqual({ a: true, b: true });
    zetWerkOpen('a', false);
    expect(useInstellingenWeergave.getState().openWerk).toEqual({ b: true });
  });

  it("opent alles met de gegeven id's en sluit alles", () => {
    const { zetAlleWerk } = useInstellingenWeergave.getState();
    zetAlleWerk(['a', 'b', 'c'], true);
    expect(useInstellingenWeergave.getState().openWerk).toEqual({ a: true, b: true, c: true });
    zetAlleWerk(['a', 'b', 'c'], false);
    expect(useInstellingenWeergave.getState().openWerk).toEqual({});
  });
});
