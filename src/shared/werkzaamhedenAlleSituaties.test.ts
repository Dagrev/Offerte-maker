import { describe, expect, it } from 'vitest';
import type { MateriaalTags, Werkzaamheid } from './types';
import {
  ALLE_TAGS,
  geldigeKiesbaar,
  isAlleSituaties,
  situatieKeuzes,
  zetSituatieMateriaal,
} from './werkzaamheden';

// OFM-058: Alle situaties. Alleen materialen met alle tags zijn gewoon kiesbaar; materialen met specifieke
// tags kies je per daksituatie (pure functies, 100 % branches).

const m = (id: string, tags: MateriaalTags = ALLE_TAGS) => ({ id, tags });
const ALLE = m('m-alle');
const LOS = m('m-los');
const HOUT = m('m-hout', { ondergrond: ['hout'], bedekking: 'alle' });
const EPDM = m('m-epdm', { ondergrond: 'alle', bedekking: ['epdm'] });
const MATERIALEN = [ALLE, EPDM, HOUT, LOS];
const HOUT_EPDM = { ondergrond: 'hout', bedekking: 'epdm' };
const BETON_EPDM = { ondergrond: 'beton', bedekking: 'epdm' };

type W = Pick<Werkzaamheid, 'materialen' | 'situaties'>;
const werk = (kiesbaar: string[], situaties: W['situaties'] = []): W => ({
  materialen: kiesbaar.map((materiaalId) => ({ materiaalId, standaard: false })),
  situaties,
});
const ids = (w: W) => w.materialen.map((k) => k.materiaalId);

describe('isAlleSituaties', () => {
  it('alleen als beide groepen alle zijn; één specifieke groep is genoeg voor specifiek', () => {
    expect(isAlleSituaties(ALLE)).toBe(true);
    expect(isAlleSituaties(HOUT)).toBe(false);
    expect(isAlleSituaties(EPDM)).toBe(false);
  });
});

describe('situatieKeuzes', () => {
  it('kiesbare materialen met Alle situaties en alle passende specifieke, in lijstvolgorde', () => {
    expect(situatieKeuzes(werk(['m-alle']), MATERIALEN, HOUT_EPDM).map((x) => x.id)).toEqual([
      'm-alle',
      'm-epdm',
      'm-hout',
    ]);
    // Beton: houtschroeven passen niet; m-los is niet kiesbaar.
    expect(situatieKeuzes(werk(['m-alle']), MATERIALEN, BETON_EPDM).map((x) => x.id)).toEqual([
      'm-alle',
      'm-epdm',
    ]);
  });
});

describe('zetSituatieMateriaal', () => {
  it('aanvinken zet het materiaal in de situatie en maakt het kiesbaar, in lijstvolgorde', () => {
    const w = zetSituatieMateriaal(werk(['m-alle']), MATERIALEN, HOUT_EPDM, 'm-hout', true);
    expect(w.situaties).toEqual([{ ...HOUT_EPDM, materiaalIds: ['m-hout'] }]);
    expect(ids(w)).toEqual(['m-alle', 'm-hout']);
    const w2 = zetSituatieMateriaal(w, MATERIALEN, HOUT_EPDM, 'm-alle', true);
    expect(w2.situaties).toEqual([{ ...HOUT_EPDM, materiaalIds: ['m-alle', 'm-hout'] }]);
    expect(ids(w2)).toEqual(['m-alle', 'm-hout']);
  });

  it('uitvinken: een specifiek materiaal zonder andere situatie is niet meer kiesbaar; lege situatie weg', () => {
    const w = werk(['m-alle', 'm-hout'], [{ ...HOUT_EPDM, materiaalIds: ['m-hout'] }]);
    const uit = zetSituatieMateriaal(w, MATERIALEN, HOUT_EPDM, 'm-hout', false);
    expect(uit.situaties).toEqual([]);
    expect(ids(uit)).toEqual(['m-alle']);
    // In een andere situatie blijft hij kiesbaar.
    const twee = werk(
      ['m-hout'],
      [
        { ...HOUT_EPDM, materiaalIds: ['m-hout'] },
        { ondergrond: 'hout', bedekking: 'pvc', materiaalIds: ['m-hout'] },
      ],
    );
    expect(ids(zetSituatieMateriaal(twee, MATERIALEN, HOUT_EPDM, 'm-hout', false))).toEqual(['m-hout']);
    // Een materiaal met Alle situaties blijft kiesbaar; een onbekend materiaal ook (main controleert).
    const alle = werk(['m-alle'], [{ ...HOUT_EPDM, materiaalIds: ['m-alle'] }]);
    expect(ids(zetSituatieMateriaal(alle, MATERIALEN, HOUT_EPDM, 'm-alle', false))).toEqual(['m-alle']);
    expect(ids(zetSituatieMateriaal(werk(['x']), MATERIALEN, HOUT_EPDM, 'x', false))).toEqual(['x']);
  });
});

describe('geldigeKiesbaar', () => {
  it('specifieke materialen buiten een situatie vallen weg en tellen; Alle situaties en onbekend blijven', () => {
    const zonderSituatie = werk(['m-alle', 'm-hout', 'm-epdm', 'onbekend']);
    const metSituatie = werk(['m-hout', 'm-epdm'], [{ ...HOUT_EPDM, materiaalIds: ['m-hout'] }]);
    const uit = geldigeKiesbaar([zonderSituatie, metSituatie], MATERIALEN);
    expect(uit.werkzaamheden.map(ids)).toEqual([['m-alle', 'onbekend'], ['m-hout']]);
    expect(uit.vervallen).toBe(3);
    expect(geldigeKiesbaar([werk(['m-alle'])], MATERIALEN).vervallen).toBe(0);
  });
});
