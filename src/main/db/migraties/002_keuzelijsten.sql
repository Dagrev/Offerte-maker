-- OFM-034: instelbare keuzelijsten van de wizard. De startset (shared/keuzelijsten.ts) voegt migreer()
-- direct na deze migratie in (zoals de prijslijst-startset na 001, V-13).
CREATE TABLE keuzeopties (
  id        TEXT PRIMARY KEY,                             -- 'start-<lijst>-<sleutel>' of crypto.randomUUID()
  lijst     TEXT NOT NULL CHECK (lijst IN ('soortWerk','soortDak','bedekking','huidigeBedekking','ondergrond',
                                           'isolatie','extras','afwerking','hoogte','garantie')),
  sleutel   TEXT NOT NULL,                                -- stabiel: [a-z0-9_], in invoer_json en prijsposten
  label     TEXT NOT NULL,
  volgorde  INTEGER NOT NULL,
  verborgen INTEGER NOT NULL DEFAULT 0 CHECK (verborgen IN (0,1)),
  standaard INTEGER NOT NULL DEFAULT 0 CHECK (standaard IN (0,1)),   -- 1 = uit de startset
  UNIQUE (lijst, sleutel)
);
CREATE INDEX idx_keuzeopties_lijst ON keuzeopties(lijst, volgorde);

-- garantieJaren wordt een sleutel uit de lijst 'garantie': 10 → '10', 20 → '20'.
UPDATE offertes
SET invoer_json = json_set(invoer_json, '$.garantieJaren', CAST(json_extract(invoer_json, '$.garantieJaren') AS TEXT))
WHERE json_type(invoer_json, '$.garantieJaren') = 'integer';
