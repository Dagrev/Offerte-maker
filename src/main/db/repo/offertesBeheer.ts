import { AppFout } from '@shared/fouten';
import { VALIDATIE_MELDINGEN } from '@shared/teksten/fouten';
import type { OfferteLijstItem, Status } from '@shared/types';
import { database } from '../verbinding';
import { lijstKolommen, naarLijstItem, type LijstRij } from './offertesLezen';

// Status, verwijderen, terugzetten en de prullenbak (TDO §6.2, §13.4, FE-060, FE-062, V-11).
// Eigenaar: OFM-016. `verwijderd_op` is een ISO-tijdstip; opschonen na 90 dagen zit in `db/opschonen.ts`.

function ongeldig(): never {
  throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.ongeldigeInvoer);
}

/** `offerte:zetStatus`: alleen voor een definitieve offerte (nummer of PDF) die niet in de prullenbak ligt. */
export function zetStatus(id: string, status: Exclude<Status, 'concept'>, nu: Date = new Date()): void {
  const db = database();
  db.transaction(() => {
    const rij = db.prepare('SELECT nummer FROM offertes WHERE id = ? AND verwijderd_op IS NULL').get(id) as
      { nummer: string | null } | undefined;
    if (!rij) ongeldig();
    const heeftPdf =
      db.prepare('SELECT 1 FROM pdf_bestanden WHERE offerte_id = ? LIMIT 1').get(id) !== undefined;
    if (rij.nummer === null && !heeftPdf) throw new AppFout('VALIDATIE', VALIDATIE_MELDINGEN.eerstDefinitief);
    db.prepare('UPDATE offertes SET status = ?, bijgewerkt_op = ? WHERE id = ?').run(
      status,
      nu.toISOString(),
      id,
    );
  })();
}

/** `offerte:verwijder`: naar de prullenbak (`verwijderd_op` = nu). Al verwijderd of onbekend → `VALIDATIE`. */
export function verwijderOfferte(id: string, nu: Date = new Date()): void {
  const { changes } = database()
    .prepare('UPDATE offertes SET verwijderd_op = ? WHERE id = ? AND verwijderd_op IS NULL')
    .run(nu.toISOString(), id);
  if (changes === 0) ongeldig();
}

/** `offerte:zetTerug`: uit de prullenbak; alle gegevens, versies en PDF's zijn nooit weg geweest. */
export function zetOfferteTerug(id: string): void {
  const { changes } = database()
    .prepare('UPDATE offertes SET verwijderd_op = NULL WHERE id = ? AND verwijderd_op IS NOT NULL')
    .run(id);
  if (changes === 0) ongeldig();
}

/** `prullenbak:lijst`: laatst verwijderd bovenaan, rijen zoals in het overzicht. */
export function prullenbakLijst(): OfferteLijstItem[] {
  const rijen = database()
    .prepare(
      `SELECT ${lijstKolommen} FROM offertes o WHERE o.verwijderd_op IS NOT NULL
       ORDER BY o.verwijderd_op DESC, o.aangemaakt_op DESC`,
    )
    .all() as LijstRij[];
  return rijen.map(naarLijstItem);
}
