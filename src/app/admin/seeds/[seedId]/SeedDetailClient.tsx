"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SeedForm } from "@/components/admin/seeds/SeedForm";
import { LogSowingModal } from "@/components/admin/seeds/LogSowingModal";
import { LogGermTestModal } from "@/components/admin/seeds/LogGermTestModal";
import { SEED_STATUS_LABELS, type SeedStatus } from "@/lib/constants";
import type { SeedWithItem, SeedSowingWithPlanting, SeedGerminationTestRow } from "@/types";

interface PlantingOption {
  id: string;
  crop_name: string;
  variety: string | null;
  sow_date: string | null;
  item_id: string | null;
  status: string;
}

interface Props {
  seed: SeedWithItem;
  sowings: SeedSowingWithPlanting[];
  germTests: SeedGerminationTestRow[];
  items: { id: string; name: string; category: string }[];
  plantings: PlantingOption[];
}

const CURRENT_YEAR = new Date().getFullYear();

function formatQty(n: number, unit: string) {
  const rounded = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${unit}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SeedDetailClient({ seed, sowings, germTests, items, plantings }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sowingOpen, setSowingOpen] = useState(false);
  const [germTestOpen, setGermTestOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const onHand = seed.on_hand ?? 0;
  const hasSowings = sowings.length > 0;
  const exhausted = seed.status === "exhausted" || seed.status === "discarded";
  const age = seed.packed_for_year != null ? CURRENT_YEAR - seed.packed_for_year : null;

  function deleteSowing(id: string) {
    if (!confirm("Delete this sowing record? On-hand quantity will be recomputed.")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/seeds/${seed.id}/sowings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  function deleteGermTest(id: string) {
    if (!confirm("Delete this germination test record?")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/seeds/${seed.id}/germ-tests/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  function deleteSeed() {
    if (!confirm("Delete this seed entry? This only works if no sowings have been logged.")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/seeds/${seed.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      router.push("/admin/seeds");
    });
  }

  function discardSeed() {
    if (!confirm("Mark this seed as discarded? History stays intact and it stops showing in the active list.")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/seeds/${seed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "discarded" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Update failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </p>
      )}

      {/* On-hand summary card */}
      <section className="bg-white border border-farm-dark/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-wider uppercase text-farm-muted">On hand</p>
            <p className={`text-3xl font-bold mt-1 ${exhausted ? "text-farm-muted" : "text-farm-green"}`}>
              {formatQty(onHand, seed.quantity_unit)}
            </p>
            <p className="text-xs text-farm-muted mt-1">
              of {formatQty(seed.initial_quantity, seed.quantity_unit)} initial
            </p>
          </div>
          <div className="text-right space-y-1">
            <StatusBadge status={seed.status} isLow={seed.is_low} />
            {age != null && age >= 1 && (
              <p className={`text-[10px] font-medium tracking-wide ${age >= 2 ? "text-red-700" : "text-amber-800"}`}>
                {age === 1 ? "Last year's seed" : `${age} years old`}
              </p>
            )}
            {seed.latest_germ_pct != null && (
              <p className="text-[11px] text-blue-700">
                Germ {Number(seed.latest_germ_pct).toFixed(0)}% ({formatDate(seed.latest_germ_tested_on)})
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setSowingOpen(true)}
            disabled={pending || onHand <= 0}
            className="px-3 py-3 rounded-lg bg-farm-green text-white text-sm font-medium min-h-[44px] disabled:opacity-50"
          >
            Log sowing
          </button>
          <button
            type="button"
            onClick={() => setGermTestOpen(true)}
            disabled={pending}
            className="px-3 py-3 rounded-lg border border-farm-green text-farm-green text-sm font-medium min-h-[44px]"
          >
            Log germ test
          </button>
        </div>
      </section>

      {/* Edit form — collapsible */}
      <section className="bg-white border border-farm-dark/10 rounded-2xl">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-[10px] tracking-wider uppercase text-farm-muted">Details</p>
            <p className="text-sm font-medium text-farm-dark mt-0.5">
              {editing ? "Editing fields" : "View / edit fields"}
            </p>
          </div>
          <span className="text-farm-muted text-lg">{editing ? "−" : "+"}</span>
        </button>
        {!editing ? (
          <dl className="px-5 pb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="Crop" value={seed.item?.name ?? "—"} />
            <Detail label="Category" value={seed.item?.category ?? "—"} />
            <Detail label="Variety" value={seed.variety} />
            <Detail label="Packed for" value={seed.packed_for_year ? String(seed.packed_for_year) : "—"} />
            <Detail label="Purchased" value={formatDate(seed.purchase_date)} />
            <Detail label="Supplier" value={seed.supplier ?? "—"} />
            <Detail label="Cost" value={seed.cost != null ? `$${Number(seed.cost).toFixed(2)}` : "—"} />
            <Detail label="Status" value={SEED_STATUS_LABELS[seed.status]} />
            {seed.notes && (
              <div className="col-span-2 pt-1">
                <p className="text-[10px] tracking-wider uppercase text-farm-muted mb-1">Notes</p>
                <p className="text-sm text-farm-dark whitespace-pre-wrap">{seed.notes}</p>
              </div>
            )}
          </dl>
        ) : (
          <div className="px-5 pb-5">
            <SeedForm
              mode="edit"
              seedId={seed.id}
              items={items}
              initial={{
                item_id: seed.item_id,
                variety: seed.variety,
                initial_quantity: seed.initial_quantity,
                quantity_unit: seed.quantity_unit,
                packed_for_year: seed.packed_for_year,
                purchase_date: seed.purchase_date,
                supplier: seed.supplier,
                cost: seed.cost,
                status: seed.status as SeedStatus,
                notes: seed.notes,
              }}
            />
          </div>
        )}
      </section>

      {/* Sowing history */}
      <section className="space-y-2">
        <h2 className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold font-medium px-1">
          Sowing log {sowings.length > 0 ? `(${sowings.length})` : ""}
        </h2>
        {sowings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-farm-muted text-center bg-white border border-farm-dark/10 rounded-xl">
            No sowings logged yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sowings.map((sw) => (
              <li key={sw.id} className="bg-white border border-farm-dark/10 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-dark">
                      {formatQty(sw.amount_used, seed.quantity_unit)}{" "}
                      <span className="text-farm-muted font-normal">on {formatDate(sw.sown_on)}</span>
                    </p>
                    {sw.planting && (
                      // No per-planting detail route exists — link to the
                      // crop-plan timeline where the planting lives.
                      <Link
                        href="/admin/crop-plan"
                        className="inline-flex text-xs text-farm-green hover:underline mt-0.5"
                      >
                        ↳ {sw.planting.crop_name}
                        {sw.planting.variety ? ` (${sw.planting.variety})` : ""}
                      </Link>
                    )}
                    {sw.notes && (
                      <p className="text-xs text-farm-muted mt-1 whitespace-pre-wrap">{sw.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSowing(sw.id)}
                    disabled={pending}
                    className="text-xs text-red-700 hover:underline disabled:opacity-50 min-h-[32px] px-2"
                    aria-label="Delete sowing"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Germination test history */}
      <section className="space-y-2">
        <h2 className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold font-medium px-1">
          Germination tests {germTests.length > 0 ? `(${germTests.length})` : ""}
        </h2>
        {germTests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-farm-muted text-center bg-white border border-farm-dark/10 rounded-xl">
            No germination tests recorded.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {germTests.map((gt) => (
              <li key={gt.id} className="bg-white border border-farm-dark/10 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-dark">
                      {Number(gt.germination_pct).toFixed(0)}% germination
                      <span className="text-farm-muted font-normal">
                        {" "}on {formatDate(gt.tested_on)}
                      </span>
                    </p>
                    {gt.seeds_tested != null && (
                      <p className="text-xs text-farm-muted mt-0.5">
                        {gt.seeds_tested} seeds tested
                      </p>
                    )}
                    {gt.notes && (
                      <p className="text-xs text-farm-muted mt-1 whitespace-pre-wrap">{gt.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteGermTest(gt.id)}
                    disabled={pending}
                    className="text-xs text-red-700 hover:underline disabled:opacity-50 min-h-[32px] px-2"
                    aria-label="Delete germination test"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="pt-4 border-t border-farm-dark/10">
        {hasSowings ? (
          <button
            type="button"
            onClick={discardSeed}
            disabled={pending || seed.status === "discarded"}
            className="w-full px-4 py-3 rounded-lg border border-red-200 text-red-700 text-sm min-h-[44px] disabled:opacity-50"
          >
            {seed.status === "discarded" ? "Already discarded" : "Discard this seed"}
          </button>
        ) : (
          <button
            type="button"
            onClick={deleteSeed}
            disabled={pending}
            className="w-full px-4 py-3 rounded-lg border border-red-200 text-red-700 text-sm min-h-[44px] disabled:opacity-50"
          >
            Delete this seed entry
          </button>
        )}
      </section>

      {/* Modals */}
      {sowingOpen && (
        <LogSowingModal
          seedId={seed.id}
          itemId={seed.item_id}
          quantityUnit={seed.quantity_unit}
          onHand={onHand}
          plantings={plantings}
          onClose={() => setSowingOpen(false)}
          onSuccess={() => {
            setSowingOpen(false);
            router.refresh();
          }}
        />
      )}
      {germTestOpen && (
        <LogGermTestModal
          seedId={seed.id}
          onClose={() => setGermTestOpen(false)}
          onSuccess={() => {
            setGermTestOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider uppercase text-farm-muted">{label}</p>
      <p className="text-sm text-farm-dark mt-0.5">{value}</p>
    </div>
  );
}

function StatusBadge({ status, isLow }: { status: SeedStatus; isLow: boolean }) {
  if (status === "exhausted") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
        Exhausted
      </span>
    );
  }
  if (status === "discarded") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
        Discarded
      </span>
    );
  }
  if (isLow) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200">
      Active
    </span>
  );
}
