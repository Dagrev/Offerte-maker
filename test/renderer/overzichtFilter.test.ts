import { beforeEach, describe, expect, it } from 'vitest';
import { useOverzichtFilter } from '../../src/renderer/src/stores/overzichtFilter';

// OFM-053: filter en ordening van het hoofdscherm.

beforeEach(() => useOverzichtFilter.setState({ statussen: [], ordening: 'datum' }));

describe('useOverzichtFilter', () => {
  it('begint leeg (alle statussen) en op datum', () => {
    expect(useOverzichtFilter.getState()).toMatchObject({ statussen: [], ordening: 'datum' });
  });

  it('wisselt statussen aan en uit, in knopvolgorde; wissen = alle', () => {
    const { wisselStatus, wisStatussen } = useOverzichtFilter.getState();
    wisselStatus('akkoord');
    wisselStatus('concept');
    expect(useOverzichtFilter.getState().statussen).toEqual(['concept', 'akkoord']);
    wisselStatus('akkoord');
    expect(useOverzichtFilter.getState().statussen).toEqual(['concept']);
    wisStatussen();
    expect(useOverzichtFilter.getState().statussen).toEqual([]);
  });

  it('zet de ordening', () => {
    useOverzichtFilter.getState().zetOrdening('nummer_af');
    expect(useOverzichtFilter.getState().ordening).toBe('nummer_af');
  });
});
