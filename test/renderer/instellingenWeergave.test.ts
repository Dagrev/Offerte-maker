import { beforeEach, describe, expect, it } from 'vitest';
import { useInstellingenWeergave } from '../../src/renderer/src/stores/instellingenWeergave';

// OFM-056: open/dicht-stand van de werkzaamheidkaarten in Instellingen.

beforeEach(() => useInstellingenWeergave.setState({ openWerk: {}, dichteCategorieen: {} }));

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

// OFM-057: categoriegroepen in de tab Materialen en prijzen (standaard open).
describe('categoriegroepen', () => {
  const dicht = () => useInstellingenWeergave.getState().dichteCategorieen;

  it('begint met alle groepen open; sluiten en openen per groep', () => {
    expect(dicht()).toEqual({});
    const { zetCategorieOpen } = useInstellingenWeergave.getState();
    zetCategorieOpen('a', false);
    zetCategorieOpen('b', false);
    expect(dicht()).toEqual({ a: true, b: true });
    zetCategorieOpen('a', true);
    expect(dicht()).toEqual({ b: true });
  });

  it('opent groepen met treffers en laat de rest; alles sluiten en openen', () => {
    const { zetAlleCategorieen, openCategorieen } = useInstellingenWeergave.getState();
    zetAlleCategorieen(['a', 'b', 'c'], false);
    openCategorieen(['a', 'c']);
    expect(dicht()).toEqual({ b: true });
    zetAlleCategorieen(['a', 'b', 'c'], true);
    expect(dicht()).toEqual({});
  });
});
