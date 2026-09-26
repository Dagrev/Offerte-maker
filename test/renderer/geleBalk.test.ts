import { beforeEach, describe, expect, it } from 'vitest';
import { isUitgeklapt, useGeleBalk } from '../../src/renderer/src/stores/geleBalk';
import { useNavigatie } from '../../src/renderer/src/stores/navigatie';
import { detail } from '../../src/renderer/src/teksten/detail';

const beginNavigatie = useNavigatie.getState();

beforeEach(() => {
  useNavigatie.setState(beginNavigatie, true);
  useGeleBalk.setState({ keuze: null });
});

describe('isUitgeklapt (OFM-036)', () => {
  it('staat standaard uitgeklapt bij 1 tot en met 3 punten, daarboven samengevouwen', () => {
    expect(isUitgeklapt(null, 'a', 1)).toBe(true);
    expect(isUitgeklapt(null, 'a', 3)).toBe(true);
    expect(isUitgeklapt(null, 'a', 4)).toBe(false);
    expect(isUitgeklapt(null, 'a', 19)).toBe(false);
  });

  it('volgt de keuze voor dezelfde offerte en negeert die van een andere', () => {
    expect(isUitgeklapt({ offerteId: 'a', uitgeklapt: true }, 'a', 19)).toBe(true);
    expect(isUitgeklapt({ offerteId: 'a', uitgeklapt: false }, 'a', 2)).toBe(false);
    expect(isUitgeklapt({ offerteId: 'a', uitgeklapt: true }, 'b', 19)).toBe(false);
  });
});

describe('useGeleBalk', () => {
  it('bewaart de keuze zolang dezelfde offerte open is (ook via Bewerken en terug)', () => {
    const { gaNaar } = useNavigatie.getState();
    gaNaar({ scherm: 'detail', offerteId: 'a' });
    useGeleBalk.getState().zet('a', true);
    gaNaar({ scherm: 'bewerken', offerteId: 'a' });
    gaNaar({ scherm: 'detail', offerteId: 'a' });
    expect(useGeleBalk.getState().keuze).toEqual({ offerteId: 'a', uitgeklapt: true });
  });

  it('vergeet de keuze zodra de offerte gesloten of een andere geopend wordt', () => {
    const { gaNaar } = useNavigatie.getState();
    gaNaar({ scherm: 'detail', offerteId: 'a' });
    useGeleBalk.getState().zet('a', true);
    gaNaar({ scherm: 'overzicht' });
    expect(useGeleBalk.getState().keuze).toBeNull();

    gaNaar({ scherm: 'detail', offerteId: 'a' });
    useGeleBalk.getState().zet('a', false);
    gaNaar({ scherm: 'detail', offerteId: 'b' });
    expect(useGeleBalk.getState().keuze).toBeNull();
  });
});

describe('aantalPunten', () => {
  it('telt enkelvoud en meervoud', () => {
    expect(detail.aantalPunten(1)).toBe('1 punt');
    expect(detail.aantalPunten(19)).toBe('19 punten');
  });
});
