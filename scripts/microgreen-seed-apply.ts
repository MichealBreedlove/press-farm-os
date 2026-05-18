// Inserts SEED_CROPS into microgreen_crops via the admin client.
// Run once after migration 045 has been applied.

import { createClient } from "@supabase/supabase-js";
import { SEED_CROPS } from "../src/lib/microgreens/seedData";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

const sb = createClient(url, serviceKey);

async function main() {
  const { data: farms, error: ferr } = await sb.from("farms").select("id").limit(1);
  if (ferr || !farms?.length) throw new Error("No farm found");
  const farmId = farms[0].id;

  const rows = SEED_CROPS.map(({ _review, ...c }) => ({ ...c, farm_id: farmId }));
  const { error } = await sb.from("microgreen_crops").insert(rows);
  if (error) {
    console.error("Insert failed:", error);
    process.exit(1);
  }
  console.log(`Inserted ${rows.length} microgreen crops.`);
}

main();
