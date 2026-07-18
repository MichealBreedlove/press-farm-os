"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { HarvestGrid } from "@/app/admin/orders/[date]/HarvestGrid";
import type { HarvestGridCategory, HarvestGridContainer } from "@/lib/harvest";
import {
  HARVEST_STRINGS,
  formatHarvestDate,
  formatHarvestDateShort,
  type HarvestLang,
} from "@/lib/i18n/harvest";

export interface HarvestExtra {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
}

interface CatalogItem {
  id: string;
  name: string;
  unit_type: string; // comma-separated unit codes
}

interface Props {
  date: string;
  dates: string[];
  /** Restaurants with orders this date; orderId targets the extras API. */
  restaurants: { id: string; name: string; orderId: string | null }[];
  categories: HarvestGridCategory[];
  containers: HarvestGridContainer[];
  itemCount: number;
  extrasByRestaurant: Record<string, HarvestExtra[]>;
  catalog: CatalogItem[];
}

const LANG_KEY = "pf-harvest-lang";

/**
 * Harvester portal client shell — holds the EN/ES language state (persisted
 * per device in localStorage; defaults to Spanish since the crew this portal
 * was built for works in Spanish) and renders the pick list + extras flow.
 */
export function HarvestClient({
  date,
  dates,
  restaurants,
  categories,
  containers,
  itemCount,
  extrasByRestaurant,
  catalog,
}: Props) {
  const [lang, setLang] = useState<HarvestLang>("es");
  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "es") setLang(stored);
  }, []);
  function pickLang(next: HarvestLang) {
    setLang(next);
    window.localStorage.setItem(LANG_KEY, next);
  }

  const t = HARVEST_STRINGS[lang];

  // Re-label containers + categories for the active language. The server
  // sends English labels (shared with the admin page); Spanish re-derives
  // from the unit / category keys.
  const localizedContainers: HarvestGridContainer[] = containers.map((c) => ({
    ...c,
    label: t.containerLabels[c.unit] ?? c.label,
  }));

  const orderable = restaurants.filter((r) => r.orderId);

  return (
    <main className="pb-10">
      <header className="page-header sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">{t.harvestList}</h1>
          <div className="flex rounded-lg overflow-hidden border border-white/25" role="group" aria-label={t.language}>
            {(["en", "es"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => pickLang(code)}
                className={cn(
                  "min-h-[44px] min-w-[52px] px-3 text-sm font-bold uppercase tracking-wide transition-colors",
                  lang === code ? "bg-white text-farm-green" : "text-white/80 hover:text-white",
                )}
                aria-pressed={lang === code}
              >
                {code === "en" ? "EN" : "ES"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-3xl mx-auto space-y-6">
        {/* Date picker — pill per nearby delivery date */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-farm-muted mb-2">
            {t.forDate} <span className="text-farm-dark normal-case">{formatHarvestDate(date, lang)}</span>
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {dates.map((d) => (
              <Link
                key={d}
                href={`/harvest?date=${d}`}
                className={cn(
                  "flex-shrink-0 min-h-[44px] px-4 rounded-xl border text-sm font-medium flex items-center capitalize transition-colors",
                  d === date
                    ? "bg-farm-green text-white border-farm-green shadow-sm"
                    : "bg-white text-farm-dark/80 border-farm-dark/10 hover:border-farm-green/40",
                )}
              >
                {formatHarvestDateShort(d, lang)}
              </Link>
            ))}
          </div>
        </div>

        {itemCount === 0 ? (
          <div className="text-center py-12">
            <img src="/assets/pressfarm/flowers/pea-flower.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
            <h2 className="text-base font-semibold text-farm-dark">{t.noOrders}</h2>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">{t.noOrdersHint}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-farm-muted">
              <span className="font-bold text-farm-dark">{itemCount}</span> {t.itemsToPick}
              {" · "}
              <span className="font-bold text-farm-dark">{orderable.length}</span> {t.restaurantsOrdering}
            </p>

            <HarvestGrid
              restaurants={restaurants}
              categories={categories}
              containers={localizedContainers}
              labels={{
                containersNeeded: t.containersNeeded,
                item: t.item,
                container: t.container,
                total: t.total,
                categoryLabels: t.categoryLabels,
              }}
            />
          </>
        )}

        {/* Extras — the "add more" half of the portal */}
        {orderable.length > 0 && (
          <section className="card p-4 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted">
                {t.extrasHeading}
              </h2>
              <p className="text-xs text-farm-muted/90 mt-1 leading-relaxed">{t.extrasHint}</p>
            </div>

            {orderable.map((r) => (
              <ExtrasForRestaurant
                key={r.id}
                restaurant={r}
                extras={extrasByRestaurant[r.id] ?? []}
                catalog={catalog}
                lang={lang}
              />
            ))}
          </section>
        )}

        <HarvestSignOut lang={lang} />
      </div>
    </main>
  );
}

/** One restaurant's extras: existing bonus lines + the add form. */
function ExtrasForRestaurant({
  restaurant,
  extras,
  catalog,
  lang,
}: {
  restaurant: { id: string; name: string; orderId: string | null };
  extras: HarvestExtra[];
  catalog: CatalogItem[];
  lang: HarvestLang;
}) {
  const t = HARVEST_STRINGS[lang];
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(lineId: string) {
    if (!restaurant.orderId) return;
    setRemovingId(lineId);
    try {
      const res = await fetch(`/api/orders/${restaurant.orderId}/extras?lineId=${lineId}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="border border-farm-dark/10 rounded-xl p-3 space-y-2">
      <p className="text-sm font-semibold text-farm-dark">{restaurant.name}</p>

      {extras.length === 0 ? (
        <p className="text-xs text-farm-muted">{t.noExtrasYet}</p>
      ) : (
        <ul className="divide-y divide-farm-dark/5">
          {extras.map((ex) => (
            <li key={ex.id} className="py-2 flex items-center justify-between gap-2">
              <span className="text-sm text-farm-dark min-w-0 truncate">
                {ex.itemName}
                <span className="text-farm-muted tabular-nums"> · {ex.quantity} {ex.unit}</span>
              </span>
              {restaurant.orderId && (
                <button
                  type="button"
                  onClick={() => handleRemove(ex.id)}
                  disabled={removingId === ex.id}
                  className="flex-shrink-0 min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                >
                  {removingId === ex.id ? t.removing : t.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {restaurant.orderId && (
        <AddExtraForm orderId={restaurant.orderId} catalog={catalog} lang={lang} />
      )}
    </div>
  );
}

/**
 * Bilingual add-extra form — same flow as the admin AddExtraRow but without
 * price context, translated, and pointing at one restaurant's order.
 */
function AddExtraForm({
  orderId,
  catalog,
  lang,
}: {
  orderId: string;
  catalog: CatalogItem[];
  lang: HarvestLang;
}) {
  const t = HARVEST_STRINGS[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog.slice(0, 12);
    const q = search.toLowerCase().trim();
    return catalog.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, catalog]);

  function pick(item: CatalogItem) {
    setSelected(item);
    const firstUnit = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean)[0];
    setUnit(firstUnit ?? "ea");
    setSearch("");
  }

  function reset() {
    setSelected(null);
    setUnit("");
    setQuantity("");
    setError(null);
  }

  async function handleSubmit() {
    if (!selected) return;
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(t.qtyError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: selected.id, quantity: qty, unit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.addFailed);
      setConfirmation(`${t.added}: ${qty} ${unit.toUpperCase()} — ${selected.name}`);
      reset();
      router.refresh();
      setTimeout(() => setConfirmation(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full min-h-[44px] rounded-xl border border-dashed border-farm-green/40 text-sm font-medium text-farm-green bg-white hover:bg-farm-green/[0.04] transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          {t.addExtra}
        </button>
        {confirmation && (
          <p className="text-xs text-farm-green font-medium text-center mt-2">✓ {confirmation}</p>
        )}
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="bg-farm-green/[0.04] border border-farm-green/20 rounded-xl p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-farm-dark">{t.addingExtra}</p>
          <button
            type="button"
            onClick={() => { setOpen(false); reset(); }}
            className="text-xs text-farm-muted hover:text-farm-dark min-h-[32px]"
          >
            {t.cancel}
          </button>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchItems}
          autoFocus
          className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
        />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-farm-dark/5 bg-white divide-y divide-farm-dark/5">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-xs text-farm-muted text-center">{t.noItemsMatch}</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className="w-full px-3 py-2 text-left text-sm text-farm-dark hover:bg-farm-cream/40 min-h-[40px] flex items-center justify-between gap-2"
            >
              <span className="truncate">{item.name}</span>
              <span className="text-[10px] text-farm-muted uppercase tracking-wider flex-shrink-0">
                {item.unit_type.split(",").map((u) => u.trim().toUpperCase()).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const availableUnits = selected.unit_type.split(",").map((u) => u.trim()).filter(Boolean);

  return (
    <div className="bg-farm-green/[0.04] border border-farm-green/20 rounded-xl p-3 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-farm-green font-semibold uppercase tracking-wider">{t.adding}</p>
          <p className="text-sm font-semibold text-farm-dark mt-0.5">{selected.name}</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-farm-muted hover:text-farm-dark min-h-[32px]"
        >
          {t.change}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="block text-[10px] text-farm-muted uppercase tracking-wider mb-1">{t.qty}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-farm-muted uppercase tracking-wider mb-1">{t.unit}</label>
          <div className="flex flex-wrap gap-1">
            {availableUnits.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-0 transition-colors",
                  unit === u
                    ? "bg-farm-green text-white"
                    : "bg-white text-farm-dark/80 border border-farm-dark/10 hover:border-farm-green/30",
                )}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 min-h-[40px] rounded-lg border border-farm-dark/10 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !quantity}
          className="flex-1 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold disabled:opacity-50 hover:bg-farm-green/90"
        >
          {submitting ? t.addingBusy : t.addToDelivery}
        </button>
      </div>
    </div>
  );
}

/** Translated sign-out card (SignOutButton is English-only). */
function HarvestSignOut({ lang }: { lang: HarvestLang }) {
  const t = HARVEST_STRINGS[lang];
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <button
      onClick={handleSignOut}
      className="flex items-center justify-between w-full card-interactive px-4 py-4 text-left"
    >
      <div>
        <p className="text-sm font-semibold text-red-600">{t.signOut}</p>
        <p className="text-xs text-farm-muted mt-0.5">{t.signOutHint}</p>
      </div>
      <LogOut className="w-5 h-5 text-red-400 flex-shrink-0" />
    </button>
  );
}
