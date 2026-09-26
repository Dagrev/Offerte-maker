import type { KlusInvoer } from './types';

// De velden van de oude wizardstap Extra's (vóór OFM-044). Nieuwe offertes hebben ze niet meer; oude
// offertes wel, tot de omzetting in OFM-045. `oudeVelden` vult ontbrekende velden aan met de waarden
// van "niets gekozen" (zoals de lege invoer van vóór OFM-044), zodat de oude logica (Maak zonder Claude,
// agentopdracht, keuzelijsten in gebruik) voor een nieuwe offerte niets oplevert.

export interface OudeVelden {
  bedekking: string | null;
  bedekkingAnders: string;
  slopenEnAfvoeren: boolean;
  isolatie: string;
  isolatieAndersMm: number | null;
  daktrimM1: number;
  dakgootM1: number;
  hwaAantal: number;
  noodoverloopAantal: number;
  doorvoerAantal: number;
  lichtkoepelAantal: number;
  afwerking: string;
  extraAantallen: Record<string, number>;
}

export type OudeInvoer = Partial<Pick<KlusInvoer, keyof OudeVelden>>;

export function oudeVelden(invoer: OudeInvoer): OudeVelden {
  return {
    bedekking: invoer.bedekking ?? null,
    bedekkingAnders: invoer.bedekkingAnders ?? '',
    slopenEnAfvoeren: invoer.slopenEnAfvoeren ?? false,
    isolatie: invoer.isolatie ?? 'geen',
    isolatieAndersMm: invoer.isolatieAndersMm ?? null,
    daktrimM1: invoer.daktrimM1 ?? 0,
    dakgootM1: invoer.dakgootM1 ?? 0,
    hwaAantal: invoer.hwaAantal ?? 0,
    noodoverloopAantal: invoer.noodoverloopAantal ?? 0,
    doorvoerAantal: invoer.doorvoerAantal ?? 0,
    lichtkoepelAantal: invoer.lichtkoepelAantal ?? 0,
    afwerking: invoer.afwerking ?? 'geen',
    extraAantallen: invoer.extraAantallen ?? {},
  };
}

/** Heeft deze invoer nog iets uit de oude stap Extra's (een oude offerte)? */
export function heeftOudeKeuzes(invoer: OudeInvoer): boolean {
  const o = oudeVelden(invoer);
  return (
    o.bedekking !== null ||
    o.slopenEnAfvoeren ||
    o.isolatie !== 'geen' ||
    o.afwerking !== 'geen' ||
    o.daktrimM1 + o.dakgootM1 + o.hwaAantal + o.noodoverloopAantal + o.doorvoerAantal + o.lichtkoepelAantal >
      0 ||
    Object.values(o.extraAantallen).some((n) => n > 0)
  );
}
