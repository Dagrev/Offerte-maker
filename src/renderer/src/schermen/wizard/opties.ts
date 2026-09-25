import type { LucideIcon } from 'lucide-react';
import type { TegelOptie } from '../../componenten/TegelKeuze';

/** Tegelopties uit een labelmap (`@shared/labels`) en een icoon per waarde, in de volgorde van de map. */
export function opties<T extends string>(
  labels: Record<T, string>,
  iconen: Record<T, LucideIcon>,
): TegelOptie<T>[] {
  return (Object.keys(labels) as T[]).map((waarde) => ({
    waarde,
    label: labels[waarde],
    icoon: iconen[waarde],
  }));
}

/** `plat dak` → `Plat dak` (tegels beginnen met een hoofdletter; het label zelf is voor lopende tekst). */
export function hoofdletter(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
