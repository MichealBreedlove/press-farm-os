-- Migration 069: Seed inventory initial stock
-- Loads Micheal's on-hand field-seed inventory (2026-06-13) into `seeds`.
-- Excludes microgreens seeds (tracked in the microgreens module).
--
-- Every seed row must reference an `items` row (seeds.item_id NOT NULL). The vast
-- majority map to existing catalog crops; the cultivar is stored in `seeds.variety`.
-- Six crops had no catalog item yet (sorghum, fenugreek, celosia, bells of Ireland,
-- shasta daisy, marshmallow) -- created here as catalog items with NO availability,
-- so they appear in the catalog/seed list but NOT on any chef order form.
--
-- Quantities/units preserved as Micheal reported them (cups, oz, lb, packets, seeds,
-- g). lb+oz amounts converted to oz with the original noted. "Total" phrasing recorded
-- as the stated total (not summed). Cost/supplier filled where an order receipt was
-- provided (True Leaf Market #11763000, Johnny's Selected Seeds).

DO $$
DECLARE
  v_farm uuid;
BEGIN
  SELECT id INTO v_farm FROM farms ORDER BY created_at LIMIT 1;
  IF v_farm IS NULL THEN
    RAISE EXCEPTION 'No farm found';
  END IF;

  -- 1) New catalog items for crops not yet in the catalog (unpublished: no availability).
  INSERT INTO items (farm_id, name, category, unit_type, internal_notes)
  VALUES
    (v_farm, 'Sorghum',          'flowers',      'EA', 'Seed inventory only - not yet offered'),
    (v_farm, 'Fenugreek',        'herbs_leaves', 'EA', 'Seed inventory only - not yet offered'),
    (v_farm, 'Celosia',          'flowers',      'EA', 'Seed inventory only - not yet offered'),
    (v_farm, 'Bells of Ireland', 'flowers',      'EA', 'Seed inventory only - not yet offered'),
    (v_farm, 'Shasta Daisy',     'flowers',      'EA', 'Seed inventory only - not yet offered'),
    (v_farm, 'Marshmallow',      'herbs_leaves', 'EA', 'Seed inventory only - not yet offered')
  ON CONFLICT (farm_id, name, category) DO NOTHING;

  -- 2) Seed rows. Join to items by (name, category) -- UNIQUE per farm since migration 032.
  --    Idempotent: skips any (item_id, variety) already present.
  INSERT INTO seeds (farm_id, item_id, variety, initial_quantity, quantity_unit, supplier, cost, purchase_date, status, notes)
  SELECT v_farm, i.id, v.variety, v.qty::numeric, v.unit, v.supplier, v.cost::numeric, v.pdate::date, 'active', v.notes
  FROM (VALUES
    -- Radish
    ('Radish','fruit_veg','Breakfast',2.5,'cups',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','Easter Egg',2.5,'cups',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','Nelson',1,'packet',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','Bacchus',1,'packet',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','Cherry Belle',4,'lb',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','China Jade',4,'packets',NULL,NULL,NULL,NULL),
    ('Radish','fruit_veg','Red Rat Tail',6,'packets',NULL,NULL,NULL,NULL),
    -- Mustard
    ('Mustard Leaves','herbs_leaves','Yellow Mustard',2.5,'cups',NULL,NULL,NULL,NULL),
    ('Mustard Leaves','herbs_leaves','Red Garnet',4,'oz',NULL,NULL,NULL,NULL),
    ('Mustard Leaves','herbs_leaves','Scarlet Pearls',1,'packet',NULL,NULL,NULL,NULL),
    ('Mustard Leaves','herbs_leaves','Wasabi',1,'packet',NULL,NULL,NULL,NULL),
    ('Mustard Leaves','herbs_leaves','Japanese Red',1,'packet',NULL,NULL,NULL,NULL),
    ('Tatsoi','herbs_leaves','Red Tatsoi',4,'oz',NULL,NULL,NULL,NULL),
    -- Gem / signet marigold
    ('Gem Marigold','flowers','Red Gem',4,'oz',NULL,NULL,NULL,NULL),
    ('Gem Marigold','flowers','Lemon Gem',5,'oz',NULL,NULL,NULL,NULL),
    ('Gem Marigold','flowers','Tangerine Gem',2,'oz',NULL,NULL,NULL,NULL),
    -- Marigold
    ('Marigold','flowers','Durango Tangerine',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Bonanza Deep Orange',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Bonanza Harmony',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Bonanza Bee',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','White',2,'packets',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Durango Flame',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Durango Outback Mix',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Coco Gold',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Giant Yellow',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Coco Yellow',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Giant Orange',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Burning Embers',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Safari Tangerine',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Disco Mix',1,'packet',NULL,NULL,NULL,NULL),
    ('Marigold','flowers','Durango Red',1,'packet',NULL,NULL,NULL,NULL),
    -- Kale
    ('Kale','herbs_leaves','Kale Mix',1,'cup',NULL,NULL,NULL,NULL),
    ('Kale','herbs_leaves','Red',1,'packet',NULL,NULL,NULL,NULL),
    -- Flowering (ornamental) kale - True Leaf Market #11763000
    ('Ornamental Kale','micros_leaves','Kamome White',100,'seeds','True Leaf Market',8.26,'2026-06-12',NULL),
    ('Ornamental Kale','micros_leaves','Kamome Red',100,'seeds','True Leaf Market',8.26,'2026-06-12',NULL),
    ('Ornamental Kale','micros_leaves','Kamome Pink',100,'seeds','True Leaf Market',8.26,'2026-06-12',NULL),
    -- Carrots
    ('Carrots','fruit_veg','Ox Heart',1,'lb',NULL,NULL,NULL,NULL),
    ('Carrots','fruit_veg','White',2.5,'oz',NULL,NULL,NULL,NULL),
    ('Carrots','fruit_veg','Red',3.4,'oz',NULL,NULL,NULL,NULL),
    ('Carrots','fruit_veg','Mixed',9.5,'oz',NULL,NULL,NULL,NULL),
    -- Lettuce / salad
    ('Lettuce','herbs_leaves','Greens Mix',1,'cup',NULL,NULL,NULL,NULL),
    ('Lettuce','herbs_leaves','Salanova Red Gem',1,'packet',NULL,NULL,NULL,NULL),
    ('Lettuce','herbs_leaves','Salanova Red Butter',0.5,'packet',NULL,NULL,NULL,NULL),
    ('Lettuce','herbs_leaves','Lettuce Mix',1,'packet',NULL,NULL,NULL,NULL),
    ('Lettuce','herbs_leaves','Summertime',1,'packet',NULL,NULL,NULL,'Crop/variety uncertain'),
    -- Tomatoes
    ('Tomatoes','fruit_veg','Yellow Currant',1,'oz',NULL,NULL,NULL,NULL),
    ('Tomatoes','fruit_veg','Red Currant',1,'oz',NULL,NULL,NULL,NULL),
    -- Squash / pumpkin / zucchini
    ('Squash','fruit_veg','Zephyr Summer',250,'seeds',NULL,NULL,NULL,NULL),
    ('Squash','fruit_veg','Acorn Honey Bear',1,'packet',NULL,NULL,NULL,NULL),
    ('Pumpkin','fruit_veg','Winter Luxury Pie',1,'packet',NULL,NULL,NULL,NULL),
    ('Zucchini','fruit_veg','Yellowfin',1,'packet',NULL,NULL,NULL,NULL),
    -- Alliums / chives
    ('Garlic Chive','herbs_leaves','Garlic Chives',1,'oz',NULL,NULL,NULL,NULL),
    ('Chives','micros_leaves','Chives',1,'packet',NULL,NULL,NULL,NULL),
    ('Onion','fruit_veg','Walla Walla Sweet',1,'packet',NULL,NULL,NULL,NULL),
    ('Scallions','fruit_veg','Tokyo Long White (Bunching)',1,'lb','True Leaf Market',52.06,'2026-06-12',NULL),
    -- Cucumbers
    ('Cucumbers','fruit_veg','Cork',30,'seeds',NULL,NULL,NULL,'Variety name uncertain'),
    ('Cucumbers','fruit_veg','Quick Snack',100,'seeds',NULL,NULL,NULL,NULL),
    ('Cucamelons','fruit_veg','Mexican Sour Gherkin',1,'packet',NULL,NULL,NULL,NULL),
    -- Basil / tulsi
    ('Basil','herbs_leaves','Purple Ball',1,'packet',NULL,NULL,NULL,NULL),
    ('Basil','herbs_leaves','Greek',0.25,'lb',NULL,NULL,NULL,NULL),
    ('Basil','herbs_leaves','Citrus Everleaf Lemon',1,'packet',NULL,NULL,NULL,NULL),
    ('Basil','herbs_leaves','Cinnamon',4,'packets',NULL,NULL,NULL,NULL),
    ('Tulsi','herbs_leaves','Tulsi',1,'packet',NULL,NULL,NULL,NULL),
    -- Alyssum - True Leaf Market #11763000
    ('Alyssum','flowers','Wonderland Series Mix',1,'packet','True Leaf Market',13.66,'2026-06-12','Listed as "wandering mixture"'),
    ('Alyssum','flowers','Basket of Gold',1,'packet','True Leaf Market',2.99,'2026-06-12',NULL),
    ('Alyssum','flowers','Sweet',1.33,'lb',NULL,NULL,NULL,NULL),
    -- Chamomile
    ('Chamomile','herbs_leaves','Chamomile',1,'oz',NULL,NULL,NULL,NULL),
    -- Calendula
    ('Calendula','flowers','Pink & Yellow',1,'packet',NULL,NULL,NULL,NULL),
    ('Calendula','flowers','Flashback Mix',1,'oz',NULL,NULL,NULL,NULL),
    ('Calendula','flowers','Unspecified',2.4,'oz',NULL,NULL,NULL,NULL),
    -- Sunflower
    ('Sunflower','flowers','Teddy Bear',0.25,'lb',NULL,NULL,NULL,NULL),
    ('Sunflower','flowers','Yellow/Brown',25,'oz',NULL,NULL,NULL,'1 lb 9 oz'),
    -- Fava
    ('Fava - Beans','fruit_veg','Crimson-Flowered',1,'lb',NULL,NULL,NULL,NULL),
    ('Fava - Beans','fruit_veg','Broad Bean (Bread Bean)',5,'lb',NULL,NULL,NULL,NULL),
    -- Turnip
    ('Turnip','fruit_veg','Hakurei',1,'cup',NULL,NULL,NULL,NULL),
    ('Turnip','fruit_veg','Shogoin',1,'packet',NULL,NULL,NULL,'Name uncertain ("Shogha Guards Mark 8")'),
    ('Turnip','fruit_veg','Hirosaki Red',1,'packet',NULL,NULL,NULL,NULL),
    ('Turnip','fruit_veg','Golden Globe',1,'packet',NULL,NULL,NULL,NULL),
    -- Eggplant
    ('Eggplant','fruit_veg','Fairy Tale',100,'seeds',NULL,NULL,NULL,NULL),
    -- Dill
    ('Dill','micros_leaves','Elephant',1,'packet',NULL,NULL,NULL,NULL),
    ('Dill','micros_leaves','Bouquet',1,'packet',NULL,NULL,NULL,NULL),
    -- Fennel
    ('Fennel','herbs_leaves','Preludo',1,'packet',NULL,NULL,NULL,NULL),
    -- Dianthus
    ('Dianthus','flowers','Rainbow Loveliness',1,'packet',NULL,NULL,NULL,NULL),
    -- Cabbage
    ('Cabbage','herbs_leaves','Tete Noire',1,'packet',NULL,NULL,NULL,NULL),
    ('Cabbage','herbs_leaves','Careflex',3,'packets',NULL,NULL,NULL,'Reported as 1 pack + 2 packs'),
    -- Bok choy
    ('Bok Choy','fruit_veg','Little Shanghai',1,'packet',NULL,NULL,NULL,NULL),
    -- Chervil
    ('Chervil','micros_leaves','Sherville',1,'packet',NULL,NULL,NULL,'Variety name uncertain'),
    -- Cosmos
    ('Cosmos','flowers','Double Click Mix',1,'packet',NULL,NULL,NULL,NULL),
    ('Cosmos','flowers','Orange',1,'packet',NULL,NULL,NULL,NULL),
    -- Shasta daisy (new item)
    ('Shasta Daisy','flowers','Snow Lady',0.25,'packet',NULL,NULL,NULL,NULL),
    -- Bachelor button
    ('Bachelor Button','flowers','Choice Mix',1,'packet',NULL,NULL,NULL,NULL),
    ('Bachelor Button','flowers','Classic Magic',1,'packet',NULL,NULL,NULL,NULL),
    ('Bachelor Button','flowers','Classic Romantic',1,'packet',NULL,NULL,NULL,NULL),
    -- Brussels sprouts
    ('Brussel Sprouts','micros_leaves','Long Island Improved',1,'packet',NULL,NULL,NULL,NULL),
    -- Broccoli
    ('Broccoli','fruit_veg','de Cicco',5000,'seeds',NULL,NULL,NULL,NULL),
    ('Broccoli','fruit_veg','Calabrese',5000,'seeds',NULL,NULL,NULL,NULL),
    -- Borage
    ('Borage','flowers','Blue',2,'packets',NULL,NULL,NULL,NULL),
    ('Borage','flowers','White',1,'packet',NULL,NULL,NULL,NULL),
    -- Beets
    ('Beets','fruit_veg','Boldor',1,'packet',NULL,NULL,NULL,NULL),
    ('Beets','fruit_veg','Boro',1,'packet',NULL,NULL,NULL,NULL),
    -- Herbs
    ('Angelica','herbs_leaves','Angelica',1,'packet',NULL,NULL,NULL,NULL),
    ('Lovage','herbs_leaves','Lovage',1,'packet',NULL,NULL,NULL,NULL),
    ('Sage','herbs_leaves','Broad Leaf',1,'packet',NULL,NULL,NULL,NULL),
    ('Tarragon','herbs_leaves','Russian',1,'packet',NULL,NULL,NULL,NULL),
    -- Ground cherry
    ('Ground Cherries','fruit_veg','Goldie',1,'packet',NULL,NULL,NULL,NULL),
    -- Celosia / bells of Ireland (new items)
    ('Celosia','flowers','Pampas Plume',1,'packet',NULL,NULL,NULL,NULL),
    ('Bells of Ireland','flowers','Bells of Ireland',1,'packet',NULL,NULL,NULL,NULL),
    -- Peas
    ('Peas','fruit_veg','Caledon Wonder',1,'packet',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','Little Marble',1,'packet',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','Lincoln',1,'packet',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','King Tut Purple',1,'packet',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','Lillian''s Garden',1,'packet',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','Royal Snap',25,'oz',NULL,NULL,NULL,'1 lb 9 oz'),
    ('Peas','fruit_veg','Sugar Snap',25.6,'oz',NULL,NULL,NULL,'1 lb 9.6 oz'),
    ('Peas','fruit_veg','Honey Snap',23,'oz',NULL,NULL,NULL,'1 lb 7 oz'),
    ('Peas','fruit_veg','Lincoln Shell',6,'oz',NULL,NULL,NULL,NULL),
    ('Peas','fruit_veg','King Tut Shell',5,'oz',NULL,NULL,NULL,NULL),
    -- Parsley
    ('Parsley','herbs_leaves','Giant of Italy',1,'packet',NULL,NULL,NULL,NULL),
    -- Peppers
    ('Peppers','fruit_veg','Sugar Peach',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Canary Bell',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Corbaci',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Doux d''Espagne',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Espelette',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Jimmy Nardello',1,'packet',NULL,NULL,NULL,NULL),
    ('Peppers','fruit_veg','Aji Dulce',1,'packet',NULL,NULL,NULL,NULL),
    -- Okra
    ('Okra','fruit_veg','Jambalaya 2.0',1,'packet',NULL,NULL,NULL,NULL),
    ('Okra','fruit_veg','Clemson Spineless',1,'packet',NULL,NULL,NULL,NULL),
    -- Marshmallow (new item)
    ('Marshmallow','herbs_leaves','Marshmallow',1,'packet',NULL,NULL,NULL,NULL),
    -- Melons / watermelon
    ('Melons','fruit_veg','Golden Crisp',1,'packet',NULL,NULL,NULL,NULL),
    ('Melons','fruit_veg','Bateekh Samara',1,'packet',NULL,NULL,NULL,NULL),
    ('Melons','fruit_veg','Japanese Tiger',1,'packet',NULL,NULL,NULL,NULL),
    ('Watermelon','fruit_veg','Lemon Drop',1,'packet',NULL,NULL,NULL,NULL),
    ('Watermelon','fruit_veg','Black Jewel',1,'packet',NULL,NULL,NULL,NULL),
    -- Zinnias / yarrow / violas
    ('Zinnias','flowers','Mixed Colors',20,'packets',NULL,NULL,NULL,NULL),
    ('Yarrow','flowers','Unknown Color',1,'packet',NULL,NULL,NULL,NULL),
    ('Violas','flowers','Sorbet Formula Mix',250,'seeds','Johnny''s Selected Seeds',9.75,NULL,NULL),
    ('Violas','flowers','Penny Peach Jump-up',250,'seeds','Johnny''s Selected Seeds',9.75,NULL,NULL),
    ('Violas','flowers','Sorbet XP Deep Orange',250,'seeds','Johnny''s Selected Seeds',9.75,NULL,NULL),
    -- Malabar spinach
    ('Malabar Spinach','micros_leaves','Red',1,'packet',NULL,NULL,NULL,NULL),
    -- Sorghum (new item)
    ('Sorghum','flowers','Black Amber',1,'packet',NULL,NULL,NULL,NULL),
    ('Sorghum','flowers','Mennonite',1,'packet',NULL,NULL,NULL,NULL),
    ('Sorghum','flowers','Honeydrake',1,'packet',NULL,NULL,NULL,NULL),
    ('Sorghum','flowers','Yellow Bonnet',1,'packet',NULL,NULL,NULL,NULL),
    ('Sorghum','flowers','Black African',1,'packet',NULL,NULL,NULL,NULL),
    -- Beans
    ('Beans','fruit_veg','Hyacinth & Red Runner Mix',1246,'g',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Red Runner',1596,'g',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Sonesta Wax Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Beurre de Rocquencourt Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Orin Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Jade Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Golden Butterwax Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Hutterite Soup Bush',1,'packet',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Sunset Runner',2,'packets',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Black Coat Runner',2,'packets',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Black Knight Runner',2,'packets',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Black-Eyed Pea',6,'oz',NULL,NULL,NULL,'Cowpea'),
    ('Beans','fruit_veg','Hyacinth Moon Shadow Mix',9.3,'oz',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Cranberry',6.3,'oz',NULL,NULL,NULL,NULL),
    ('Beans','fruit_veg','Cannellini',7.7,'oz',NULL,NULL,NULL,NULL),
    -- Cover crop
    ('Cover Crop','flowers','Seed Mix',59,'oz',NULL,NULL,NULL,'3 lb 11 oz'),
    ('Cover Crop','flowers','Yellow Mustard',5,'lb','Johnny''s Selected Seeds',25.75,NULL,NULL),
    -- Fenugreek (new item)
    ('Fenugreek','herbs_leaves','Fenugreek',1,'packet',NULL,NULL,NULL,NULL)
  ) AS v(iname, icat, variety, qty, unit, supplier, cost, pdate, notes)
  JOIN items i ON i.farm_id = v_farm AND i.name = v.iname AND i.category = v.icat
  WHERE NOT EXISTS (
    SELECT 1 FROM seeds s WHERE s.item_id = i.id AND s.variety = v.variety
  );
END $$;
