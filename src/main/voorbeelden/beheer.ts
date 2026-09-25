import { readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';
import { AppFout, type FoutCode } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { KanaalUitvoer, VoorbeeldItem } from '@shared/types';
import { synchroniseerWerkmap } from '../agent/werkmap';
import { haalInstelling } from '../db/repo/instellingen';
import * as repo from '../db/repo/voorbeelden';
import { log } from '../log';
import { redigeerVoorbeeld } from '../privacy/voorbeeldRedactie';
import { controleerVoorbeeldbestand, haalTekstUit } from './tekstExtractie';

// Beheer van voorbeeldoffertes (TDO §6.2, §10.3, §11.5, §17; FE-080 t/m 083, FE-085; V-16).
// Eigenaar: OFM-019. `ipc/voorbeelden.ts` blijft dun (alleen de bestandsdialoog) en roept deze
// functies aan. Elke wijziging die de agentwerkmap raakt, synchroniseert die daarna (§10.3).

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

function nietGevonden(): AppFout {
  return new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
}

function bestaat(id: string): repo.Voorbeeld {
  const voorbeeld = repo.haalVoorbeeld(id);
  if (!voorbeeld) throw nietGevonden();
  return voorbeeld;
}

/**
 * Eén pad controleren (§17: absoluut, bestaand bestand, `.pdf`/`.docx`, ≤ 20 MB), de tekst lokaal
 * eruit halen, redigeren en opslaan met status `te_controleren`. Gooit `AppFout`.
 */
async function voegEenToe(pad: string): Promise<string> {
  const naam = basename(pad);
  if (!isAbsolute(pad)) throw nietGevonden();
  controleerVoorbeeldbestand(naam, 0); // eerst het type: een map of `.jpg` heeft geen stat nodig
  let grootte: number;
  try {
    const info = statSync(pad);
    if (!info.isFile()) throw new Error('geen bestand');
    grootte = info.size;
  } catch {
    throw new AppFout('BESTAND_ONLEESBAAR');
  }
  const soort = controleerVoorbeeldbestand(naam, grootte);
  const inhoud = readFileSync(pad);
  const bron = await haalTekstUit(inhoud, naam);
  const tekst = redigeerVoorbeeld(bron, haalInstelling('bedrijf'), []);
  return repo.voegVoorbeeldToe({ bestandsnaam: naam, mime: MIME[soort], inhoud, tekst });
}

/**
 * `voorbeelden:voegToe` met paden (FE-080, FE-081). Een fout bij één bestand houdt de andere niet
 * tegen. Nieuwe voorbeelden staan op `te_controleren` en komen dus nog niet in de werkmap.
 */
export async function voegVoorbeeldenToe(
  paden: readonly string[],
): Promise<KanaalUitvoer['voorbeelden:voegToe']> {
  const toegevoegd: string[] = [];
  const fouten: { bestandsnaam: string; code: FoutCode }[] = [];
  for (const pad of paden) {
    try {
      toegevoegd.push(await voegEenToe(pad));
    } catch (fout) {
      const code: FoutCode = fout instanceof AppFout ? fout.code : 'ONBEKEND';
      // Nooit de bestandsnaam loggen: die kan een klantnaam bevatten (§15.3).
      if (code === 'ONBEKEND') log.error('voorbeeld toevoegen mislukt', fout);
      else log.warn(`voorbeeld niet toegevoegd: ${code}`);
      fouten.push({ bestandsnaam: basename(pad), code });
    }
  }
  log.info(`voorbeelden toegevoegd: ${toegevoegd.length}, fouten: ${fouten.length}`);
  return { toegevoegd, fouten };
}

export function lijstVoorbeelden(): VoorbeeldItem[] {
  return repo.lijstVoorbeelden();
}

/** `voorbeelden:haal`: de geanonimiseerde tekst voor de review (FE-082). */
export function haalVoorbeeld(id: string): KanaalUitvoer['voorbeelden:haal'] {
  const v = bestaat(id);
  return {
    id: v.id,
    bestandsnaam: v.bestandsnaam,
    tekst: v.tekst,
    status: v.status,
    isTemplate: v.isTemplate,
  };
}

/**
 * `voorbeelden:maakOnleesbaar` (FE-082, §11.5 laatste alinea, V-16). Het fragment wordt een
 * handmatige redactie; daarna volgt de hele redactie opnieuw vanaf de tekst uit het originele
 * bestand. De status blijft zoals hij was. Stap 6 werkt op het resultaat van stap 1–5, dus een
 * selectie over een zwart balkje heen (`… [VERWIJDERD] …`) werkt ook.
 */
export async function maakOnleesbaar(id: string, fragment: string): Promise<{ tekst: string }> {
  const v = bestaat(id);
  const schoon = fragment.trim();
  // Minstens 2 letters of cijfers buiten de balkjes: alleen `[VERWIJDERD]` of leestekens doet niets.
  const inhoud = schoon.replace(/\[(?:VERWIJDERD|BEDRIJF)\]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  if ([...inhoud].length < 2) throw nietGevonden();

  const alBekend = v.handmatigeRedacties.some((r) => r.toLowerCase() === schoon.toLowerCase());
  // Een fragment dat niet (meer) in de tekst staat, doet niets: niet opslaan.
  if (alBekend || !v.tekst.toLowerCase().includes(schoon.toLowerCase())) return { tekst: v.tekst };

  const origineel = repo.haalOrigineel(id);
  if (!origineel) throw nietGevonden();
  const redacties = [...v.handmatigeRedacties, schoon];
  const bron = await haalTekstUit(origineel.inhoud, origineel.bestandsnaam);
  const tekst = redigeerVoorbeeld(bron, haalInstelling('bedrijf'), redacties);
  repo.zetRedactie(id, tekst, redacties);
  synchroniseerWerkmap();
  return { tekst };
}

/** `voorbeelden:keurGoed` (FE-082): vanaf nu in de werkmap. */
export function keurGoed(id: string): null {
  bestaat(id);
  repo.zetGoedgekeurd(id);
  synchroniseerWerkmap();
  return null;
}

/**
 * `voorbeelden:zetTemplate` (FE-083, V-16): alleen een goedgekeurd voorbeeld; het vorige template
 * verliest zijn markering. `null` haalt de markering weg.
 */
export function zetTemplate(id: string | null): null {
  if (id !== null && bestaat(id).status !== 'goedgekeurd') {
    throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.eerstGoedkeuren);
  }
  repo.zetTemplateMarkering(id);
  synchroniseerWerkmap();
  return null;
}

/** `voorbeelden:verwijder` (FE-085, V-16): ook de `bestanden`-regel en uit de werkmap. */
export function verwijderVoorbeeld(id: string): null {
  if (repo.verwijderVoorbeeldRij(id)) synchroniseerWerkmap();
  return null;
}
