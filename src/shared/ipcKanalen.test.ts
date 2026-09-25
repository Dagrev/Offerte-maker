import { describe, expect, expectTypeOf, it } from 'vitest';
import { AppFout, FOUT_ACTIE, FOUT_CODES, nietBeschikbaar, type Resultaat } from './fouten';
import { IPC_KANALEN, VOORTGANG_KANAAL, apiNaam } from './ipcKanalen';
import { invoerSchemas } from './schemas';
import { FOUTMELDINGEN, VALIDATIE_MELDINGEN, bestandTeGroot } from './teksten/fouten';
import type { Api, AppInfo, OfferteDetail, Voortgang } from './types';

describe('ipcKanalen', () => {
  it('bevat alle 49 kanalen uit §6.2, uniek, elk met een invoerschema', () => {
    expect(IPC_KANALEN).toHaveLength(49);
    expect(new Set(IPC_KANALEN).size).toBe(49);
    expect(Object.keys(invoerSchemas).sort()).toEqual([...IPC_KANALEN].sort());
    expect(IPC_KANALEN).toContain('app:openMap');
    expect(IPC_KANALEN).toContain('claude:kiesPad');
    expect(VOORTGANG_KANAAL).toBe('offerte:voortgang');
  });

  it('apiNaam maakt camelCase van de kanaalnaam', () => {
    expect(apiNaam('offerte:maak')).toBe('offerteMaak');
    expect(apiNaam('app:info')).toBe('appInfo');
    expect(apiNaam('instellingen:kiesLogo')).toBe('instellingenKiesLogo');
    expect(new Set(IPC_KANALEN.map(apiNaam)).size).toBe(49);
  });

  it('window.api heeft getypeerde in- en uitvoer', () => {
    expectTypeOf<Api['appInfo']>().toEqualTypeOf<() => Promise<Resultaat<AppInfo>>>();
    expectTypeOf<Api['offerteHaal']>().parameters.toEqualTypeOf<[{ id: string }]>();
    expectTypeOf<Api['offerteHaal']>().returns.toEqualTypeOf<Promise<Resultaat<OfferteDetail>>>();
    expectTypeOf<Api['opVoortgang']>().parameters.toEqualTypeOf<[(voortgang: Voortgang) => void]>();
    expectTypeOf<Api>().not.toHaveProperty('invoke');
  });
});

describe('fouten (§15.1, V-19)', () => {
  it('heeft 18 codes, elk met melding en actie', () => {
    expect(FOUT_CODES).toHaveLength(18);
    for (const code of FOUT_CODES) {
      expect(FOUTMELDINGEN[code].length).toBeGreaterThan(0);
      expect(FOUT_ACTIE).toHaveProperty(code);
    }
    expect(FOUT_ACTIE.PRIVACY_GEBLOKKEERD).toBe('naarOverig');
    expect(FOUT_ACTIE.LIMIET_BEREIKT).toBeNull();
  });

  it('meldingen staan letterlijk zoals in het ontwerp', () => {
    expect(FOUTMELDINGEN.BACKUP_MISLUKT).toBe(
      'De back-up is niet gelukt. Probeer het opnieuw of vraag de beheerder.',
    );
    expect(FOUTMELDINGEN.HERSTEL_MISLUKT).toBe('Terugzetten is niet gelukt. Er is niets veranderd.');
    expect(bestandTeGroot(5)).toBe('Dit bestand is te groot (maximaal 5 MB).');
    expect(FOUTMELDINGEN.BESTAND_TE_GROOT).toBe('Dit bestand is te groot (maximaal 20 MB).');
    expect(VALIDATIE_MELDINGEN.eerstDefinitief).toBe('Maak de offerte eerst definitief.');
    expect(VALIDATIE_MELDINGEN.eerstGoedkeuren).toBe('Keur dit voorbeeld eerst goed.');
  });

  it('AppFout gebruikt de standaardmelding tenzij er een eigen is', () => {
    expect(new AppFout('GEEN_INTERNET').melding).toBe(FOUTMELDINGEN.GEEN_INTERNET);
    expect(new AppFout('VALIDATIE', 'Eigen tekst.').melding).toBe('Eigen tekst.');
    expect(() => nietBeschikbaar()).toThrow(AppFout);
  });
});
