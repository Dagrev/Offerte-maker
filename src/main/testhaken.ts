import { app } from 'electron';

// Testhaken (TDO §3, V-10). Alleen actief in een niet-verpakte app; in de geïnstalleerde versie heeft
// OFFERTE_MAKER_TESTHAAK geen effect.
export type TesthaakNaam = 'privacyfilter-uit' | 'vandaag' | 'agent-timeout' | 'pdf-bezet' | 'ipc-fout';

const bekendeHaken: readonly TesthaakNaam[] = [
  'privacyfilter-uit',
  'vandaag',
  'agent-timeout',
  'pdf-bezet',
  'ipc-fout',
];

/** Waarde per haak: `true` voor een vlag (`pdf-bezet`), de tekst na `=` voor een waarde (`vandaag=…`). */
export type Testhaken = ReadonlyMap<TesthaakNaam, string | true>;

function isBekend(naam: string): naam is TesthaakNaam {
  return (bekendeHaken as readonly string[]).includes(naam);
}

export function leesTesthaken(waarde: string | undefined, verpakt: boolean): Testhaken {
  const haken = new Map<TesthaakNaam, string | true>();
  if (verpakt || !waarde) return haken;
  for (const deel of waarde.split(',')) {
    const [naam = '', ...rest] = deel.trim().split('=');
    if (!isBekend(naam)) continue;
    haken.set(naam, rest.length > 0 ? rest.join('=').trim() : true);
  }
  return haken;
}

let actief: Testhaken = leesTesthaken(process.env['OFFERTE_MAKER_TESTHAAK'], app.isPackaged);

/** Alleen voor unit-tests: haken opnieuw instellen. */
export function zetTesthakenVoorTest(haken: Testhaken): void {
  actief = haken;
}

/** `false` als de haak niet aan staat, `true` voor een vlag, anders de waarde na `=`. */
export function testhaak(naam: TesthaakNaam): string | boolean {
  return actief.get(naam) ?? false;
}

const datumPatroon = /^\d{4}-\d{2}-\d{2}$/;

function tweeCijfers(n: number): string {
  return String(n).padStart(2, '0');
}

/** Datum in lokale tijd als `YYYY-MM-DD` (niet `toISOString()`, dat is UTC). */
export function lokaleDatum(datum: Date): string {
  return `${datum.getFullYear()}-${tweeCijfers(datum.getMonth() + 1)}-${tweeCijfers(datum.getDate())}`;
}

/** De enige bron voor "vandaag" in main (V-10); houdt rekening met de testhaak `vandaag=YYYY-MM-DD`. */
export function vandaag(): string {
  const haak = testhaak('vandaag');
  if (typeof haak === 'string' && datumPatroon.test(haak)) return haak;
  return lokaleDatum(new Date());
}
