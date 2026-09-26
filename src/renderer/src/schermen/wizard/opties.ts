import { Circle, type LucideIcon } from 'lucide-react';
import type { Keuzeoptie } from '@shared/types';
import type { TegelOptie } from '../../componenten/TegelKeuze';

/**
 * Tegelopties uit een keuzelijst (OFM-034): de zichtbare opties in de ingestelde volgorde. Staat de
 * huidige waarde verborgen of is hij verwijderd, dan komt hij er grijs bij, zodat een oude offerte
 * niets verliest. Het icoon hoort bij de sleutel; een nieuwe optie krijgt een neutraal icoon.
 */
export function keuzeTegels(
  opties: readonly Keuzeoptie[],
  huidig: string | null,
  iconen: Record<string, LucideIcon>,
  vorm: (label: string) => string = (label) => label,
  standaardIcoon: LucideIcon = Circle,
): TegelOptie<string>[] {
  const tegels: TegelOptie<string>[] = [];
  for (const optie of opties) {
    if (optie.verborgen && optie.sleutel !== huidig) continue;
    tegels.push({
      waarde: optie.sleutel,
      label: vorm(optie.label),
      icoon: iconen[optie.sleutel] ?? standaardIcoon,
      ...(optie.verborgen && { verborgen: true }),
    });
  }
  if (huidig !== null && !opties.some((o) => o.sleutel === huidig)) {
    tegels.push({
      waarde: huidig,
      label: vorm(huidig),
      icoon: iconen[huidig] ?? standaardIcoon,
      verborgen: true,
    });
  }
  return tegels;
}

/** `plat dak` → `Plat dak` (tegels beginnen met een hoofdletter; het label zelf is voor lopende tekst). */
export function hoofdletter(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
