import type { Fout, Resultaat } from '@shared/fouten';
import { FOUTMELDINGEN } from '@shared/teksten/fouten';

// Gedeelde hulp voor de api-hooks (TDO §13.1). Een hook roept `window.api` aan via `roep()`; een
// `Resultaat` met `ok: false` wordt een `ApiFout`, die react-query als `error` doorgeeft en die
// `Foutmelding` via `alsFout()` toont.

export class ApiFout extends Error {
  readonly fout: Fout;

  constructor(fout: Fout) {
    super(`${fout.code}: ${fout.melding}`);
    this.name = 'ApiFout';
    this.fout = fout;
  }
}

/**
 * Wacht op een `window.api`-aanroep en geeft `data` terug, of gooit `ApiFout`.
 * Gebruik: `queryFn: () => roep(window.api.offerteHaal({ id }))`.
 */
export async function roep<T>(aanroep: Promise<Resultaat<T>>): Promise<T> {
  const resultaat = await aanroep;
  if (resultaat.ok) return resultaat.data;
  throw new ApiFout(resultaat.fout);
}

/** Maakt van elke fout iets wat `Foutmelding` kan tonen; onverwachte fouten worden `ONBEKEND`. */
export function alsFout(fout: unknown): Fout {
  if (fout instanceof ApiFout) return fout.fout;
  return { code: 'ONBEKEND', melding: FOUTMELDINGEN.ONBEKEND };
}
