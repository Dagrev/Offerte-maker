import { useRef, useState, type FocusEvent, type InputHTMLAttributes, type MouseEvent } from 'react';
import { invoerKlassen, VeldOmlijsting, type VeldMeldingen } from './Veld';
import { leesGetal, schoonGetalInvoer, tekstVolgtWaarde, toonGetal } from './getalNotatie';

export type GetalVeldProps = VeldMeldingen & {
  waarde: number | null;
  /**
   * Nieuwe waarde bij elke geldige tussenwaarde tijdens het typen. Een leeggemaakt veld meldt pas
   * bij het verlaten `null` (telt als 0), zodat er geen tussentijdse 0 wordt bewaard.
   */
  opWijzig: (waarde: number | null) => void;
  /** Aantal decimalen na de komma; 0 = alleen hele getallen. Standaard 2. */
  decimalen?: number;
  /** Eenheid rechts naast het veld, bijv. "m²" (uit `teksten/`). */
  eenheid?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode' | 'id'>;

/**
 * Selecteert de hele inhoud van een getalveld bij focus (Tab én klik), zodat het eerste teken de
 * oude waarde (vaak een 0) vervangt. Bij een klik zou het loslaten van de muisknop de selectie weer
 * opheffen; dat wordt alleen voor die eerste klik tegengehouden, daarna zet klikken de cursor.
 */
export function useSelecteerBijFocus() {
  const netGefocust = useRef(false);
  return {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      netGefocust.current = true;
      e.currentTarget.select();
    },
    onMouseUp: (e: MouseEvent<HTMLInputElement>) => {
      if (netGefocust.current) e.preventDefault();
      netGefocust.current = false;
    },
    onKeyDown: () => {
      netGefocust.current = false;
    },
  };
}

/** Getal met komma als decimaalteken, nooit negatief (TDO §13.3). */
export function GetalVeld({
  label,
  hint,
  waarschuwing,
  fout,
  waarde,
  opWijzig,
  decimalen = 2,
  eenheid,
  className = '',
  placeholder = '0',
  onBlur,
  onFocus,
  onMouseUp,
  onKeyDown,
  ...rest
}: GetalVeldProps) {
  // Tijdens het bewerken is de tekst leidend; pas bij het verlaten wordt hij genormaliseerd.
  const [tekst, setTekst] = useState(() => toonGetal(waarde, decimalen));
  const [bekend, setBekend] = useState(waarde);
  const selecteer = useSelecteerBijFocus();

  // Waarde van buiten gewijzigd (bijv. teruggezet): tekst bijwerken tijdens het renderen.
  if (waarde !== bekend) {
    setBekend(waarde);
    if (tekstVolgtWaarde(tekst, waarde)) setTekst(toonGetal(waarde, decimalen));
  }

  return (
    <VeldOmlijsting label={label} hint={hint} waarschuwing={waarschuwing} fout={fout}>
      {(aria) => (
        <div className="flex items-center gap-3">
          <input
            {...rest}
            {...aria}
            type="text"
            inputMode={decimalen > 0 ? 'decimal' : 'numeric'}
            autoComplete="off"
            placeholder={placeholder}
            className={`${invoerKlassen} text-right tabular-nums placeholder:text-tekst-zacht ${className}`}
            value={tekst}
            onFocus={(e) => {
              selecteer.onFocus(e);
              onFocus?.(e);
            }}
            onMouseUp={(e) => {
              selecteer.onMouseUp(e);
              onMouseUp?.(e);
            }}
            onKeyDown={(e) => {
              selecteer.onKeyDown();
              onKeyDown?.(e);
            }}
            onChange={(e) => {
              const schoon = schoonGetalInvoer(e.target.value, decimalen);
              setTekst(schoon);
              // Alleen een geldige tussenwaarde doorgeven; een (tijdelijk) leeg veld pas bij blur.
              const getal = leesGetal(schoon);
              if (getal === null || getal === bekend) return;
              setBekend(getal);
              opWijzig(getal);
            }}
            onBlur={(e) => {
              const getal = leesGetal(tekst);
              // Leeg blijft leeg (placeholder 0); anders genormaliseerd, bijv. `12,` → `12`.
              setTekst(toonGetal(getal, decimalen));
              if (getal !== bekend) {
                setBekend(getal);
                opWijzig(getal);
              }
              onBlur?.(e);
            }}
          />
          {eenheid && <span className="shrink-0 text-tekst-zacht">{eenheid}</span>}
        </div>
      )}
    </VeldOmlijsting>
  );
}
