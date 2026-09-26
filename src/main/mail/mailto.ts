import { AppFout } from '@shared/fouten';
import type { MailConcept } from './concept';

// Terugval zonder bijlage (OFM-041): `mailto:` met aan, onderwerp en tekst via `shell.openExternal`,
// en de PDF geselecteerd in Verkenner, zodat de gebruiker hem in de mail kan slepen.

/** Windows geeft een `mailto:` van meer dan ±2 000 tekens niet door; de tekst wordt dan ingekort. */
export const MAX_MAILTO_LENGTE = 2000;

export interface MailShell {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (pad: string) => void;
}

function bouw(aan: string, onderwerp: string, tekst: string): string {
  return (
    `mailto:${encodeURIComponent(aan)}` +
    `?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekst)}`
  );
}

/** Begin van de tekst met `n` tekens, zonder half surrogaatpaar (encodeURIComponent gooit daarop). */
function begin(tekst: string, n: number): string {
  const stuk = tekst.slice(0, n);
  return /[\uD800-\uDBFF]$/.test(stuk) ? stuk.slice(0, -1) : stuk;
}

/** `mailto:`-URL; is die te lang, dan het langste begin van de tekst dat past (binair zoeken). */
export function mailtoUrl(concept: MailConcept): string {
  const url = (n: number) => bouw(concept.aan, concept.onderwerp, begin(concept.tekst, n));
  if (url(concept.tekst.length).length <= MAX_MAILTO_LENGTE) return url(concept.tekst.length);
  let laag = 0;
  let hoog = concept.tekst.length;
  while (laag < hoog) {
    const midden = Math.ceil((laag + hoog) / 2);
    if (url(midden).length <= MAX_MAILTO_LENGTE) laag = midden;
    else hoog = midden - 1;
  }
  return url(laag);
}

/** Opent het concept via `mailto:`; lukt dat niet, dan `MAIL_GEEN_PROGRAMMA`. */
export async function openViaMailto(concept: MailConcept, pdfPad: string, shell: MailShell): Promise<void> {
  try {
    await shell.openExternal(mailtoUrl(concept));
  } catch {
    throw new AppFout('MAIL_GEEN_PROGRAMMA');
  }
  shell.showItemInFolder(pdfPad);
}
