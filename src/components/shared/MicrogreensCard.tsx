import type { MicrogreenStatus } from "@/lib/liaison/production";
import { formatDeliveryDate } from "@/lib/utils";

/**
 * "What microgreens are available" at a glance for the Farm Liaison: trays
 * that are ready to pick and trays still growing.
 *
 * Microgreens are SELF-HARVEST — the kitchen picks them itself, nobody
 * orders them (Micheal 2026-11-21). They sit on the availability list only
 * so the farm can track their value, so this card deliberately says nothing
 * about the order form.
 */
export function MicrogreensCard({ status }: { status: MicrogreenStatus }) {
  const nothing = status.ready.length === 0 && status.growing.length === 0;
  return (
    <section aria-labelledby="micro-heading" className="card p-4 space-y-4">
      <div>
        <h2 id="micro-heading" className="section-eyebrow text-farm-muted">Microgreens</h2>
        <p className="text-xs text-farm-muted mt-1">Self-harvest — the kitchen picks these, no order needed.</p>
      </div>

      {nothing && <p className="text-sm text-farm-muted">No microgreen trays are growing right now.</p>}

      {status.ready.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-farm-dark">Ready to pick now</p>
          <ul className="mt-1.5 divide-y divide-farm-dark/5">
            {status.ready.map((r) => (
              <li key={r.crop} className="py-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-farm-dark">{r.crop}</span>
                <span className="text-farm-muted tabular-nums">
                  {r.trays} {r.trays === 1 ? "tray" : "trays"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status.growing.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-farm-dark">Growing — ready soon</p>
          <ul className="mt-1.5 divide-y divide-farm-dark/5">
            {status.growing.map((g) => (
              <li key={g.crop} className="py-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-farm-dark">{g.crop}</span>
                <span className="text-farm-muted tabular-nums text-right">
                  {g.trays} {g.trays === 1 ? "tray" : "trays"}
                  {g.readyOn ? ` · about ${formatDeliveryDate(g.readyOn)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
