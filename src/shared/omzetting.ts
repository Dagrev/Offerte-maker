import { totaalM2 } from './calc/bedragen';
import type { Dakvlak, Eenheid, GekozenMateriaal, GekozenWerkzaamheid, Offerteregel } from './types';
import { WERKZAAMHEDEN_STARTSET, standaardAantal, type StartWerkzaamheid } from './werkzaamheden';

// Omzetting van oude offertes naar werkzaamheden (OFM-045, TDO §9.7, A-30). Vóór OFM-044 had een
// offerte de velden van de wizardstap Extra's (bedekking, isolatie, slopen, zes extra's, eigen extra's,
// afwerking). Migratie 005 zet die in `invoer_json` om naar `werkzaamheden` en haalt de oude velden
// weg; daarna kent geen enkele andere module ze nog. Puur (geen Node of DOM): main roept dit aan in
// de migratie, de tests rechtstreeks.
//
// Regel: elke oude keuze die vroeger een offerteregel gaf, wordt precies één regel in de nieuwe
// structuur, met het aantal, de eenheid en de prijs van de bestaande regel van de offerte (niet
// opnieuw uit de prijslijst). Zo geeft Maak zonder Claude of een nieuwe versie hetzelfde totaal.
// Alleen als die regel er niet is (concept zonder inhoud, regel weggehaald) komen aantal uit de invoer
// en prijs uit de prijslijst, zoals de oude Maak zonder Claude deed.

/** De velden van de oude stap Extra's, zoals ze in `invoer_json` stonden. */
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

export const OUDE_VELDEN: readonly (keyof OudeVelden)[] = [
  'bedekking',
  'bedekkingAnders',
  'slopenEnAfvoeren',
  'isolatie',
  'isolatieAndersMm',
  'daktrimM1',
  'dakgootM1',
  'hwaAantal',
  'noodoverloopAantal',
  'doorvoerAantal',
  'lichtkoepelAantal',
  'afwerking',
  'extraAantallen',
];

/** Invoer zoals hij in de database staat: de nieuwe velden plus mogelijk de oude. */
export type OpgeslagenInvoer = Partial<OudeVelden> & {
  dakvlakken?: readonly Pick<Dakvlak, 'modus' | 'lengteM' | 'breedteM' | 'm2'>[];
  werkzaamheden?: GekozenWerkzaamheid[];
  [veld: string]: unknown;
};

/** De vier oude keuzelijsten (tot migratie 005 in `keuzeopties`), alleen voor de labels. */
export type OudeLijst = 'bedekking' | 'isolatie' | 'extras' | 'afwerking';

export interface OmzetBron {
  /** Werkzaamheden en materialen uit de instellingen: bestaat de sleutel, dan een verwijzing. */
  catalogus: {
    werkzaamheden: readonly { sleutel: string }[];
    materialen: readonly { sleutel: string }[];
  };
  labels: Partial<Record<OudeLijst, readonly { sleutel: string; label: string }[]>>;
  prijsposten: readonly {
    id: string;
    sleutel: string | null;
    omschrijving: string;
    eenheid: Eenheid;
    prijsCent: number | null;
  }[];
  /** Regels van de huidige inhoud van de offerte; leeg als er nog geen inhoud is. */
  regels: readonly Offerteregel[];
  maakId?: () => string;
}

/** De zes standaard-extra's met hun eigen veld (TDO §5, OFM-034), in de volgorde van de startset. */
const VASTE_EXTRAS = {
  daktrim: 'daktrimM1',
  dakgoot_epdm: 'dakgootM1',
  hwa: 'hwaAantal',
  noodoverloop: 'noodoverloopAantal',
  doorvoer: 'doorvoerAantal',
  lichtkoepel: 'lichtkoepelAantal',
} as const;

const MAX_LABEL = 80;

/** Heeft deze opgeslagen invoer nog een veld van de oude stap Extra's? */
export function heeftOudeVelden(invoer: OpgeslagenInvoer): boolean {
  return OUDE_VELDEN.some((veld) => Object.hasOwn(invoer, veld));
}

