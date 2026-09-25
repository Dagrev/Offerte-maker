import { beforeEach, describe, expect, it } from 'vitest';
import type { Fout } from '@shared/fouten';
import { doelNaBezig, useNavigatie, type Bezig } from '../../src/renderer/src/stores/navigatie';

const fout: Fout = { code: 'AGENT_TIMEOUT', melding: 'Het duurde te lang.' };
const beginstand = useNavigatie.getState();

beforeEach(() => useNavigatie.setState(beginstand, true));

describe('start', () => {
  it('kiest het welkomstscherm als de welkom nog niet is voltooid (V-27)', () => {
    useNavigatie.getState().start({ vandaag: '2026-09-25', welkomVoltooid: false });
    expect(useNavigatie.getState()).toMatchObject({ gestart: true, scherm: 'welkom' });
  });

  it('kiest anders het overzicht en zet vandaag en de startdatum uit app:info (V-10)', () => {
    useNavigatie.getState().start({ vandaag: '2026-09-25', welkomVoltooid: true });
    expect(useNavigatie.getState()).toMatchObject({
      scherm: 'overzicht',
      vandaag: '2026-09-25',
      datum: '2026-09-25',
      weergave: 'maand',
    });
  });
});

describe('gaNaar', () => {
  it('zet de velden van het doel en wist de rest', () => {
    const { gaNaar } = useNavigatie.getState();
    gaNaar({ scherm: 'wizard', offerteId: 'a', wizardStap: 4, fout });
    expect(useNavigatie.getState()).toMatchObject({ scherm: 'wizard', offerteId: 'a', wizardStap: 4, fout });

    gaNaar({ scherm: 'instellingen', instellingenTab: 'prijzen' });
    const s = useNavigatie.getState();
    expect(s).toMatchObject({ scherm: 'instellingen', instellingenTab: 'prijzen' });
    expect([s.offerteId, s.wizardStap, s.fout, s.bezig]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('bewaart weergave en datum van het overzicht tijdens de sessie', () => {
    const { zetPeriode, gaNaar } = useNavigatie.getState();
    zetPeriode({ weergave: 'week', datum: '2026-10-01' });
    gaNaar({ scherm: 'detail', offerteId: 'x' });
    gaNaar({ scherm: 'overzicht' });
    zetPeriode({ datum: '2026-10-08' });
    expect(useNavigatie.getState()).toMatchObject({ weergave: 'week', datum: '2026-10-08' });
  });

  it('koppelt bij bezig het offerte-ID en wist een fout met wisFout', () => {
    const bezig: Bezig = { id: 'o1', soort: 'maken', terugNaar: 'wizard' };
    useNavigatie.getState().gaNaar({ scherm: 'bezig', bezig });
    expect(useNavigatie.getState()).toMatchObject({ scherm: 'bezig', offerteId: 'o1', bezig });

    useNavigatie.getState().gaNaar({ scherm: 'detail', offerteId: 'o1', fout });
    useNavigatie.getState().wisFout();
    expect(useNavigatie.getState().fout).toBeUndefined();
  });

  it('kent welkom, bewerken en prullenbak', () => {
    const { gaNaar } = useNavigatie.getState();
    gaNaar({ scherm: 'bewerken', offerteId: 'b' });
    expect(useNavigatie.getState()).toMatchObject({ scherm: 'bewerken', offerteId: 'b' });
    gaNaar({ scherm: 'prullenbak' });
    expect(useNavigatie.getState().scherm).toBe('prullenbak');
    gaNaar({ scherm: 'welkom' });
    expect(useNavigatie.getState().scherm).toBe('welkom');
  });
});

describe('Bezig-scherm (V-07)', () => {
  const maken: Bezig = { id: 'o1', soort: 'maken', terugNaar: 'wizard' };
  const aanpassen: Bezig = { id: 'o2', soort: 'aanpassen', terugNaar: 'detail' };
  const zonder: Bezig = { id: 'o3', soort: 'zonder_claude', terugNaar: 'wizard' };
  const teksten: Bezig = { id: 'template_teksten', soort: 'template_teksten', terugNaar: 'instellingen' };

  it('gaat bij succes naar detail, of voor template_teksten naar de tab Voorbeelden', () => {
    expect(doelNaBezig(maken)).toEqual({ scherm: 'detail', offerteId: 'o1' });
    expect(doelNaBezig(aanpassen)).toEqual({ scherm: 'detail', offerteId: 'o2' });
    expect(doelNaBezig(zonder)).toEqual({ scherm: 'detail', offerteId: 'o3' });
    expect(doelNaBezig(teksten)).toEqual({ scherm: 'instellingen', instellingenTab: 'voorbeelden' });
  });

  it('gaat bij een fout terug naar terugNaar, met de fout erbij', () => {
    expect(doelNaBezig(maken, fout)).toEqual({ scherm: 'wizard', offerteId: 'o1', wizardStap: 4, fout });
    expect(doelNaBezig(aanpassen, fout)).toEqual({ scherm: 'detail', offerteId: 'o2', fout });
    expect(doelNaBezig(teksten, fout)).toEqual({
      scherm: 'instellingen',
      instellingenTab: 'voorbeelden',
      fout,
    });
    expect(doelNaBezig({ ...teksten, soort: 'maken', id: 'o4' }, fout)).toEqual({
      scherm: 'instellingen',
      instellingenTab: 'voorbeelden',
      fout,
    });
  });

  it('bezigKlaar navigeert vanuit de store en doet niets zonder bezig', () => {
    const s = useNavigatie.getState();
    s.bezigKlaar();
    expect(useNavigatie.getState().scherm).toBe('overzicht');

    s.gaNaar({ scherm: 'bezig', bezig: maken });
    s.bezigKlaar(fout);
    expect(useNavigatie.getState()).toMatchObject({ scherm: 'wizard', offerteId: 'o1', wizardStap: 4, fout });
  });
});
