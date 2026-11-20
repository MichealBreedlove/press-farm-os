import type { MicrogreenStatus } from "@/lib/liaison/production";
import { formatDeliveryDate } from "@/lib/utils";

/**
 * "What microgreens are available" at a glance for the Farm Liaison:
 * what can be ordered now, what is ready to cut, and what is still growing.
 */
export function MicrogreensCard({
  status,
  orderable,
}: {
  status: MicrogreenStatus;
  orderable: { date: string | null; items: { name: string; limited: boolean }[] };
}) {
  const nothing = orderable.items.length === 0 && status.ready.length === 0 && status.growing.length === 0;
  return (
    <section aria-labelledby="micro-heading" className="card p-4 space-y-4">
      <h2 id="micro-heading" className="section-eyebrow text-farm-muted">Microgreens</h2>

      {nothing && <p className="text-sm text-farm-muted">No microgreen trays are growing right now.</p>}

      {orderable.items.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-farm-dark">
            On the order form{orderable.date ? ` for ${formatDeliveryDate(orderable.date)}` : ""}
          </p>
          <ul className="flex flex-wrap gap-1.5 mt-2">
            {orderable.items.map((i) => (
              <li
                key={i.name}
                className={`text-sm px-2.5 py-1 rounded-full ${i.limited ? "badge-gold" : "badge-green"}`}
              >
                {i.name}
                {i.limited ? " · limited" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status.ready.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-farm-dark">Ready to cut now</p>
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
