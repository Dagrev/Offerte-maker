-- Migratie 009 (OFM-050): stap 2 beschrijft het huidige dak, stap 3 begint met soort werk en de nieuwe
-- dakbedekking.
-- 1. Nieuwe keuzelijst `nieuweBedekking`. SQLite kan de CHECK op `lijst` niet wijzigen, dus
--    `keuzeopties` wordt opnieuw opgebouwd, met de kolommen van nu plus:
--    - `zin`: "Zin in de offerte" per optie (beginsituatie; gebruikt bij soort dak, huidige bedekking,
--      ondergrond en hoogte), `''` = geen zin;
--    - `vraagt_bedekking`: bij soort werk: de wizard vraagt dan om een nieuwe dakbedekking.
--    De lijsten die migratie 005 leegmaakte (bedekking, isolatie, extras, afwerking) vallen uit de CHECK.
-- 2. `werkzaamheid_soortwerk` verwijst met ON DELETE CASCADE naar `keuzeopties`: het weggooien van de
--    oude tabel zou die koppelingen verwijderen. Ze gaan daarom eerst naar een tijdelijke tabel en komen
--    na het hernoemen terug.
-- De startopties van `nieuweBedekking`, de startzinnen en de vinkjes van de startset zet migreer() na
-- deze SQL (`zetHuidigDakStartset`, V-13); `nieuweBedekking` in bestaande offertes vóór deze SQL
-- (`zetNieuweBedekkingOm`, afgeleid uit het materiaal bij de werkzaamheid Nieuwe bedekking).
CREATE TEMP TABLE soortwerk_009 AS SELECT werkzaamheid_id, soort_werk FROM werkzaamheid_soortwerk;

CREATE TABLE keuzeopties_009 (
  id               TEXT PRIMARY KEY,
  lijst            TEXT NOT NULL CHECK (lijst IN ('soortWerk','nieuweBedekking','soortDak','huidigeBedekking',
                                                  'ondergrond','hoogte','garantie')),
  sleutel          TEXT NOT NULL,
  label            TEXT NOT NULL,
  volgorde         INTEGER NOT NULL,
  verborgen        INTEGER NOT NULL DEFAULT 0 CHECK (verborgen IN (0,1)),
  standaard        INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1)),
  standaardkeuze   INTEGER NOT NULL DEFAULT 0 CHECK (standaardkeuze IN (0,1)),
  zin              TEXT NOT NULL DEFAULT '',
  vraagt_bedekking INTEGER NOT NULL DEFAULT 0 CHECK (vraagt_bedekking IN (0,1)),
  UNIQUE (lijst, sleutel)
);
INSERT INTO keuzeopties_009 (id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze)
  SELECT id, lijst, sleutel, label, volgorde, verborgen, standaard, standaardkeuze FROM keuzeopties;
DROP TABLE keuzeopties;
ALTER TABLE keuzeopties_009 RENAME TO keuzeopties;
CREATE INDEX idx_keuzeopties_lijst ON keuzeopties(lijst, volgorde);
CREATE UNIQUE INDEX idx_keuzeopties_standaardkeuze ON keuzeopties (lijst) WHERE standaardkeuze = 1;

INSERT INTO werkzaamheid_soortwerk (werkzaamheid_id, soort_werk)
  SELECT werkzaamheid_id, soort_werk FROM soortwerk_009;
DROP TABLE soortwerk_009;
