import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { AppFout } from '@shared/fouten';
import { renderOfferteHtml } from '@shared/pdf-template/render';
import { opmaakVoorbeeldModel } from '@shared/pdf-template/voorbeeldData';
import { bestandTeGroot } from '@shared/teksten/fouten';
import { BEDRIJF_VELDNAMEN, validatieMelding } from '@shared/teksten/validatie';
import { controleerBedrijfVelden } from '@shared/validatie';
import type { Instellingen, KanaalInvoer, Opmaak } from '@shared/types';
import { legeStatusCache } from '../agent/claudeStatus';
import { synchroniseerWerkmap } from '../agent/werkmap';
import { bewaarInstelling, haalInstelling, wijzigInstelling } from '../db/repo/instellingen';
import { database } from '../db/verbinding';
import { log } from '../log';
import { fontCss } from '../pdf/fonts';
import { vandaag } from '../testhaken';
import { herRedigeerVoorbeelden } from '../voorbeelden/herRedigeer';

// Instellingen voor de renderer (TDO §4.3, §6.2, §12.5; V-11, V-15, V-16, V-22). Eigenaar: OFM-018.
// `ipc/instellingen.ts` blijft dun en roept deze functies aan.

export const MAX_LOGO_MB = 5;
const LOGO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** Het logo als data-URI (V-15), of `null` als er geen (geldig) logo is. */
export function logoDataUri(logoBestandId: string | null): string | null {
  if (!logoBestandId) return null;
  const rij = database().prepare('SELECT mime, inhoud FROM bestanden WHERE id = ?').get(logoBestandId) as
    { mime: string; inhoud: Buffer } | undefined;
  if (!rij) return null;
  return `data:${rij.mime};base64,${Buffer.from(rij.inhoud).toString('base64')}`;
}

/** `instellingen:haal`: alle instellingen, gevalideerd, zonder de versleutelde API-sleutel (V-15). */
export function haalInstellingen(): Instellingen {
  const bedrijf = haalInstelling('bedrijf');
  const claude = haalInstelling('claude');
  return {
    bedrijf: { ...bedrijf, logoDataUri: logoDataUri(bedrijf.logoBestandId) },
    opmaak: haalInstelling('opmaak'),
    teksten: haalInstelling('teksten'),
    claude: {
      pad: claude.pad,
      model: claude.model,
      effort: claude.effort,
      apiSleutelIngevuld: claude.apiSleutelVersleuteld !== null,
    },
    app: { welkomVoltooid: haalInstelling('app').welkomVoltooid },
    verplicht: haalInstelling('verplicht'),
  };
}

/**
 * `instellingen:bewaar`. `bedrijf` houdt zijn logo en zet daarna de voorbeeldredactie en de
 * werkmap opnieuw (V-16); `claude` houdt de API-sleutel en leegt de statuscache (V-27).
 */
export async function bewaarInstellingen(invoer: KanaalInvoer<'instellingen:bewaar'>): Promise<null> {
  switch (invoer.sleutel) {
    case 'bedrijf': {
      // OFM-030: geldig en genormaliseerd; een ongeldige waarde die al zo opgeslagen stond mag blijven.
      const vorige = haalInstelling('bedrijf');
      const { waarde, fouten } = controleerBedrijfVelden(invoer.waarde, vorige);
      if (fouten.length > 0) throw new AppFout('VALIDATIE', validatieMelding(fouten, BEDRIJF_VELDNAMEN));
      const bedrijf = { ...waarde, logoBestandId: vorige.logoBestandId };
      bewaarInstelling('bedrijf', bedrijf);
      await herRedigeerVoorbeelden(bedrijf);
      synchroniseerWerkmap();
      break;
    }
    case 'opmaak':
      bewaarInstelling('opmaak', invoer.waarde);
      break;
    case 'teksten':
      bewaarInstelling('teksten', invoer.waarde);
      break;
    case 'claude':
      wijzigInstelling('claude', invoer.waarde);
      legeStatusCache();
      break;
    case 'verplicht':
      // OFM-038: Instellingen › Verplichte velden.
      bewaarInstelling('verplicht', invoer.waarde);
      break;
  }
  return null;
}

/** Logo uit een bestand op schijf opslaan in `bestanden` en koppelen; het oude logo verdwijnt. */
export function bewaarLogoBestand(pad: string): void {
  const mime = LOGO_MIME[extname(pad).toLowerCase()];
  if (!mime) throw new AppFout('BESTAND_TYPE_ONBEKEND');
  if (statSync(pad).size > MAX_LOGO_MB * 1024 * 1024) {
    throw new AppFout('BESTAND_TE_GROOT', bestandTeGroot(MAX_LOGO_MB));
  }
  const inhoud = readFileSync(pad);
  const db = database();
  const oud = haalInstelling('bedrijf').logoBestandId;
  const id = randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO bestanden (id, naam, mime, inhoud) VALUES (?, ?, ?, ?)').run(
      id,
      basename(pad),
      mime,
      inhoud,
    );
    wijzigInstelling('bedrijf', { logoBestandId: id });
    if (oud) db.prepare('DELETE FROM bestanden WHERE id = ?').run(oud);
  })();
  log.info(`logo bewaard (${mime}, ${inhoud.byteLength} bytes)`);
}

/** `instellingen:verwijderLogo`. */
export function verwijderLogo(): null {
  const db = database();
  const oud = haalInstelling('bedrijf').logoBestandId;
  db.transaction(() => {
    wijzigInstelling('bedrijf', { logoBestandId: null });
    if (oud) db.prepare('DELETE FROM bestanden WHERE id = ?').run(oud);
  })();
  return null;
}

/** `instellingen:opmaakVoorbeeld`: HTML in modus `voorbeeld` met de gevraagde opmaak (§12.5, V-22). */
export function opmaakVoorbeeldHtml(opmaak: Opmaak): { html: string } {
  const bedrijf = haalInstelling('bedrijf');
  const model = opmaakVoorbeeldModel({
    bedrijf,
    logoDataUri: logoDataUri(bedrijf.logoBestandId),
    opmaak,
    fontCss: fontCss(opmaak.lettertype),
    teksten: haalInstelling('teksten'),
    vandaag: vandaag(),
  });
  return { html: renderOfferteHtml(model, 'voorbeeld') };
}
