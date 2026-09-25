import { beforeEach, describe, expect, it } from 'vitest';
import { useTemplateVoorstellen, voorstellenLijst } from '../../src/renderer/src/stores/templateVoorstellen';

// OFM-024: voorstellen uit het template, per tekst overnemen of niet (FE-084).

beforeEach(() => useTemplateVoorstellen.getState().sluit());

describe('templateVoorstellen', () => {
  it('lijst in vaste volgorde, lege en ontbrekende velden weg', () => {
    expect(voorstellenLijst(null)).toEqual([]);
    expect(voorstellenLijst({ voetnoot: 'V', inleiding: 'I', afsluiting: '' })).toEqual([
      { veld: 'inleiding', tekst: 'I' },
      { veld: 'voetnoot', tekst: 'V' },
    ]);
  });

  it('afhandelen haalt één voorstel weg; het laatste sluit', () => {
    const s = useTemplateVoorstellen.getState();
    s.zet({ inleiding: 'I', afsluiting: 'A' });
    s.handelAf('inleiding');
    expect(useTemplateVoorstellen.getState().voorstellen).toEqual({ afsluiting: 'A' });
    s.handelAf('afsluiting');
    expect(useTemplateVoorstellen.getState().voorstellen).toBeNull();
    s.handelAf('voetnoot');
    expect(useTemplateVoorstellen.getState().voorstellen).toBeNull();
  });

  it('sluiten gooit alle voorstellen weg', () => {
    useTemplateVoorstellen.getState().zet({ garantie10: 'G' });
    useTemplateVoorstellen.getState().sluit();
    expect(useTemplateVoorstellen.getState().voorstellen).toBeNull();
  });
});
