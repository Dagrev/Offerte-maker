import { KEUZE_SLEUTEL_PATROON, maakSleutel } from '../../shared/keuzelijsten';
import { VASTE_POSTEN } from '../../shared/prijsStartset';
import type { Eenheid } from '../../shared/types';
import { itemSleutel, materiaalPrijsSleutel, prijsGroep } from '../../shared/werkzaamheden';
import type { Db } from './verbinding';
import { werkRijen, zetUurPrijspost } from './werkzaamhedenStartset';

// Migratie 006 (OFM-048, TDO §4.2, §9.7): de tabs Prijzen en Werkzaamheden zijn samengevoegd. Draait na
// de SQL van `006_prijzen_samenvoegen.sql`, in dezelfde transactie (`NA_MIGRATIE`). Relatieve imports:
// ook het seed-script gebruikt dit buiten Electron.
//
// 1. Elke werkzaamheid krijgt een uurprijs-post `werk:<sleutel>:uur` zonder prijs.
// 2. De oude losse prijsposten (zonder `werk:`/`optie:`/`mat:`-sleutel: de startset van OFM-003,
//    posten uit oude keuzelijsten en eigen posten) worden materialen, of verdwijnen. Alleen de vaste
//    posten die de app zelf gebruikt (steiger, verzekerde garantie, voorrijkosten, §9.5) blijven los.

interface PostRij {
  id: string;
  sleutel: string | null;
  omschrijving: string;
  eenheid: Eenheid;
  prijs_cent: number | null;
}

export interface SamenvoegUitkomst {
  /** Aantal oude posten dat een materiaal werd. */
  materialen: number;
  /** Aantal oude posten dat is verwijderd. */
  verwijderd: number;
}

/** Id's van prijsposten waar een regel van een niet-verwijderde offerte naar verwijst. */
function gebruiktePosten(db: Db): Set<string> {
  const uit = new Set<string>();
  const rijen = db
    .prepare('SELECT inhoud_json FROM offertes WHERE verwijderd_op IS NULL AND inhoud_json IS NOT NULL')
    .all() as { inhoud_json: string }[];
  for (const rij of rijen) {
    const inhoud = JSON.parse(rij.inhoud_json) as { regels?: { prijspostId?: string | null }[] };
    for (const regel of inhoud.regels ?? []) if (regel.prijspostId) uit.add(regel.prijspostId);
  }
  return uit;
}

/**
 * Een oude post blijft (als materiaal) als een offerte hem gebruikt, als er een prijs in staat, of als
 * de gebruiker hem zelf heeft toegevoegd (geen sleutel). Alleen een ongebruikte, lege post uit een
 * startset of oude keuzelijst verdwijnt.
 */
export function blijftAlsMateriaal(
  post: Pick<PostRij, 'sleutel' | 'prijs_cent'>,
  gebruikt: boolean,
): boolean {
  return gebruikt || post.prijs_cent !== null || post.sleutel === null;
}

export function voegPrijzenSamen(db: Db): SamenvoegUitkomst {
  for (const w of werkRijen(db)) zetUurPrijspost(db, w.sleutel, w.label);

  const vast = new Set<string>(VASTE_POSTEN);
  const los = (
    db
      .prepare('SELECT id, sleutel, omschrijving, eenheid, prijs_cent FROM prijsposten ORDER BY volgorde, id')
      .all() as PostRij[]
  ).filter((p) => prijsGroep(p.sleutel) === null && !(p.sleutel !== null && vast.has(p.sleutel)));
  if (los.length === 0) return { materialen: 0, verwijderd: 0 };

  const gebruikt = gebruiktePosten(db);
  // Sleutels van werkzaamheden, opties en materialen (ook via hun posten): daar mag niets bij.
  const items = new Set<string>();
  for (const tabel of ['werkzaamheden', 'werkzaamheid_opties', 'materialen']) {
    for (const r of db.prepare(`SELECT sleutel FROM ${tabel}`).all() as { sleutel: string }[])
      items.add(r.sleutel);
  }
  // Alle andere sleutels van posten: een nieuwe sleutel mag daar ook niet mee botsen.
  const bezet = new Set(items);
  for (const r of db.prepare('SELECT sleutel FROM prijsposten WHERE sleutel IS NOT NULL').all() as {
    sleutel: string;
  }[]) {
    bezet.add(prijsGroep(r.sleutel) === null ? r.sleutel : itemSleutel(r.sleutel));
  }

  let { volgorde } = db.prepare('SELECT COALESCE(MAX(volgorde), 0) AS volgorde FROM materialen').get() as {
    volgorde: number;
  };
  const uit: SamenvoegUitkomst = { materialen: 0, verwijderd: 0 };
  for (const post of los) {
    if (!blijftAlsMateriaal(post, gebruikt.has(post.id))) {
      db.prepare('DELETE FROM prijsposten WHERE id = ?').run(post.id);
      uit.verwijderd++;
      continue;
    }
    const label = post.omschrijving.trim().slice(0, 80).trim() || 'Materiaal';
    // Een oude post houdt zijn eigen sleutel (epdm_11 → mat:epdm_11), tenzij een item die al heeft
    // (bitumen → bitumen_2).
    const eigen = post.sleutel !== null && KEUZE_SLEUTEL_PATROON.test(post.sleutel) ? post.sleutel : null;
    const sleutel = eigen !== null && !items.has(eigen) ? eigen : maakSleutel(post.sleutel ?? label, bezet);
    items.add(sleutel);
    bezet.add(sleutel);
    volgorde += 10;
    db.prepare(
      'INSERT INTO materialen (id, sleutel, label, eenheid, volgorde, verborgen, standaard) VALUES (?, ?, ?, ?, ?, 0, 0)',
    ).run(`oud-${post.id}`.slice(0, 100), sleutel, label, post.eenheid, volgorde);
    // Zelfde post (id, prijs, btw): regels in bestaande offertes blijven ernaar verwijzen.
    db.prepare('UPDATE prijsposten SET sleutel = ?, omschrijving = ? WHERE id = ?').run(
      materiaalPrijsSleutel(sleutel),
      label,
      post.id,
    );
    uit.materialen++;
  }
  return uit;
}
