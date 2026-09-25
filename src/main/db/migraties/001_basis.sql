-- Migratie 001 (TDO §4.2). Alleen schema, geen INSERTs (V-13): de prijslijst-startset voegt migreer() in.

CREATE TABLE offertes (
  id                      TEXT PRIMARY KEY,               -- crypto.randomUUID()
  status                  TEXT NOT NULL DEFAULT 'concept'
                          CHECK (status IN ('concept','klaar','verstuurd','akkoord','afgewezen')),
  jaar                    INTEGER,                        -- gezet bij eerste definitief
  volgnummer              INTEGER,                        -- idem
  nummer                  TEXT,                           -- 'JJJJ-NNN', idem
  offertedatum            TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  geldig_tot              TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  wizard_stap             INTEGER NOT NULL DEFAULT 1 CHECK (wizard_stap BETWEEN 1 AND 4),
  klant_json              TEXT NOT NULL,                  -- Klant (§5), ENIGE plek met persoonsgegevens
  invoer_json             TEXT NOT NULL,                  -- KlusInvoer (§5)
  inhoud_json             TEXT,                           -- OfferteInhoud met plaatshouders, NULL = nog niet gemaakt
  totaal_incl_cent        INTEGER,                        -- NULL zolang inhoud_json NULL
  omschrijving_kort       TEXT NOT NULL DEFAULT '',
  zoektekst               TEXT NOT NULL DEFAULT '',       -- kleine letters: naam, bedrijf, plaats, nummer
  gewijzigd_na_definitief INTEGER NOT NULL DEFAULT 0,
  verwijderd_op           TEXT,                           -- ISO-tijdstip of NULL
  aangemaakt_op           TEXT NOT NULL,
  bijgewerkt_op           TEXT NOT NULL,
  UNIQUE (jaar, volgnummer)
);
CREATE INDEX idx_offertes_datum ON offertes(offertedatum) WHERE verwijderd_op IS NULL;
CREATE INDEX idx_offertes_zoek  ON offertes(zoektekst);

CREATE TABLE offerte_versies (
  id            TEXT PRIMARY KEY,
  offerte_id    TEXT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
  versie_nr     INTEGER NOT NULL,                         -- 1, 2, 3 … per offerte
  bron          TEXT NOT NULL CHECK (bron IN ('agent','agent_aanpassing','handmatig','terugzetten','zonder_claude')),
  inhoud_json   TEXT NOT NULL,
  aangemaakt_op TEXT NOT NULL,
  UNIQUE (offerte_id, versie_nr)
);

CREATE TABLE pdf_bestanden (
  id            TEXT PRIMARY KEY,
  offerte_id    TEXT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
  versieletter  TEXT NOT NULL,                            -- '' voor de eerste, dan 'b','c',…
  pad           TEXT NOT NULL,
  aangemaakt_op TEXT NOT NULL,
  UNIQUE (offerte_id, versieletter)
);

CREATE TABLE instellingen (
  sleutel     TEXT PRIMARY KEY,                           -- zie §4.3
  waarde_json TEXT NOT NULL
);

CREATE TABLE bestanden (                                   -- logo en originele voorbeeldbestanden
  id      TEXT PRIMARY KEY,
  naam    TEXT NOT NULL,
  mime    TEXT NOT NULL,
  inhoud  BLOB NOT NULL
);

CREATE TABLE prijsposten (
  id            TEXT PRIMARY KEY,
  sleutel       TEXT UNIQUE,                              -- startset-sleutel (§9.3), NULL voor eigen posten
  omschrijving  TEXT NOT NULL,
  eenheid       TEXT NOT NULL CHECK (eenheid IN ('m²','m¹','stuk','post','uur','dag')),
  prijs_cent    INTEGER CHECK (prijs_cent IS NULL OR prijs_cent >= 0),
  btw_tarief    INTEGER NOT NULL DEFAULT 21 CHECK (btw_tarief IN (0,9,21)),
  volgorde      INTEGER NOT NULL
);

CREATE TABLE voorbeelden (
  id                    TEXT PRIMARY KEY,
  bestandsnaam          TEXT NOT NULL,
  bestand_id            TEXT NOT NULL REFERENCES bestanden(id),
  tekst_geanonimiseerd  TEXT NOT NULL,
  handmatige_redacties  TEXT NOT NULL DEFAULT '[]',        -- JSON string[]
  status                TEXT NOT NULL DEFAULT 'te_controleren' CHECK (status IN ('te_controleren','goedgekeurd')),
  is_template           INTEGER NOT NULL DEFAULT 0,
  aangemaakt_op         TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_een_template ON voorbeelden(is_template) WHERE is_template = 1;

CREATE TABLE privacylog (
  id          TEXT PRIMARY KEY,
  tijdstip    TEXT NOT NULL,
  offerte_id  TEXT,                                       -- geen FK: log blijft bij definitief wissen
  soort       TEXT NOT NULL CHECK (soort IN ('maken','aanpassen','template_teksten','test')),
  opdracht    TEXT NOT NULL,                              -- exact verstuurde tekst (systeemprompt + opdracht)
  antwoord    TEXT,
  resultaat   TEXT NOT NULL CHECK (resultaat IN ('ok','fout','afgebroken')),
  foutcode    TEXT
);
CREATE INDEX idx_privacylog_tijd ON privacylog(tijdstip);
