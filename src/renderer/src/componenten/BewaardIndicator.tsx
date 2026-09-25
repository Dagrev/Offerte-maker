import { useEffect, useState } from 'react';
import { nl } from '../teksten/nl';

const ZICHTBAAR_MS = 2000;

export interface BewaardIndicatorProps {
  /**
   * Teller die het scherm na elke geslaagde bewaaractie ophoogt (bijv. in `onSuccess` van de
   * mutatie). Elke nieuwe waarde boven 0 toont "Bewaard ✓" 2 seconden.
   */
  signaal: number;
}

/** "Bewaard ✓", 2 s zichtbaar na elke bewaaractie (TDO §13.3, §13.4 Instellingen). */
export function BewaardIndicator({ signaal }: BewaardIndicatorProps) {
  const [verlopen, setVerlopen] = useState(0);

  useEffect(() => {
    if (signaal <= 0) return;
    const timer = setTimeout(() => setVerlopen(signaal), ZICHTBAAR_MS);
    return () => clearTimeout(timer);
  }, [signaal]);

  // Zichtbaar zolang de timer voor dít signaal nog niet is afgelopen.
  const zichtbaar = signaal > 0 && verlopen !== signaal;

  return (
    <span role="status" aria-live="polite" className="inline-block min-w-32 font-semibold text-goed">
      {zichtbaar ? nl.componenten.bewaard : ''}
    </span>
  );
}
