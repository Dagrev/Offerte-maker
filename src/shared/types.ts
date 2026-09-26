import type { z } from 'zod';
import type { FoutCode, Resultaat } from './fouten';
import type { ApiNaam, Kanaal } from './ipcKanalen';
import type { KeuzeLijst } from './keuzelijsten';
import type * as s from './schemas';

// Domeintypes, afgeleid uit de schema's (TDO §5, §6.3, §4.3, V-15). De schema's zijn de bron.

export type { FoutCode, FoutActie, Fout, Resultaat } from './fouten';
export type { Kanaal } from './ipcKanalen';
export type { InstellingSleutel } from './schemas';
export type { KeuzeLijst, Keuzes } from './keuzelijsten';

// §5
export type Aanhef = z.infer<typeof s.aanhefSchema>;
export type Adres = z.infer<typeof s.adresSchema>;
export type Klant = z.infer<typeof s.klantSchema>;
export type SoortWerk = z.infer<typeof s.soortWerkSchema>;
export type SoortDak = z.infer<typeof s.soortDakSchema>;
export type Bedekking = z.infer<typeof s.bedekkingSchema>;
export type HuidigeBedekking = z.infer<typeof s.huidigeBedekkingSchema>;
export type Ondergrond = z.infer<typeof s.ondergrondSchema>;
export type Isolatie = z.infer<typeof s.isolatieSchema>;
export type Afwerking = z.infer<typeof s.afwerkingSchema>;
export type Hoogte = z.infer<typeof s.hoogteSchema>;
export type Garantie = z.infer<typeof s.garantieSchema>;
export type Dakvlak = z.infer<typeof s.dakvlakSchema>;
export type KlusInvoer = z.infer<typeof s.klusInvoerSchema>;
export type Eenheid = z.infer<typeof s.eenheidSchema>;
export type BtwTarief = z.infer<typeof s.btwTariefSchema>;
export type Prijsbron = z.infer<typeof s.prijsbronSchema>;
export type Offerteregel = z.infer<typeof s.offerteregelSchema>;
export type OfferteInhoud = z.infer<typeof s.offerteInhoudSchema>;
export type Status = z.infer<typeof s.statusSchema>;
export type Totalen = z.infer<typeof s.totalenSchema>;

// §6.3
export type OfferteLijstItem = z.infer<typeof s.offerteLijstItemSchema>;
export type OverzichtResultaat = z.infer<typeof s.overzichtResultaatSchema>;
export type OfferteDetail = z.infer<typeof s.offerteDetailSchema>;

// §4.3 (zoals opgeslagen) en V-15 (zoals de renderer ze krijgt)
export type Bedrijf = z.infer<typeof s.bedrijfSchema>;
export type Opmaak = z.infer<typeof s.opmaakSchema>;
export type Teksten = z.infer<typeof s.tekstenSchema>;
export type ClaudeInstelling = z.infer<typeof s.claudeInstellingSchema>;
export type AppInstelling = z.infer<typeof s.appInstellingSchema>;
export type Instellingen = z.infer<typeof s.instellingenSchema>;

// V-15 en overige
export type Prijspost = z.infer<typeof s.prijspostSchema>;
export type Keuzeoptie = z.infer<typeof s.keuzeoptieSchema>;
/** Uitvoer van `keuzelijsten:haal`: per lijst de opties in volgorde (OFM-034). */
export type Keuzelijsten = Record<KeuzeLijst, Keuzeoptie[]>;
export type VoorbeeldStatus = z.infer<typeof s.voorbeeldStatusSchema>;
export type VoorbeeldItem = z.infer<typeof s.voorbeeldItemSchema>;
export type ClaudeStatus = z.infer<typeof s.claudeStatusSchema>;
export type AppInfo = z.infer<typeof s.appInfoSchema>;
export type PrivacylogItem = z.infer<typeof s.privacylogItemSchema>;
export type PrivacylogDetail = z.infer<typeof s.privacylogDetailSchema>;
export type BackupItem = z.infer<typeof s.backupItemSchema>;
export type Voortgang = z.infer<typeof s.voortgangSchema>;

export type TekstenVoorstellen = Partial<
  Pick<
    Teksten,
    'inleiding' | 'afsluiting' | 'betalingsvoorwaarden' | 'garantie10' | 'garantie20' | 'voetnoot'
  >
