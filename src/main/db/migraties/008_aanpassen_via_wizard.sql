-- Migratie 008 (OFM-047): een offerte aanpassen via de wizard.
-- 1. `invoer_gewijzigd`: de wizardinvoer is veranderd sinds de inhoud voor het laatst uit de invoer is
--    gemaakt (Maak de offerte, Maak zonder Claude, Maak opnieuw). Het detailscherm toont dan een gele
--    regel met Maak opnieuw. Bestaande offertes: 0 (hun inhoud hoort bij hun invoer).
-- 2. Versiebron `wizard` (Maak opnieuw vanuit de wizard). SQLite kan een CHECK niet wijzigen, dus de
--    tabel `offerte_versies` wordt opnieuw opgebouwd met dezelfde kolommen en gegevens. Er verwijst
--    geen andere tabel naar, dus dat kan met foreign_keys aan. Geen INSERTs van startgegevens (V-13).
ALTER TABLE offertes ADD COLUMN invoer_gewijzigd INTEGER NOT NULL DEFAULT 0 CHECK (invoer_gewijzigd IN (0, 1));

CREATE TABLE offerte_versies_008 (
  id            TEXT PRIMARY KEY,
  offerte_id    TEXT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
  versie_nr     INTEGER NOT NULL,
  bron          TEXT NOT NULL CHECK (bron IN ('agent','agent_aanpassing','handmatig','terugzetten','zonder_claude','wizard')),
  inhoud_json   TEXT NOT NULL,
  aangemaakt_op TEXT NOT NULL,
  UNIQUE (offerte_id, versie_nr)
);
INSERT INTO offerte_versies_008 (id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op)
  SELECT id, offerte_id, versie_nr, bron, inhoud_json, aangemaakt_op FROM offerte_versies;
DROP TABLE offerte_versies;
ALTER TABLE offerte_versies_008 RENAME TO offerte_versies;
