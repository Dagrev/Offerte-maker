-- OFM-049: per keuzelijst een instelbare standaardkeuze voor nieuwe offertes. De kolom `standaard`
-- blijft "hoort bij de startset" (voor Herstel standaardlijst); `standaardkeuze` is de keuze waarmee een
-- nieuwe offerte start. Gevuld met de vaste waarden van vóór OFM-049 (VASTE_KEUZES): hoogte 1 en
-- garantie 10; soort werk, soort dak, huidige dakbedekking en ondergrond zonder standaard.
ALTER TABLE keuzeopties ADD COLUMN standaardkeuze INTEGER NOT NULL DEFAULT 0 CHECK (standaardkeuze IN (0, 1));

UPDATE keuzeopties SET standaardkeuze = 1
WHERE (lijst = 'hoogte' AND sleutel = '1') OR (lijst = 'garantie' AND sleutel = '10');

-- Hoogstens één standaardkeuze per lijst.
CREATE UNIQUE INDEX idx_keuzeopties_standaardkeuze ON keuzeopties (lijst) WHERE standaardkeuze = 1;
