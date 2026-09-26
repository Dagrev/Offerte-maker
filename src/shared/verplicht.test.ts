import { describe, expect, it } from 'vitest';
import { legeKlant, legeKlusInvoer } from './nieuweOfferte';
import { standaardInstelling, verplichtSchema } from './schemas';
import {
  ALTIJD_VERPLICHT,
  heeftExtra,
  ontbrekendeVelden,
  STANDAARD_VERPLICHT,
  standaardVerplicht,
  VELD_STAP,
  VERPLICHT_VELDEN,
} from './verplicht';

// OFM-038: instelbare verplichte velden.

describe('standaard', () => {
  it('stap 1 helemaal verplicht, stap 2 en 3 niet (soort werk en dakvlak zijn altijd verplicht)', () => {
    for (const v of VERPLICHT_VELDEN) expect(STANDAARD_VERPLICHT[v]).toBe(VELD_STAP[v] === 1);
    expect(ALTIJD_VERPLICHT).toEqual(['soortWerk', 'dakvlak']);
    expect(VERPLICHT_VELDEN).not.toContain('soortWerk');
  });

  it('schema: ontbrekend = standaard, ook voor een later toegevoegd veld', () => {
    expect(standaardInstelling('verplicht')).toEqual(standaardVerplicht());
    expect(verplichtSchema.parse({ email: false })).toEqual({ ...standaardVerplicht(), email: false });
    expect(verplichtSchema.safeParse({ email: 'nee' }).success).toBe(false);
  });

  it('standaardVerplicht geeft een kopie', () => {
    const a = standaardVerplicht();
    a.email = false;
    expect(STANDAARD_VERPLICHT.email).toBe(true);
  });
});

describe('ontbrekendeVelden', () => {
  it('straat en huisnummer uit het ene opgeslagen veld', () => {
    const met = (straatHuisnummer: string) =>
      ontbrekendeVelden(
        { ...legeKlant(), adres: { straatHuisnummer, postcode: '', plaats: '' } },
        legeKlusInvoer(),
        standaardVerplicht(),
      ).filter((v) => v === 'straat' || v === 'huisnummer');
    expect(met('')).toEqual(['huisnummer', 'straat']);
    expect(met('Kerkstraat')).toEqual(['huisnummer']);
    expect(met('Kerkstraat 12a')).toEqual([]);
  });

  it('witruimte telt als leeg', () => {
    const v = ontbrekendeVelden({ ...legeKlant(), voornaam: '  ' }, legeKlusInvoer(), standaardVerplicht());
    expect(v).toContain('voornaam');
  });
});

describe('heeftExtra', () => {
  it('vaste extra of zelf toegevoegde extra met aantal > 0', () => {
    expect(heeftExtra(legeKlusInvoer())).toBe(false);
    expect(heeftExtra({ ...legeKlusInvoer(), daktrimM1: 0.5 })).toBe(true);
    expect(heeftExtra({ ...legeKlusInvoer(), extraAantallen: { zink: 0 } })).toBe(false);
    expect(heeftExtra({ ...legeKlusInvoer(), extraAantallen: { zink: 3 } })).toBe(true);
  });
});
