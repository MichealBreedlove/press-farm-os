/**
 * Imports 2024 historical data into the database:
 * - Monthly aggregate delivery totals (Jul–Dec 2024)
 * - Monthly aggregate farm expenses (Jun–Dec 2024)
 *
 * Run: npx ts-node --skip-project --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/import-2024-history.ts
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 2024 monthly data extracted from the Excel workbook annual summary sheet
const MONTHLY_2024 = [
  { month: "2024-06", revenue: 0,        expenses: 649.03  },
  { month: "2024-07", revenue: 1933.60,  expenses: 3285.64 },
  { month: "2024-08", revenue: 10149.56, expenses: 480.66  },
  { month: "2024-09", revenue: 6628.15,  expenses: 497.00  },
  { month: "2024-10", revenue: 8681.47,  expenses: 624.74  },
  { month: "2024-11", revenue: 3673.10,  expenses: 782.67  },
  { month: "2024-12", revenue: 2201.10,  expenses: 857.18  },
];

async function main() {
  console.log("Importing 2024 historical data...\n");

  // Get Press restaurant and farm IDs
  const { data: restaurants } = await admin.from("restaurants").select("id, name, slug, farm_id");
  const press = restaurants?.find((r: any) => r.slug === "press");
  if (!press) throw new Error("Press restaurant not found");
  const farmId = press.farm_id;
  console.log(`Press restaurant: ${press.id}`);

  // Check for existing 2024 aggregate records to avoid duplicates
  const { data: existing } = await admin
    .from("deliveries")
    .select("delivery_date, notes")
    .like("notes", "%Historical monthly aggregate — 2024%");
  const existingMonths = new Set((existing ?? []).map((r: any) => r.delivery_date.slice(0, 7)));
  console.log(`Already imported months: ${[...existingMonths].join(", ") || "none"}\n`);

  let deliveriesInserted = 0;
  let expensesInserted = 0;

  for (const row of MONTHLY_2024) {
    const deliveryDate = `${row.month}-01`;

    // Insert aggregate delivery record (skip if already exists)
    if (row.revenue > 0 && !existingMonths.has(row.month)) {
      const { error } = await admin.from("deliveries").insert({
        restaurant_id: press.id,
        delivery_date: deliveryDate,
        status: "finalized",
        total_value: row.revenue,
        notes: "Historical monthly aggregate — 2024",
      });
      if (error) {
        console.error(`  ✗ Delivery ${row.month}:`, error.message);
      } else {
        console.log(`  ✓ Delivery ${row.month}: $${row.revenue}`);
        deliveriesInserted++;
      }
    } else if (existingMonths.has(row.month)) {
      console.log(`  ↩ Delivery ${row.month}: already exists`);
    }

    // Insert aggregate expense record
    if (row.expenses > 0) {
      // Check if already imported
      const { data: existingExp } = await admin
        .from("farm_expenses")
        .select("id")
        .eq("date", deliveryDate)
        .eq("description", "Historical monthly aggregate — 2024")
        .maybeSingle();

      if (existingExp) {
        console.log(`  ↩ Expense ${row.month}: already exists`);
      } else {
        const { error } = await admin.from("farm_expenses").insert({
          farm_id: farmId,
          date: deliveryDate,
          amount: row.expenses,
          category: "Operations",
          description: "Historical monthly aggregate — 2024",
        });
        if (error) {
          console.error(`  ✗ Expense ${row.month}:`, error.message);
        } else {
          console.log(`  ✓ Expense ${row.month}: $${row.expenses}`);
          expensesInserted++;
        }
      }
    }
  }

  console.log(`\n✅ Done: ${deliveriesInserted} deliveries, ${expensesInserted} expenses imported`);
  console.log("\n2024 Summary:");
  const totalRevenue = MONTHLY_2024.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = MONTHLY_2024.reduce((s, r) => s + r.expenses, 0);
  console.log(`  Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`  Expenses: $${totalExpenses.toFixed(2)}`);
  console.log(`  Net: $${(totalRevenue - totalExpenses).toFixed(2)}`);
}

main().catch(console.error);
