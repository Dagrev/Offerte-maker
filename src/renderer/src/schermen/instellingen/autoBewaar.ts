import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fout } from '@shared/fouten';
import { alsFout } from '../../api/roep';

export const BEWAAR_NA_MS = 800;

/**
 * Automatisch bewaren (FE-075): `wijzig(waarde)` bewaart na 800 ms zonder nieuwe wijziging,
 * `bewaarNu()` meteen (bij `blur`), en bij het verlaten van de tab gaat een wachtende wijziging alsnog
 * weg. `signaal` loopt op na elke geslaagde bewaaractie (voor `BewaardIndicator`). Met `geldig` kan
 * een scherm een ongeldige tussenstand (bijv. een halve kleurcode) overslaan.
 */
export function useAutoBewaar<T>(bewaar: (waarde: T) => Promise<unknown>, geldig?: (waarde: T) => boolean) {
  const [signaal, setSignaal] = useState(0);
  const [fout, setFout] = useState<Fout | null>(null);
  const wachtend = useRef<{ waarde: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bewaarRef = useRef(bewaar);
  const geldigRef = useRef(geldig);
  useEffect(() => {
    bewaarRef.current = bewaar;
    geldigRef.current = geldig;
  });

  const bewaarNu = useCallback(() => {
    clearTimeout(timer.current);
    const item = wachtend.current;
    if (!item) return;
    wachtend.current = null;
    if (geldigRef.current && !geldigRef.current(item.waarde)) return;
    bewaarRef.current(item.waarde).then(
      () => {
        setFout(null);
        setSignaal((s) => s + 1);
      },
      (e: unknown) => setFout(alsFout(e)),
    );
  }, []);

  const wijzig = useCallback(
    (waarde: T) => {
      wachtend.current = { waarde };
      clearTimeout(timer.current);
      timer.current = setTimeout(bewaarNu, BEWAAR_NA_MS);
    },
    [bewaarNu],
  );

  /** Direct bewaren zonder wachten (bijv. een klik op een tegel). */
  const bewaarDirect = useCallback(
    (waarde: T) => {
      wachtend.current = { waarde };
      bewaarNu();
    },
    [bewaarNu],
  );

  // Tab verlaten of scherm sluiten: wachtende wijziging niet kwijtraken.
  useEffect(() => bewaarNu, [bewaarNu]);

  return { wijzig, bewaarNu, bewaarDirect, signaal, fout };
}
