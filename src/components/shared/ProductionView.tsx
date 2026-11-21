import { MicrogreensCard } from "@/components/shared/MicrogreensCard";
import type { MicrogreenStatus, PeriodSummary, ProductionSummary } from "@/lib/liaison/production";
import { formatCurrencyWhole, formatDeliveryDate } from "@/lib/utils";

/**
 * Body of /liaison/production — period totals, by restaurant, six-month
 * trend, top items, latest drop-offs and the self-harvest microgreens on hand. Pure
 * presentation; the page loads the numbers.
 */
export function ProductionView({
  p,
  micro,
}: {
  p: ProductionSummary;
  micro: MicrogreenStatus;
}) {
  const peak = Math.max(1, ...p.months.map((m) => m.total));
  return (
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PeriodCard label="This month" period={p.thisMonth} highlight />
          <PeriodCard label="Last month" period={p.lastMonth} />
          <PeriodCard label="Year to date" period={p.yearToDate} />
        </div>

        <section aria-labelledby="by-restaurant" className="card p-4">
          <h2 id="by-restaurant" className="section-eyebrow text-farm-muted mb-2">
            This month by restaurant
          </h2>
          {p.thisMonth.byRestaurant.length === 0 ? (
            <p className="text-sm text-farm-muted">No deliveries logged yet this month.</p>
          ) : (
            <ul className="divide-y divide-farm-dark/5">
              {p.thisMonth.byRestaurant.map((r) => (
                <li key={r.name} className="py-2.5 flex items-baseline justify-between gap-3">
                  <span className="text-base text-farm-dark">{r.name}</span>
                  <span className="text-right">
                    <span className="block text-base font-semibold text-farm-dark tabular-nums">
                      {formatCurrencyWhole(r.total)}
                    </span>
                    <span className="block text-xs text-farm-muted tabular-nums">
                      {r.lines} {r.lines === 1 ? "product" : "products"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="trend" className="card p-4">
          <h2 id="trend" className="section-eyebrow text-farm-muted mb-3">Last six months</h2>
          <ul className="space-y-2">
            {p.months.map((m) => (
              <li key={m.key} className="flex items-center gap-3 text-sm">
                <span className="w-9 text-farm-muted flex-shrink-0">{m.label}</span>
                <span className="flex-1 h-3 rounded-full bg-farm-dark/5 overflow-hidden" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-farm-green"
                    style={{ width: `${Math.round((m.total / peak) * 100)}%` }}
                  />
                </span>
                <span className="w-20 text-right font-medium text-farm-dark tabular-nums flex-shrink-0">
                  {formatCurrencyWhole(m.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="top-items" className="card p-4">
          <h2 id="top-items" className="section-eyebrow text-farm-muted mb-2">
            Most delivered — last 30 days
          </h2>
          {p.topItems.length === 0 ? (
            <p className="text-sm text-farm-muted">Nothing delivered in the last 30 days.</p>
          ) : (
            <ul className="divide-y divide-farm-dark/5">
              {p.topItems.map((i) => (
                <li key={i.name} className="py-2.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base text-farm-dark truncate">{i.name}</span>
                    <span className="block text-xs text-farm-muted">{i.quantity}</span>
                  </span>
                  <span className="text-base font-semibold text-farm-dark tabular-nums flex-shrink-0">
                    {formatCurrencyWhole(i.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent" className="card p-4">
          <h2 id="recent" className="section-eyebrow text-farm-muted mb-2">Latest deliveries</h2>
          {p.recent.length === 0 ? (
            <p className="text-sm text-farm-muted">No deliveries logged yet.</p>
          ) : (
            <ul className="divide-y divide-farm-dark/5">
              {p.recent.map((d, i) => (
                <li key={i} className="py-2.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base text-farm-dark">{formatDeliveryDate(d.date)}</span>
                    <span className="block text-xs text-farm-muted">
                      {d.restaurant} · {d.lines} {d.lines === 1 ? "product" : "products"}
                    </span>
                  </span>
                  <span className="text-base font-semibold text-farm-dark tabular-nums flex-shrink-0">
                    {formatCurrencyWhole(d.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <MicrogreensCard status={micro} />
      </div>
  );
}

function PeriodCard({
  label,
  period,
  highlight = false,
}: {
  label: string;
  period: PeriodSummary;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "border-farm-green/40" : ""}`}>
      <p className="section-eyebrow text-farm-muted">{label}</p>
      <p className="font-display text-3xl text-farm-dark mt-1 tabular-nums">{formatCurrencyWhole(period.total)}</p>
      <p className="text-xs text-farm-muted mt-1">
        {period.lines} {period.lines === 1 ? "product" : "products"} · {period.deliveries}{" "}
        {period.deliveries === 1 ? "delivery" : "deliveries"}
      </p>
    </div>
  );
}