function oudeVelden(invoer: OpgeslagenInvoer): OudeVelden {
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

/** Eén oude keuze die vroeger één offerteregel gaf. */
interface Onderdeel {
  label: string;
  eenheid: Eenheid;
  aantal: number;
  prijsCent: number | null;
}

/**
 * Zet de oude velden om naar werkzaamheden (achter eventuele bestaande werkzaamheden) en laat de oude
 * velden weg. Volgorde en indeling (A-30):
 * - slopen → werkzaamheid Slopen, met de prijs van de regel "sloop";
 * - isolatie → Isoleren (prijs 0) met als materialen de dampremmende laag en de isolatie;
 * - bedekking → Nieuwe bedekking (prijs 0) met de bedekking als materiaal;
 * - elke extra met een aantal → een eenmalige werkzaamheid met dat aantal en die prijs;
 * - afwerking → Dakrand en afwerking (prijs 0) met de afwerking als materiaal.
 * Een werkzaamheid of materiaal waarvan de sleutel in de instellingen staat, wordt een verwijzing;
 * anders een eenmalig item met de naam van de prijspost (of het label).
 */
export function zetOmNaarWerkzaamheden(
  invoer: OpgeslagenInvoer,
  bron: OmzetBron,
): Omit<OpgeslagenInvoer, keyof OudeVelden> & { werkzaamheden: GekozenWerkzaamheid[] } {
  const maakId = bron.maakId ?? (() => crypto.randomUUID());
  const oud = oudeVelden(invoer);
  const m2 = totaalM2(invoer.dakvlakken ?? []);
  const vrij = [...bron.regels];

  const neemRegel = (past: (r: Offerteregel) => boolean): Offerteregel | null => {
    const index = vrij.findIndex((r) => r.prijsCent >= 0 && r.aantalHonderdsten >= 0 && past(r));
    return index === -1 ? null : (vrij.splice(index, 1)[0] as Offerteregel);
  };
  const label = (lijst: OudeLijst, sleutel: string) =>
    bron.labels[lijst]?.find((k) => k.sleutel === sleutel)?.label ?? sleutel;

  /** Een keuze met een prijspost (op sleutel) of een eigen regel (zonder post, op omschrijving). */
  const onderdeel = (d: { post?: string; label: string; eenheid: Eenheid; aantal: number }): Onderdeel => {
    const post = d.post === undefined ? undefined : bron.prijsposten.find((p) => p.sleutel === d.post);
    const omschrijving = post?.omschrijving ?? d.label;
    const regel = post
      ? neemRegel((r) => r.prijspostId === post.id)
      : neemRegel((r) => r.prijspostId === null && r.omschrijving.trim() === d.label);
    if (regel) {
      return {
        label: omschrijving,
        eenheid: regel.eenheid,
        aantal: regel.aantalHonderdsten / 100,
        prijsCent: regel.prijsCent,
      };
    }
    return {
      label: omschrijving,
      eenheid: post?.eenheid ?? d.eenheid,
      aantal: d.aantal,
      prijsCent: post?.prijsCent ?? null,
    };
  };

  const eenmalig = (naam: string, eenheid: Eenheid) => ({ label: naam.trim().slice(0, MAX_LABEL), eenheid });
  const materiaal = (d: Onderdeel, sleutel: string | null): GekozenMateriaal => {
    const bekend = sleutel !== null && bron.catalogus.materialen.some((m) => m.sleutel === sleutel);
    return {
      id: maakId(),
      sleutel: bekend ? sleutel : null,
      eenmalig: bekend ? null : eenmalig(d.label, d.eenheid),
      aantal: d.aantal,
      prijsCent: d.prijsCent,
    };
  };
  const werkzaamheid = (
    sleutel: string,
    info: { label: string; eenheid: Eenheid; aantal: number; prijsCent: number | null },
    materialen: GekozenMateriaal[] = [],
  ): GekozenWerkzaamheid => {
    const bekend = bron.catalogus.werkzaamheden.some((w) => w.sleutel === sleutel);
    return {
      id: maakId(),
      sleutel: bekend ? sleutel : null,
      eenmalig: bekend ? null : eenmalig(info.label, info.eenheid),
      aantal: info.aantal,
      prijsCent: info.prijsCent,
      perUur: false,
      notitie: '',
      materialen,
      opties: [],
    };
  };
  /** Een werkzaamheid uit de startset die zelf geen prijs heeft: prijs 0, standaardaantal. */
  const houder = (sleutel: string, materialen: GekozenMateriaal[]): GekozenWerkzaamheid => {
    // Alleen aangeroepen met sleutels uit de startset (isoleren, nieuwe_bedekking, dakrand_afwerking).
    const start = WERKZAAMHEDEN_STARTSET.find((w) => w.sleutel === sleutel) as StartWerkzaamheid;
    const info = {
      label: start.label,
      eenheid: start.eenheid,
      aantal: standaardAantal(start.eenheid, m2),
      prijsCent: 0,
    };
    return werkzaamheid(sleutel, info, materialen);
  };

  const nieuw: GekozenWerkzaamheid[] = [];

  if (oud.slopenEnAfvoeren) {
    const sloop = onderdeel({ post: 'sloop', label: 'Slopen', eenheid: 'm²', aantal: m2 });
    nieuw.push(werkzaamheid('slopen', sloop));
  }

  if (oud.isolatie !== 'geen') {
    const damp = onderdeel({ post: 'dampremmer', label: 'Dampremmende laag', eenheid: 'm²', aantal: m2 });
    let isolatie: Onderdeel;
    if (oud.isolatie === 'anders') {
      const dikte = oud.isolatieAndersMm === null ? 'Isolatie' : `Isolatie ${oud.isolatieAndersMm} mm`;
      isolatie = onderdeel({ label: dikte, eenheid: 'm²', aantal: m2 });
    } else {
      const post = ['80', '100', '120'].includes(oud.isolatie) ? `isolatie_${oud.isolatie}` : oud.isolatie;
      const naam = `Isolatie ${label('isolatie', oud.isolatie)}`;
      isolatie = onderdeel({ post, label: naam, eenheid: 'm²', aantal: m2 });
    }
    nieuw.push(houder('isoleren', [materiaal(damp, null), materiaal(isolatie, oud.isolatie)]));
  }

  if (oud.bedekking !== null) {
    const bedekking =
      oud.bedekking === 'anders'
        ? onderdeel({ label: oud.bedekkingAnders.trim() || 'Dakbedekking', eenheid: 'm²', aantal: m2 })
        : onderdeel({
            post: oud.bedekking,
            label: label('bedekking', oud.bedekking),
            eenheid: 'm²',
            aantal: m2,
          });
    nieuw.push(houder('nieuwe_bedekking', [materiaal(bedekking, oud.bedekking)]));
  }

  // Extra's in de volgorde van hun keuzelijst, daarna die niet (meer) in de lijst staan.
  const volgorde = [
    ...(bron.labels.extras ?? []).map((k) => k.sleutel),
    ...Object.keys(VASTE_EXTRAS),
    ...Object.keys(oud.extraAantallen),
  ];
  for (const sleutel of new Set(volgorde)) {
    const vast = Object.hasOwn(VASTE_EXTRAS, sleutel)
      ? oud[VASTE_EXTRAS[sleutel as keyof typeof VASTE_EXTRAS]]
      : undefined;
    const aantal = vast ?? oud.extraAantallen[sleutel] ?? 0;
    if (aantal <= 0) continue;
    const eenheid = sleutel === 'daktrim' || sleutel === 'dakgoot_epdm' ? 'm¹' : 'stuk';
    const extra = onderdeel({ post: sleutel, label: label('extras', sleutel), eenheid, aantal });
    nieuw.push(werkzaamheid(sleutel, extra));
  }

  if (oud.afwerking !== 'geen') {
    const afwerking = onderdeel({
      post: oud.afwerking,
      label: label('afwerking', oud.afwerking),
      eenheid: 'm²',
      aantal: m2,
    });
    nieuw.push(houder('dakrand_afwerking', [materiaal(afwerking, oud.afwerking)]));
  }

  const rest = Object.fromEntries(
    Object.entries(invoer).filter(([veld]) => !(OUDE_VELDEN as readonly string[]).includes(veld)),
  ) as Omit<OpgeslagenInvoer, keyof OudeVelden>;
  return { ...rest, werkzaamheden: [...(invoer.werkzaamheden ?? []), ...nieuw] };
}
