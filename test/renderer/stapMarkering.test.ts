import { describe, expect, it } from 'vitest';
import type { WizardPunt } from '../../src/shared/wizardControle';
import { stapMarkeringen } from '../../src/renderer/src/componenten/stapMarkering';

describe('stapMarkeringen (OFM-042)', () => {
  it('per stap het aantal en de teksten van de samenvatting', () => {
    const punten: WizardPunt[] = [
      { stap: 1, soort: 'ontbreekt', veld: 'achternaam' },
      { stap: 1, soort: 'ongeldig', veld: 'telefoon', fout: 'telefoon' },
      { stap: 2, soort: 'ontbreekt', veld: 'dakvlak' },
    ];
    const m = stapMarkeringen(punten);
    expect(m).toHaveLength(4);
    expect(m[0]?.aantal).toBe(2);
    expect(m[0]?.punten[0]).toBe('Achternaam ontbreekt');
    expect(m[0]?.punten[1]).toContain('10 cijfers');
    expect(m[1]).toEqual({ aantal: 1, punten: ['Geen dakvlak ingevuld'] });
    expect(m[2]).toEqual({ aantal: 0, punten: [] });
    expect(m[3]).toEqual({ aantal: 0, punten: [] });
  });
});
