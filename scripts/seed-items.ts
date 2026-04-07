/**
 * Seed items script
 * Upserts the Press Farm item catalog into `items` and `price_catalog` tables.
 * Uses the Supabase service role key to bypass RLS.
 * Run: npx tsx scripts/seed-items.ts
 */

import path from 'path';
import { config } from 'dotenv';

// Load .env.local — try worktree root first, then walk up to project root
// Worktree is at: <project>/.claude/worktrees/<name>  →  3 levels up = project root
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '../../../.env.local'),
  path.resolve(process.cwd(), '../../.env.local'),
];
for (const envPath of envPaths) {
  const result = config({ path: envPath });
  if (!result.error) {
    console.log(`Loaded env from: ${envPath}`);
    break;
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// Item definitions
// ============================================
type Category = 'flowers' | 'herbs_leaves' | 'micros_leaves' | 'fruit_veg' | 'kits';
type UnitType = 'ea' | 'sm' | 'lg' | 'lbs' | 'bu' | 'qt' | 'bx' | 'cs' | 'pt' | 'kit';

interface ItemDef {
  category: Category;
  name: string;
  unit_type: UnitType;
  price: number;
}

const ITEMS: ItemDef[] = [
  // FLOWERS
  { category: 'flowers', name: 'Alyssum', unit_type: 'sm', price: 6 },
  { category: 'flowers', name: 'Mustard Flower', unit_type: 'lg', price: 20 },
  { category: 'flowers', name: 'Chrysanthemum Flower', unit_type: 'lg', price: 12 },
  { category: 'flowers', name: 'Forget-Me-Nots', unit_type: 'sm', price: 12 },
  { category: 'flowers', name: 'Fava Flowers', unit_type: 'lg', price: 24 },
  { category: 'flowers', name: 'Radish Flower', unit_type: 'sm', price: 10 },
  { category: 'flowers', name: 'Dahlia Flowers', unit_type: 'lg', price: 15 },
  { category: 'flowers', name: 'Calendula', unit_type: 'lg', price: 20 },
  { category: 'flowers', name: 'Bachelor Buttons', unit_type: 'lg', price: 30 },
  { category: 'flowers', name: 'Borage', unit_type: 'sm', price: 15 },
  { category: 'flowers', name: 'Pea Flowers', unit_type: 'lg', price: 12 },
  { category: 'flowers', name: 'Nasturtium Flower', unit_type: 'lg', price: 15 },
  { category: 'flowers', name: 'Cosmos', unit_type: 'lg', price: 12 },
  { category: 'flowers', name: 'Viola larger mixed', unit_type: 'lg', price: 15 },

  // HERBS/LEAVES
  { category: 'herbs_leaves', name: 'Bay Leaf California', unit_type: 'lg', price: 15 },
  { category: 'herbs_leaves', name: 'Bay Leaf Traditional', unit_type: 'lg', price: 20 },
  { category: 'herbs_leaves', name: 'Frilly Mustard Red/Green', unit_type: 'lg', price: 20 },
  { category: 'herbs_leaves', name: 'Field Pea Tendrils', unit_type: 'lg', price: 12 },
  { category: 'herbs_leaves', name: 'Fava Leaves', unit_type: 'lg', price: 24 },
  { category: 'herbs_leaves', name: 'Chickweed', unit_type: 'lg', price: 12 },
  { category: 'herbs_leaves', name: 'Kale Ethiopian', unit_type: 'lg', price: 20 },
  { category: 'herbs_leaves', name: 'Kale Flowering', unit_type: 'lg', price: 20 },
  { category: 'herbs_leaves', name: 'Miners Lettuce', unit_type: 'lg', price: 10 },
  { category: 'herbs_leaves', name: 'Mustard Greens', unit_type: 'lg', price: 12 },
  { category: 'herbs_leaves', name: 'Mint Chocolate', unit_type: 'lg', price: 15 },
  { category: 'herbs_leaves', name: 'Mint Spearmint', unit_type: 'lg', price: 10 },
  { category: 'herbs_leaves', name: 'Mint Pineapple', unit_type: 'lg', price: 10 },
  { category: 'herbs_leaves', name: 'Mint Strawberry', unit_type: 'lg', price: 15 },
  { category: 'herbs_leaves', name: 'Mint Japanese', unit_type: 'lg', price: 10 },
  { category: 'herbs_leaves', name: 'Rose Geranium', unit_type: 'lg', price: 16 },
  { category: 'herbs_leaves', name: 'Rosemary', unit_type: 'ea', price: 0.20 },
  { category: 'herbs_leaves', name: 'Oxalis/Lucky Sorrel', unit_type: 'sm', price: 6 },

  // MICROS/LEAVES
  { category: 'micros_leaves', name: 'Nasturtium Dime-Nickel', unit_type: 'ea', price: 0.35 },
  { category: 'micros_leaves', name: 'Nasturtium Quarter-Silver Dollar', unit_type: 'ea', price: 0.35 },
  { category: 'micros_leaves', name: 'Chrysanthemum Leaf', unit_type: 'lg', price: 18 },

  // FRUIT/VEG
  { category: 'fruit_veg', name: 'Radish Cherry Belle', unit_type: 'lg', price: 25 },
  { category: 'fruit_veg', name: 'Fava Tips', unit_type: 'lg', price: 24 },

  // SALAD KITS
  { category: 'kits', name: 'Salad Mix Small Leaf', unit_type: 'lg', price: 15 },
  { category: 'kits', name: 'Salad Mix Large Leaf', unit_type: 'lg', price: 12 },
  { category: 'kits', name: 'Kale Red/Green', unit_type: 'lg', price: 20 },
  { category: 'kits', name: 'Mustard Red Tatsoi', unit_type: 'lg', price: 20 },
  { category: 'kits', name: 'Tatsoi', unit_type: 'lg', price: 20 },
];

async function main() {
  console.log('=== Seed Items ===');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Total items to seed: ${ITEMS.length}`);

  // 1. Find the farm ID
  const { data: farms, error: farmError } = await supabase
    .from('farms')
    .select('id, name')
    .eq('name', 'Press Farm')
    .single();

  if (farmError || !farms) {
    console.error('Could not find Press Farm:', farmError?.message);
    process.exit(1);
  }

  const farmId = farms.id;
  console.log(`\nFound farm: ${farms.name} (${farmId})`);

  // 2. Check existing items by name+farm to decide what to upsert vs insert
  const { data: existingItems, error: existingError } = await supabase
    .from('items')
    .select('id, name, category, unit_type, default_price')
    .eq('farm_id', farmId);

  if (existingError) {
    console.error('Failed to fetch existing items:', existingError.message);
    process.exit(1);
  }

  console.log(`Existing items in DB: ${existingItems?.length ?? 0}`);

  const existingByName = new Map(
    (existingItems || []).map((item) => [item.name.toLowerCase(), item])
  );

  // 3. Split into update vs insert
  const toInsert: Array<{
    farm_id: string;
    name: string;
    category: Category;
    unit_type: UnitType;
    default_price: number;
    sort_order: number;
    is_archived: boolean;
  }> = [];

  const toUpdate: Array<{
    id: string;
    name: string;
    category: Category;
    unit_type: UnitType;
    default_price: number;
  }> = [];

  let sortOrder = 10;
  for (const item of ITEMS) {
    const existing = existingByName.get(item.name.toLowerCase());
    if (existing) {
      toUpdate.push({
        id: existing.id,
        name: item.name,
        category: item.category,
        unit_type: item.unit_type,
        default_price: item.price,
      });
    } else {
      toInsert.push({
        farm_id: farmId,
        name: item.name,
        category: item.category,
        unit_type: item.unit_type,
        default_price: item.price,
        sort_order: sortOrder,
        is_archived: false,
      });
    }
    sortOrder += 10;
  }

  console.log(`\nItems to insert: ${toInsert.length}`);
  console.log(`Items to update: ${toUpdate.length}`);

  // 4. Insert new items
  let insertedIds: Record<string, string> = {}; // name -> id

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('items')
      .insert(toInsert)
      .select('id, name');

    if (insertError) {
      console.error('Insert failed:', insertError.message);
      process.exit(1);
    }

    console.log(`Inserted ${inserted?.length ?? 0} items`);
    for (const row of inserted || []) {
      insertedIds[row.name.toLowerCase()] = row.id;
    }
  }

  // 5. Update existing items
  for (const item of toUpdate) {
    const { error: updateError } = await supabase
      .from('items')
      .update({
        category: item.category,
        unit_type: item.unit_type,
        default_price: item.default_price,
      })
      .eq('id', item.id);

    if (updateError) {
      console.error(`Failed to update item "${item.name}":`, updateError.message);
    }
  }

  if (toUpdate.length > 0) {
    console.log(`Updated ${toUpdate.length} existing items`);
  }

  // 6. Build full name->id map for price_catalog
  const allItemIds: Record<string, string> = { ...insertedIds };
  for (const item of toUpdate) {
    allItemIds[item.name.toLowerCase()] = item.id;
  }
  // Also grab IDs for any existing that we updated (already in toUpdate)
  for (const existing of existingItems || []) {
    if (!allItemIds[existing.name.toLowerCase()]) {
      allItemIds[existing.name.toLowerCase()] = existing.id;
    }
  }

  // 7. Upsert price_catalog entries
  const EFFECTIVE_DATE = '2026-01-01';
  const priceCatalogRows = ITEMS.map((item) => {
    const itemId = allItemIds[item.name.toLowerCase()];
    if (!itemId) {
      console.warn(`Warning: Could not find ID for item "${item.name}" — skipping price catalog`);
      return null;
    }
    return {
      item_id: itemId,
      unit: item.unit_type,
      price_per_unit: item.price,
      effective_date: EFFECTIVE_DATE,
      source: 'market' as const,
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  console.log(`\nUpserting ${priceCatalogRows.length} price_catalog entries...`);

  const { data: priceCatalogResult, error: priceError } = await supabase
    .from('price_catalog')
    .upsert(priceCatalogRows, {
      onConflict: 'item_id,unit,effective_date',
      ignoreDuplicates: false,
    })
    .select();

  if (priceError) {
    console.error('price_catalog upsert failed:', priceError.message);
    process.exit(1);
  }

  console.log(`Price catalog upserted: ${priceCatalogResult?.length ?? 0} rows`);

  // 8. Final verification
  const { count: itemCount } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('is_archived', false);

  const { count: priceCount } = await supabase
    .from('price_catalog')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Final Summary ===');
  console.log(`Active items in DB (Press Farm): ${itemCount}`);
  console.log(`Price catalog entries: ${priceCount}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
