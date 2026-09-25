import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Knop } from './Knop';

export interface BevestigingProps {
  open: boolean;
  titel: string;
  /** Uitleg onder de titel; mag ook eigen inhoud zijn (bijv. een tekstvak). */
  children?: ReactNode;
  bevestigLabel: string;
  annuleerLabel: string;
  opBevestig: () => void;
  opAnnuleer: () => void;
  /** Bevestigknop in de rode gevaarvariant (bijv. verwijderen). */
  gevaar?: boolean;
  /** Bevestigen tijdelijk uitschakelen (bijv. zolang een verplicht tekstvak leeg is). */
  bevestigUit?: boolean;
}

/**
 * Modaal venster met twee grote knoppen (TDO §13.3). Gebouwd op het native `<dialog>` met
 * `showModal()`: de focus blijft in het venster, Escape annuleert, en bij openen staat de focus op
 * Annuleren (de veilige keuze).
 */
export function Bevestiging({
  open,
  titel,
  children,
  bevestigLabel,
  annuleerLabel,
  opBevestig,
  opAnnuleer,
  gevaar = false,
  bevestigUit = false,
}: BevestigingProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titelId = useId();

  useEffect(() => {
    const dialoog = ref.current;
    if (!dialoog) return;
    if (open && !dialoog.open) dialoog.showModal();
    if (!open && dialoog.open) dialoog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titelId}
      onCancel={(e) => {
        e.preventDefault();
        opAnnuleer();
      }}
      className="m-auto w-full max-w-xl rounded-knop border border-rand bg-achtergrond p-8 text-tekst shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <div className="flex flex-col gap-6">
          <h2 id={titelId} className="text-2xl font-semibold">
            {titel}
          </h2>
          {children}
          <div className="flex flex-wrap justify-end gap-4">
            <Knop label={annuleerLabel} onClick={opAnnuleer} autoFocus />
            <Knop
              label={bevestigLabel}
              variant={gevaar ? 'gevaar' : 'hoofd'}
              onClick={opBevestig}
              disabled={bevestigUit}
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
