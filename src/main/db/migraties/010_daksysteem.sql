-- Migratie 010 (OFM-051): standaardmaterialen per daksysteem. Per combinatie van ondergrond (keuzelijst
-- `ondergrond`) en nieuwe dakbedekking (keuzelijst `nieuweBedekking`) een afwijkend standaardmateriaal per
-- werkzaamheid. Alleen afwijkingen staan hier; zonder regel geldt het gewone standaardmateriaal
-- (`werkzaamheid_materiaal.standaard`). `NULL` = alle ondergronden resp. alle bedekkingen; allebei `NULL`
-- mag niet (dat is het gewone standaardmateriaal).
-- - Het materiaal moet bij de werkzaamheid kiesbaar zijn: FK op `werkzaamheid_materiaal`. Wordt het daar
--   niet meer kiesbaar (of wordt het materiaal of de werkzaamheid verwijderd), dan verdwijnt de regel mee.
-- - Verwijderen van een keuzeoptie ondergrond of bedekking verwijdert de regels erop (samengestelde FK op
--   `keuzeopties(lijst, sleutel)`, zoals `werkzaamheid_soortwerk`; een `NULL` wordt niet gecontroleerd).
--   Let op bij een latere migratie die `keuzeopties` opnieuw opbouwt (zoals 009): eerst deze regels
--   bewaren, anders verdwijnen ze door de cascade.
-- - Uniek per (werkzaamheid, ondergrond, bedekking), met `NULL` als gewone waarde (een UNIQUE-constraint
--   ziet twee `NULL`s als verschillend, daarom een index op `IFNULL`).
-- Geen startgegevens: de startset van de afwijkingen is leeg.
CREATE TABLE daksysteem_materiaal (
  werkzaamheid_id  TEXT NOT NULL REFERENCES werkzaamheden(id) ON DELETE CASCADE,
  ondergrond_lijst TEXT NOT NULL DEFAULT 'ondergrond' CHECK (ondergrond_lijst = 'ondergrond'),
  ondergrond       TEXT,
  bedekking_lijst  TEXT NOT NULL DEFAULT 'nieuweBedekking' CHECK (bedekking_lijst = 'nieuweBedekking'),
  bedekking        TEXT,
  materiaal_id     TEXT NOT NULL REFERENCES materialen(id) ON DELETE CASCADE,
  CHECK (ondergrond IS NOT NULL OR bedekking IS NOT NULL),
  FOREIGN KEY (werkzaamheid_id, materiaal_id)
    REFERENCES werkzaamheid_materiaal(werkzaamheid_id, materiaal_id) ON DELETE CASCADE,
  FOREIGN KEY (ondergrond_lijst, ondergrond) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE,
  FOREIGN KEY (bedekking_lijst, bedekking) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_daksysteem_uniek
  ON daksysteem_materiaal (werkzaamheid_id, IFNULL(ondergrond, ''), IFNULL(bedekking, ''));
