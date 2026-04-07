/**
 * Add delivery dates script
 * Adds the next 8 delivery dates starting from April 7, 2026
 * following the Thu/Sat/Mon pattern.
 * Run: npx tsx scripts/add-delivery-dates.ts
 */

import path from 'path';
import { config } from 'dotenv';

// Load .env.local — try worktree root first, then walk up to find the project root
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
  console.error('Checked paths:', envPaths.join(', '));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Thu/Sat/Mon cycle
const DAY_PATTERN: Array<{ name: 'thursday' | 'saturday' | 'monday'; dayNum: number }> = [
  { name: 'thursday', dayNum: 4 },
  { name: 'saturday', dayNum: 6 },
  { name: 'monday', dayNum: 1 },
];

/**
 * Given a start date, generate the next N delivery dates following Thu/Sat/Mon pattern.
 * The start date itself is included if it falls on Thu, Sat, or Mon.
 */
function generateDeliveryDates(
  startDate: Date,
  count: number
): Array<{ date: string; day_of_week: 'thursday' | 'saturday' | 'monday'; ordering_open: boolean }> {
  const results: Array<{ date: string; day_of_week: 'thursday' | 'saturday' | 'monday'; ordering_open: boolean }> = [];
  const current = new Date(startDate);
  // Reset to midnight UTC
  current.setUTCHours(0, 0, 0, 0);

  while (results.length < count) {
    const dayOfWeek = current.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const match = DAY_PATTERN.find((p) => p.dayNum === dayOfWeek);
    if (match) {
      const dateStr = current.toISOString().slice(0, 10);
      results.push({
        date: dateStr,
        day_of_week: match.name,
        ordering_open: true,
      });
    }
    // Advance by 1 day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return results;
}

async function main() {
  console.log('=== Add Delivery Dates ===');
  console.log(`Supabase URL: ${supabaseUrl}`);

  // First verify connection by checking existing dates
  const { data: existing, error: fetchError } = await supabase
    .from('delivery_dates')
    .select('date, day_of_week')
    .order('date', { ascending: false })
    .limit(5);

  if (fetchError) {
    console.error('Failed to connect to Supabase:', fetchError.message);
    process.exit(1);
  }

  console.log('\nExisting latest delivery dates:');
  existing?.forEach((d) => console.log(`  ${d.date} (${d.day_of_week})`));

  // Generate 8 dates starting April 7, 2026
  const startDate = new Date('2026-04-07T00:00:00Z');
  const datesToAdd = generateDeliveryDates(startDate, 8);

  console.log('\nDates to add:');
  datesToAdd.forEach((d) => console.log(`  ${d.date} (${d.day_of_week})`));

  // Check which ones already exist
  const dateStrings = datesToAdd.map((d) => d.date);
  const { data: alreadyExists } = await supabase
    .from('delivery_dates')
    .select('date')
    .in('date', dateStrings);

  const existingDates = new Set((alreadyExists || []).map((d) => d.date));
  const toInsert = datesToAdd.filter((d) => !existingDates.has(d.date));

  if (toInsert.length === 0) {
    console.log('\nAll dates already exist — nothing to insert.');
    return;
  }

  console.log(`\nInserting ${toInsert.length} new dates...`);
  const { data: inserted, error: insertError } = await supabase
    .from('delivery_dates')
    .insert(toInsert)
    .select();

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    process.exit(1);
  }

  console.log(`Successfully inserted ${inserted?.length ?? 0} delivery dates:`);
  inserted?.forEach((d) => console.log(`  ${d.date} (${d.day_of_week})`));

  // Final verification
  const { data: allDates } = await supabase
    .from('delivery_dates')
    .select('date, day_of_week')
    .order('date', { ascending: true });

  console.log(`\nTotal delivery dates in DB: ${allDates?.length ?? 0}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
