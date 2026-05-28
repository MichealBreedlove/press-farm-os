import { cn } from "@/lib/utils";
import { HARVEST_STAGE_LABELS } from "@/lib/microgreens/constants";
import type { MicrogreenTrayStatus, MicrogreenCrop } from "@/types/database";

const STAGES: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

function stageLabel(stage: MicrogreenTrayStatus, crop: MicrogreenCrop): string {
  if (stage === "harvesting") return `Harvest (${HARVEST_STAGE_LABELS[crop.harvest_stage]})`;
  const base: Record<MicrogreenTrayStatus, string> = {
    soaking: "Soak", blackout: "Blackout", light: "Light",
    harvesting: "Harvest", terminated: "Done", lost: "Lost",
  };
  return base[stage];
}

export function StageTimeline({
  current,
  crop,
}: {
  current: MicrogreenTrayStatus;
  crop: MicrogreenCrop;
}) {
  const visible = STAGES.filter((s) =>
    !(s === "soaking" && crop.presoak_hours === 0 && crop.presprout_hours === 0)
  ).filter((s) =>
    !(s === "light" && crop.keep_in_blackout)
  );
  const currentIdx = visible.indexOf(current);

  return (
    <div className="flex items-center gap-1 text-xs">
      {visible.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "px-2 py-0.5 rounded-full whitespace-nowrap",
              i < currentIdx && "bg-farm-green/15 text-farm-green",
              i === currentIdx && "bg-farm-green text-white font-medium",
              i > currentIdx && "bg-farm-muted/15 text-farm-muted",
            )}
          >
            {stageLabel(s, crop)}
          </div>
          {i < visible.length - 1 && <span className="text-farm-muted">→</span>}
        </div>
      ))}
    </div>
  );
}
