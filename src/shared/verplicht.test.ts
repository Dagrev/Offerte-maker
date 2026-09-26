import { describe, expect, it } from 'vitest';
import { legeKlant, legeKlusInvoer } from './nieuweOfferte';
import { standaardInstelling, verplichtSchema } from './schemas';
import {
  ALTIJD_VERPLICHT,
  ontbrekendeVelden,
  STANDAARD_VERPLICHT,
  standaardVerplicht,
  VELD_STAP,
  VERPLICHT_VELDEN,
} from './verplicht';

// OFM-038: instelbare verplichte velden.

describe('standaard', () => {
  it('stap 1 helemaal verplicht, stap 2 niet, stap 3 minstens één werkzaamheid (OFM-044)', () => {
    for (const v of VERPLICHT_VELDEN) {
      expect(STANDAARD_VERPLICHT[v]).toBe(VELD_STAP[v] === 1 || v === 'werkzaamheid');
    }
    expect(VELD_STAP.soortWerk).toBe(3);
    expect(VELD_STAP.hoogte).toBe(2);
    expect(ALTIJD_VERPLICHT).toEqual(['soortWerk', 'dakvlak']);
    expect(VERPLICHT_VELDEN).not.toContain('soortWerk');
    // OFM-046: het tussenvoegsel is nooit verplicht en staat dus niet in de tab Verplichte velden.
    expect(VERPLICHT_VELDEN as readonly string[]).not.toContain('tussenvoegsel');
    expect(ontbrekendeVelden(legeKlant(), legeKlusInvoer(), standaardVerplicht())).not.toContain(
      'tussenvoegsel',
    );
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

  it('OFM-049: hoogte zonder standaard (null) ontbreekt als hij verplicht is', () => {
    const invoer = legeKlusInvoer({});
    expect(invoer.hoogte).toBeNull();
    expect(ontbrekendeVelden(legeKlant(), invoer, { ...standaardVerplicht(), hoogte: true })).toContain(
      'hoogte',
    );
    expect(ontbrekendeVelden(legeKlant(), invoer, standaardVerplicht())).not.toContain('hoogte');
    expect(
      ontbrekendeVelden(legeKlant(), legeKlusInvoer(), { ...standaardVerplicht(), hoogte: true }),
    ).not.toContain('hoogte');
  });

  it('witruimte telt als leeg', () => {
    const v = ontbrekendeVelden({ ...legeKlant(), voornaam: '  ' }, legeKlusInvoer(), standaardVerplicht());
    expect(v).toContain('voornaam');
  });
});
