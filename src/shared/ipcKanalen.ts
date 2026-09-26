// Alle IPC-kanalen (TDO §6.2, V-03, V-17, V-27). Deze lijst is de enige bron: de preload maakt er
// één functie per kanaal van, `ipc/registreer.ts` eist voor elk kanaal een handler en een schema.
// Latere tickets wijzigen deze lijst niet (uitzonderingen: OFM-034 voegt de keuzelijsten toe, OFM-031
// `adres:zoek`, OFM-041 `offerte:mail`).

export const IPC_KANALEN = [
  // app.ts
  'app:info',
  'app:openMap',
  // welkom.ts
  'welkom:voltooi',
  // overzicht.ts
  'overzicht:lijst',
  'overzicht:zoek',
  // offerteInvoer.ts
  'offerte:nieuw',
  'offerte:haal',
  'offerte:bewaarInvoer',
  // offerteAgent.ts
  'offerte:maak',
  'offerte:stop',
  'offerte:pasAanMetClaude',
  'offerte:zetVersieTerug',
  'offerte:maakZonderClaude',
  // offerteInhoud.ts
  'offerte:bewaarInhoud',
  'offerte:voorbeeldHtml',
  // offerteDefinitief.ts
  'offerte:maakDefinitief',
  'offerte:openPdf',
  'offerte:afdrukken',
  'offerte:toonInMap',
  // mail.ts (OFM-041)
  'offerte:mail',
  // offerteBeheer.ts
  'offerte:zetStatus',
  'offerte:verwijder',
  'offerte:zetTerug',
  'prullenbak:lijst',
  // instellingen.ts
  'instellingen:haal',
  'instellingen:bewaar',
  'instellingen:kiesLogo',
  'instellingen:verwijderLogo',
  'instellingen:opmaakVoorbeeld',
  // keuzelijsten.ts (OFM-034)
  'keuzelijsten:haal',
  'keuzelijsten:bewaar',
  'keuzelijsten:herstel',
  // adres.ts (OFM-031)
  'adres:zoek',
  // prijzen.ts
  'prijzen:lijst',
  'prijzen:bewaar',
  'prijzen:verwijder',
  // voorbeelden.ts
  'voorbeelden:lijst',
  'voorbeelden:voegToe',
  'voorbeelden:haal',
  'voorbeelden:maakOnleesbaar',
  'voorbeelden:keurGoed',
  'voorbeelden:zetTemplate',
  'voorbeelden:verwijder',
  'voorbeelden:tekstenUitTemplate',
  // claude.ts
  'claude:status',
  'claude:login',
  'claude:test',
  'claude:bewaarApiSleutel',
  'claude:kiesPad',
  // privacylog.ts
  'privacylog:lijst',
  'privacylog:haal',
  // backup.ts
  'backup:lijst',
  'backup:maak',
  'backup:zetTerug',
] as const;

export type Kanaal = (typeof IPC_KANALEN)[number];

/** Event main → renderer tijdens `offerte:maak`, `offerte:pasAanMetClaude` en `voorbeelden:tekstenUitTemplate`. */
export const VOORTGANG_KANAAL = 'offerte:voortgang';

/** Naam van de preloadfunctie: `offerte:maak` → `offerteMaak`. */
export type ApiNaam<K extends string> = K extends `${infer Domein}:${infer Actie}`
  ? `${Domein}${Capitalize<Actie>}`
  : never;

export function apiNaam<K extends Kanaal>(kanaal: K): ApiNaam<K> {
  const [domein = '', actie = ''] = kanaal.split(':');
  return `${domein}${actie.charAt(0).toUpperCase()}${actie.slice(1)}` as ApiNaam<K>;
}
