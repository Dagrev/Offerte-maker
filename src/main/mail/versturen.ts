import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, shell } from 'electron';
import { AppFout } from '@shared/fouten';
import { weergaveNummer } from '@shared/nummering';
import type { KanaalUitvoer } from '@shared/types';
import { haalInstelling } from '../db/repo/instellingen';
import { laatstePdf } from '../db/repo/offertesDefinitief';
import { haalOfferte } from '../db/repo/offertesInvoer';
import { log } from '../log';
import { bestaandePdf } from '../pdf/afdrukken';
import { testhaak } from '../testhaken';
import { maakMailConcept } from './concept';
import { mapiCommandos, mapiGelukt, openViaMapi, type MapiInvoer, type MapiUitkomst } from './mapi';
import { openViaMailto, type MailShell } from './mailto';

// Verstuur per e-mail (OFM-041, kanaal `offerte:mail`). Eerst Simple MAPI (concept mét bijlage); lukt
// dat niet, dan `mailto:` zonder bijlage plus de PDF in Verkenner. De app verstuurt zelf nooit iets.
// Log: methode, MAPI-code en duur — nooit e-mailadres, naam of tekst (§15.3). Niets naar het
// privacylog: dat is voor wat naar Claude gaat.

export interface MailDeps {
  mapi: (invoer: MapiInvoer) => Promise<MapiUitkomst>;
  shell: MailShell;
  nu: () => number;
}

function mapiScriptMap(): string {
  return app.isPackaged ? join(process.resourcesPath, 'mail') : join(app.getAppPath(), 'resources', 'mail');
}

/**
 * Testhaak `mail-shell=<pad>` (alleen niet-verpakt): in plaats van `mailto:` openen en Verkenner tonen
 * komt er per aanroep een JSON-regel in dat bestand. Zo opent geen enkele test een echt mailprogramma.
 */
export function mailShell(): MailShell {
  const logPad = testhaak('mail-shell');
  if (typeof logPad === 'string' && logPad !== '') {
    const schrijf = (regel: object) => appendFileSync(logPad, `${JSON.stringify(regel)}\n`, 'utf8');
    return {
      openExternal: (url) => {
        schrijf({ openExternal: url });
        return Promise.resolve();
      },
      showItemInFolder: (pad) => schrijf({ showItemInFolder: pad }),
    };
  }
  return {
    openExternal: (url) => shell.openExternal(url),
    showItemInFolder: (pad) => shell.showItemInFolder(pad),
  };
}

export function standaardMailDeps(): MailDeps {
  return {
    mapi: (invoer) => openViaMapi(invoer, mapiCommandos({ env: process.env, scriptMap: mapiScriptMap() })),
    shell: mailShell(),
    nu: () => Date.now(),
  };
}

export async function mailOfferte(
  id: string,
  deps: MailDeps = standaardMailDeps(),
): Promise<KanaalUitvoer['offerte:mail']> {
  const begin = deps.nu();
  const pad = await bestaandePdf(id);
  const detail = haalOfferte(id);
  const { nummer, versieletter } = laatstePdf(id);
  const teksten = haalInstelling('teksten');
  const concept = maakMailConcept({
    klant: detail.klant,
    nummer: weergaveNummer(nummer, versieletter) ?? nummer,
    geldigTot: detail.geldigTot,
    bedrijfsnaam: haalInstelling('bedrijf').naam,
    emailTekst: teksten.emailTekst,
  });

  const uitkomst = await deps.mapi({ ...concept, pad });
  const duur = () => deps.nu() - begin;
  if (mapiGelukt(uitkomst)) {
    log.info(
      `mail ${id}: methode mapi (code ${String(uitkomst.mapi)}${uitkomst.timeout ? ', time-out' : ''}), ${duur()} ms`,
    );
    return { methode: 'mapi' };
  }
  if (uitkomst.mailto === false) {
    log.warn(`mail ${id}: geen mailprogramma (mapi ${String(uitkomst.mapi)}), ${duur()} ms`);
    throw new AppFout('MAIL_GEEN_PROGRAMMA');
  }
  try {
    await openViaMailto(concept, pad, deps.shell);
  } catch (fout) {
    log.warn(`mail ${id}: mailto mislukt (mapi ${String(uitkomst.mapi)}), ${duur()} ms`);
    throw fout;
  }
  log.info(`mail ${id}: methode mailto (mapi ${String(uitkomst.mapi)}), ${duur()} ms`);
  return { methode: 'mailto' };
}