>;

// ---------- IPC-contract (§6.2) ----------

/** Invoer van een kanaal (na validatie; `undefined` = geen invoer). */
export type KanaalInvoer<K extends Kanaal> = z.infer<(typeof s.invoerSchemas)[K]>;

/** Uitvoer (`data`) van elk kanaal. */
export interface KanaalUitvoer {
  'app:info': AppInfo;
  'app:openMap': null;
  'welkom:voltooi': null;
  'overzicht:lijst': OverzichtResultaat;
  'overzicht:zoek': OfferteLijstItem[];
  'offerte:nieuw': { id: string };
  'offerte:haal': OfferteDetail;
  'offerte:bewaarInvoer': null;
  'offerte:maak': { controlepunten: number };
  'offerte:stop': null;
  'offerte:pasAanMetClaude': { versieNr: number };
  'offerte:zetVersieTerug': { versieNr: number };
  'offerte:maakZonderClaude': { controlepunten: number };
  'offerte:bewaarInhoud': { versieNr: number };
  'offerte:voorbeeldHtml': { html: string };
  'offerte:maakDefinitief': { nummer: string; pad: string };
  'offerte:openPdf': null;
  'offerte:afdrukken': null;
  'offerte:toonInMap': null;
  /** OFM-041: `mapi` = concept met bijlage geopend; `mailto` = terugval zonder bijlage (PDF in Verkenner). */
  'offerte:mail': { methode: 'mapi' | 'mailto' };
  'offerte:zetStatus': null;
  'offerte:verwijder': null;
  'offerte:zetTerug': null;
  'prullenbak:lijst': OfferteLijstItem[];
  'instellingen:haal': Instellingen;
  'instellingen:bewaar': null;
  'instellingen:kiesLogo': { gekozen: boolean };
  'instellingen:verwijderLogo': null;
  'instellingen:opmaakVoorbeeld': { html: string };
  'keuzelijsten:haal': Keuzelijsten;
  'keuzelijsten:bewaar': Keuzeoptie[];
  'keuzelijsten:herstel': null;
  /** OFM-031: `null` = niet gevonden, geen internet of time-out (geen foutmelding). */
  'adres:zoek': { straat: string; plaats: string } | null;
  'prijzen:lijst': Prijspost[];
  'prijzen:bewaar': { id: string };
  'prijzen:verwijder': null;
  'voorbeelden:lijst': VoorbeeldItem[];
  'voorbeelden:voegToe': { toegevoegd: string[]; fouten: { bestandsnaam: string; code: FoutCode }[] };
  'voorbeelden:haal': {
    id: string;
    bestandsnaam: string;
    tekst: string;
    status: VoorbeeldStatus;
    isTemplate: boolean;
  };
  'voorbeelden:maakOnleesbaar': { tekst: string };
  'voorbeelden:keurGoed': null;
  'voorbeelden:zetTemplate': null;
  'voorbeelden:verwijder': null;
  'voorbeelden:tekstenUitTemplate': { voorstellen: TekstenVoorstellen };
  'claude:status': ClaudeStatus;
  'claude:login': ClaudeStatus;
  'claude:test': { duurMs: number };
  'claude:bewaarApiSleutel': null;
  'claude:kiesPad': { pad: string | null };
  'privacylog:lijst': PrivacylogItem[];
  'privacylog:haal': PrivacylogDetail;
  'backup:lijst': BackupItem[];
  'backup:maak': { bestand: string };
  'backup:zetTerug': null;
}

type ApiFunctie<K extends Kanaal> = [KanaalInvoer<K>] extends [undefined]
  ? () => Promise<Resultaat<KanaalUitvoer[K]>>
  : (invoer: z.input<(typeof s.invoerSchemas)[K]>) => Promise<Resultaat<KanaalUitvoer[K]>>;

/** `window.api` (§6.1): één functie per kanaal, plus voortgang en bestandspaden. Geen generieke invoke. */
export type Api = { [K in Kanaal as ApiNaam<K>]: ApiFunctie<K> } & {
  opVoortgang: (cb: (voortgang: Voortgang) => void) => () => void;
  padVanBestand: (bestand: File) => string;
};
