-- OFM-048: de tabs Prijzen en Werkzaamheden zijn samengevoegd. Geen schemawijziging: migreer() draait
-- na deze SQL, in dezelfde transactie, voegPrijzenSamen (main/db/prijzenSamenvoegen.ts). Die geeft elke
-- werkzaamheid een uurprijs-post werk:<sleutel>:uur, en zet de oude losse prijsposten (startset van
-- OFM-003, posten uit oude keuzelijsten, eigen posten) om naar materialen als een offerte ze gebruikt,
-- ze een prijs hebben of de gebruiker ze zelf maakte; de andere verdwijnen. Steiger, verzekerde
-- garantie en voorrijkosten blijven losse posten (TDO §9.7).
SELECT 1;
