-- OFM-038: de klantnaam wordt voornaam + achternaam. De oude `naam` gaat in zijn geheel naar
-- `achternaam`, `voornaam` blijft leeg. Dat geldt voor alle offertes (ook definitieve): de app leest
-- klant_json met één schema, en met een lege voornaam geven aanhef, adresblok, zoektekst en
-- PDF-bestandsnaam precies dezelfde tekst als vóór de migratie. Bestaande PDF-bestanden blijven zoals
-- ze zijn.
UPDATE offertes
SET klant_json = json_set(
  json_remove(klant_json, '$.naam'),
  '$.voornaam', '',
  '$.achternaam', coalesce(json_extract(klant_json, '$.naam'), '')
)
WHERE json_valid(klant_json) AND json_type(klant_json, '$.naam') IS NOT NULL;
