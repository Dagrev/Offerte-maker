-- OFM-045: oude offertes zijn omgezet naar werkzaamheden. migreer() zet vóór deze SQL, in dezelfde
-- transactie, de invoer van alle offertes om (main/db/omzettingWerkzaamheden.ts; de oude velden van
-- de stap Extra's verdwijnen uit invoer_json). Daarna zijn de vier keuzelijsten van die stap niet meer
-- nodig: de werkzaamheden en materialen nemen hun plaats in (TDO §9.7). Hun prijsposten blijven staan.
DELETE FROM keuzeopties WHERE lijst IN ('bedekking', 'isolatie', 'extras', 'afwerking');
