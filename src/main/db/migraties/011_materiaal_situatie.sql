-- Migratie 011 (OFM-055): materiaaltags en materiaal per daksituatie. Vervangt `daksysteem_materiaal`
-- (OFM-051). Na deze SQL zet `zetDaksituatiesOm` (main/db/daksituatie.ts, `NA_MIGRATIE`) de starttags,
-- zet de regels van OFM-051 en de bedekkingsmaterialen om naar situaties en verwijdert daarna
-- `daksysteem_materiaal` (de omzetting heeft die regels nog nodig).
--
-- - `materiaal_tag`: bij welke ondergronden (lijst `ondergrond`) en nieuwe dakbedekkingen (lijst
--   `nieuweBedekking`) een materiaal bruikbaar is. Geen rijen voor een lijst = alle opties. Verwijderen van
--   een keuzeoptie verwijdert de tag (samengestelde FK op `keuzeopties(lijst, sleutel)`); een nieuwe optie
--   komt bij materialen met eigen tags erbij (`voegTagOptieToe`, bij het bewaren van de keuzelijst).
-- - `werkzaamheid_situatie_materiaal`: per werkzaamheid met het vinkje `per_situatie` de standaardmaterialen
--   per combinatie ondergrond × nieuwe dakbedekking (op sleutel, dus een verborgen optie laat de rijen
--   staan). Het materiaal moet bij de werkzaamheid kiesbaar zijn (FK op `werkzaamheid_materiaal`).
-- Let op bij een latere migratie die `keuzeopties` opnieuw opbouwt (zoals 009): eerst deze rijen
-- bewaren, anders verdwijnen ze door de cascade.
ALTER TABLE werkzaamheden ADD COLUMN per_situatie INTEGER NOT NULL DEFAULT 0 CHECK (per_situatie IN (0,1));

CREATE TABLE materiaal_tag (
  materiaal_id TEXT NOT NULL REFERENCES materialen(id) ON DELETE CASCADE,
  lijst        TEXT NOT NULL CHECK (lijst IN ('ondergrond', 'nieuweBedekking')),
  sleutel      TEXT NOT NULL,
  PRIMARY KEY (materiaal_id, lijst, sleutel),
  FOREIGN KEY (lijst, sleutel) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE
);

CREATE TABLE werkzaamheid_situatie_materiaal (
  werkzaamheid_id  TEXT NOT NULL REFERENCES werkzaamheden(id) ON DELETE CASCADE,
  ondergrond_lijst TEXT NOT NULL DEFAULT 'ondergrond' CHECK (ondergrond_lijst = 'ondergrond'),
  ondergrond       TEXT NOT NULL,
  bedekking_lijst  TEXT NOT NULL DEFAULT 'nieuweBedekking' CHECK (bedekking_lijst = 'nieuweBedekking'),
  bedekking        TEXT NOT NULL,
  materiaal_id     TEXT NOT NULL REFERENCES materialen(id) ON DELETE CASCADE,
  PRIMARY KEY (werkzaamheid_id, ondergrond, bedekking, materiaal_id),
  FOREIGN KEY (werkzaamheid_id, materiaal_id)
    REFERENCES werkzaamheid_materiaal(werkzaamheid_id, materiaal_id) ON DELETE CASCADE,
  FOREIGN KEY (ondergrond_lijst, ondergrond) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE,
  FOREIGN KEY (bedekking_lijst, bedekking) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE
);
