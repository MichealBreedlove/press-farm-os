import { writeFileSync } from "node:fs";
import { SEED_CROPS, reviewCandidates } from "../src/lib/microgreens/seedData";

const rows = reviewCandidates();
const header = "name,variety,blackout_days,ideal_harvest_day,notes\n";
const body = rows
  .map(
    (r) =>
      `"${r.name}","${r.variety ?? ""}",${r.blackout_days},${r.ideal_harvest_day},"${(r.notes ?? "").replace(/"/g, '""')}"`,
  )
  .join("\n");

writeFileSync("tmp_microgreen_seed_review.csv", header + body);
console.log(
  `Wrote ${rows.length} rows needing review → tmp_microgreen_seed_review.csv`,
);
console.log(`Total seed crops: ${SEED_CROPS.length}`);
