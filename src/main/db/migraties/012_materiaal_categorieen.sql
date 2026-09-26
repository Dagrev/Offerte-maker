-- Migratie 012 (OFM-057): categorieën van materialen. Na deze SQL zet `zetCategorieenStartset`
-- (main/db/materiaalCategorieen.ts, `NA_MIGRATIE`) de startcategorieën erin (id `cat:<sleutel>`,
-- `standaard` 1) en geeft de startmaterialen (en houtschroeven/betonpluggen als ze bestaan) hun categorie;
-- alle andere materialen blijven zonder categorie (= Overig).
--
-- - `materiaal_categorieen`: naam (uniek, zonder hoofdletterverschil; controle in de repository), volgorde
--   en `standaard` (uit de startset). `cat:overig` (Overig) is er altijd; de repository weigert verwijderen
--   en hernoemen.
-- - `materialen.categorie_id`: NULL = Overig. Verwijderen van een categorie zet zijn materialen op NULL.
CREATE TABLE materiaal_categorieen (
  id        TEXT PRIMARY KEY,
  naam      TEXT NOT NULL,
  volgorde  INTEGER NOT NULL,
  standaard INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1))
);

ALTER TABLE materialen ADD COLUMN categorie_id TEXT REFERENCES materiaal_categorieen(id) ON DELETE SET NULL;
