import { database } from '../verbinding';

// Voorbeelden (TDO §4.2). OFM-012 levert alleen wat de agentwerkmap nodig heeft; OFM-019 breidt uit.

export interface GoedgekeurdVoorbeeld {
  id: string;
  tekst: string;
  isTemplate: boolean;
  aangemaaktOp: string;
}

/** Goedgekeurde voorbeelden (incl. template), oudste eerst. Geen bestandsnamen (§10.3). */
export function haalGoedgekeurdeVoorbeelden(): GoedgekeurdVoorbeeld[] {
  const rijen = database()
    .prepare(
      "SELECT id, tekst_geanonimiseerd, is_template, aangemaakt_op FROM voorbeelden WHERE status = 'goedgekeurd' ORDER BY aangemaakt_op, id",
    )
    .all() as { id: string; tekst_geanonimiseerd: string; is_template: number; aangemaakt_op: string }[];
  return rijen.map((r) => ({
    id: r.id,
    tekst: r.tekst_geanonimiseerd,
    isTemplate: r.is_template === 1,
    aangemaaktOp: r.aangemaakt_op,
  }));
}
