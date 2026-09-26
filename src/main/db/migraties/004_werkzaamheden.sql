-- OFM-043: werkzaamheden, opties en materialen, gekoppeld aan de soorten werk (keuzelijst soortWerk).
-- De startset (shared/werkzaamheden.ts) en de prijsposten zonder prijs (sleutels werk:<s>,
-- optie:<werkzaamheid>:<s> en mat:<s>) voegt migreer() direct na deze migratie in (V-13).
CREATE TABLE werkzaamheden (
  id        TEXT PRIMARY KEY,                             -- 'start-werk-<sleutel>' of een UUID
  sleutel   TEXT NOT NULL UNIQUE,                         -- stabiel, [a-z0-9_]{1,40}
  label     TEXT NOT NULL,
  eenheid   TEXT NOT NULL CHECK (eenheid IN ('m²','m¹','stuk','post','uur','dag')),
  volgorde  INTEGER NOT NULL,
  verborgen INTEGER NOT NULL DEFAULT 0 CHECK (verborgen IN (0,1)),
  standaard INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1))    -- 1 = uit de startset
);

-- Welke werkzaamheden bij een soort werk horen. Verdwijnt de soort werk uit de keuzelijst, dan ook
-- de koppeling (samengestelde FK op keuzeopties(lijst, sleutel)).
CREATE TABLE werkzaamheid_soortwerk (
  werkzaamheid_id TEXT NOT NULL REFERENCES werkzaamheden(id) ON DELETE CASCADE,
  lijst           TEXT NOT NULL DEFAULT 'soortWerk' CHECK (lijst = 'soortWerk'),
  soort_werk      TEXT NOT NULL,
  PRIMARY KEY (werkzaamheid_id, soort_werk),
  FOREIGN KEY (lijst, soort_werk) REFERENCES keuzeopties(lijst, sleutel) ON DELETE CASCADE
);

CREATE TABLE werkzaamheid_opties (
  id              TEXT PRIMARY KEY,
  werkzaamheid_id TEXT NOT NULL REFERENCES werkzaamheden(id) ON DELETE CASCADE,
  sleutel         TEXT NOT NULL,
  label           TEXT NOT NULL,
  eenheid         TEXT NOT NULL CHECK (eenheid IN ('m²','m¹','stuk','post','uur','dag')),
  volgorde        INTEGER NOT NULL,
  verborgen       INTEGER NOT NULL DEFAULT 0 CHECK (verborgen IN (0,1)),
  UNIQUE (werkzaamheid_id, sleutel)
);

CREATE TABLE materialen (
  id        TEXT PRIMARY KEY,                             -- 'start-mat-<sleutel>' of een UUID
  sleutel   TEXT NOT NULL UNIQUE,
  label     TEXT NOT NULL,
  eenheid   TEXT NOT NULL CHECK (eenheid IN ('m²','m¹','stuk','post','uur','dag')),
  volgorde  INTEGER NOT NULL,
  verborgen INTEGER NOT NULL DEFAULT 0 CHECK (verborgen IN (0,1)),
  standaard INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1))
);

-- Kiesbare materialen per werkzaamheid; standaard = voorgeselecteerd (hooguit één per werkzaamheid).
CREATE TABLE werkzaamheid_materiaal (
  werkzaamheid_id TEXT NOT NULL REFERENCES werkzaamheden(id) ON DELETE CASCADE,
  materiaal_id    TEXT NOT NULL REFERENCES materialen(id) ON DELETE CASCADE,
  standaard       INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1)),
  PRIMARY KEY (werkzaamheid_id, materiaal_id)
);
CREATE UNIQUE INDEX idx_een_standaardmateriaal ON werkzaamheid_materiaal(werkzaamheid_id) WHERE standaard = 1;
