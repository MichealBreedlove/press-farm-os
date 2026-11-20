-- 099: DATA — Spanish text for the open job-list / recurring farm tasks
--
-- Companion to 098. The open hand-written tasks only carried a one-line
-- "ES:" note at the end of an English description, so on the Farm Hand
-- portal the Where / How / How much detail stayed English-only. This fills
-- title_es + description_es for the tasks open on 2026-11-20 (matched by
-- title; only rows that have no Spanish yet). New and edited tasks get
-- theirs automatically from the app.
--
-- Rollback: UPDATE farm_tasks SET title_es = NULL, description_es = NULL
--           WHERE status = 'open' AND source IN ('manual','recurring-item');

UPDATE farm_tasks t
SET title_es = v.title_es, description_es = v.description_es
FROM (VALUES
  ('Sow the Salanova lettuce in trays',
   'Sembrar la lechuga Salanova en charolas',
   'Dónde: Charolas en el invernadero; van al Cuadrante 3, hileras 5-6. Cómo: Charolas de 128 celdas, una semilla por celda. Cuánto: 2 charolas, unas 250 plantas.'),
  ('Sow romaine lettuce in trays',
   'Sembrar la lechuga romana en charolas',
   'Dónde: Charolas en el invernadero; van al Cuadrante 3, hileras 5-6. Cómo: Charolas de 128 celdas, una semilla por celda. Cuánto: 2 charolas, unas 250 plantas.'),
  ('Sow the mustard greens and baby kale',
   'Sembrar la mostaza y la col rizada tierna (baby kale)',
   'Dónde: Cuadrante 2, hileras 6-16. Cómo: Sembradora Jang, rodillo F-24. Cuánto: 5 pies de hilera de cada una.'),
  ('Plant the garlic - same ground every year, nothing else in this quadrant',
   'Plantar el ajo - el mismo terreno cada año, nada más en este cuadrante',
   'Dónde: El cuadrante del ajo junto al invernadero, las 14 hileras. Cómo: Meter los dientes a mano. Cuánto: Las 14 hileras.'),
  ('Harvest every Ox Heart carrot at once into the walk-in cooler (~8,500)',
   'Cosechar todas las zanahorias Ox Heart de una vez y meterlas a la cámara fría (~8,500)',
   'Dónde: Cuadrante 4, hileras 3-21. Cómo: Aflojar y sacar a mano. Se conservan en la cámara fría todo el invierno; no se planta nada en su lugar. Cuánto: Todas, unas 8,500 zanahorias.'),
  ('Move the Salanova lettuce out of trays into the ground',
   'Sacar la lechuga Salanova de las charolas y plantarla en la tierra',
   'Dónde: Cuadrante 3, hileras 5-6. Cómo: Plantar las plantitas a mano; están listas 3-4 semanas después de la siembra. Cuánto: Lo de 2 charolas.'),
  ('Take samples of everything ready to the kitchen for the December 10 menu',
   'Llevar a la cocina muestras de todo lo que esté listo para el menú del 10 de diciembre',
   'Dónde: Cocina. Cómo: Muestras de todo lo que esté listo para que puedan armar el menú del 10 de diciembre.'),
  ('Start looking for wild mushrooms after each rain: chanterelles, candy caps, black trumpets',
   'Empezar a buscar hongos silvestres después de cada lluvia: chanterelles, candy caps, trompetas negras',
   'Dónde: Bosque de robles hacia la costa de Sonoma. Cómo: Recolectar. Nunca servir un hongo si no está seguro de cuál es.'),
  ('Put frost cloth over the succulent planter boxes before the first hard frost',
   'Poner manta térmica sobre las cajas de suculentas antes de la primera helada fuerte',
   'Dónde: Las cajas de cultivo junto al invernadero. Cómo: Cubrir con manta térmica; es lo que las protege durante el invierno. Cuánto: Todas las cajas de suculentas.'),
  ('Sow Radish (recurring every 14d)',
   'Sembrar rábanos (cada 14 días)',
   'Dónde: Cuadrante 1, hileras 4-5. Cómo: Siembra directa, una semilla cada media pulgada (no al voleo). Cuánto: 5 pies de hilera.'),
  ('Sow Turnip (recurring every 14d)',
   'Sembrar nabos (cada 14 días)',
   'Dónde: Cuadrante 1, hileras 6-7. Cómo: Siembra directa, una semilla cada media pulgada (no al voleo). Cuánto: 5 pies de hilera.'),
  ('Everything for the December 10 menu must be picking in full quantity today',
   'Todo lo del menú del 10 de diciembre tiene que estar cosechándose en cantidad completa hoy',
   'Dónde: Toda la granja. Cómo: Volumen completo de cosecha en cada artículo del menú del 10 de diciembre.'),
  ('From here to the new year the work is harvesting only - nothing new is planted',
   'De aquí al año nuevo el trabajo es solo cosechar - no se planta nada nuevo',
   'Dónde: Todos los cuadrantes. Cómo: Cosechar.'),
  ('MENU CHANGES TODAY - nothing can be harvested for the first time today',
   'HOY CAMBIA EL MENÚ - hoy no se puede cosechar nada por primera vez',
   'Dónde: Cocina. Cómo: La cocina necesitaba las muestras para el 19 de noviembre y la cosecha completa para el 3 de diciembre.')
) AS v(title, title_es, description_es)
WHERE t.title = v.title
  AND t.status = 'open'
  AND t.source IN ('manual', 'recurring-item')
  AND t.title_es IS NULL;
