"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROWING_MEDIA } from "@/lib/microgreens/constants";
import { YIELD_UNITS, YIELD_UNIT_LABELS, type YieldUnit } from "@/lib/microgreens/types";
import type { MicrogreenCrop } from "@/types/database";

type Props = {
  initial?: Partial<MicrogreenCrop>;
  items: Array<{ id: string; name: string }>;
};

export function CropForm({ initial, items }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const isEdit = !!initial?.id;

  const [form, setForm] = useState<any>({
    name: initial?.name ?? "",
    variety: initial?.variety ?? "",
    item_id: initial?.item_id ?? "",
    seed_density_g_per_tray: initial?.seed_density_g_per_tray ?? 20,
    presoak_hours: initial?.presoak_hours ?? 0,
    presprout_hours: initial?.presprout_hours ?? 0,
    bury_seed: initial?.bury_seed ?? false,
    weight_during_blackout: initial?.weight_during_blackout ?? false,
    blackout_days: initial?.blackout_days ?? 3,
    keep_in_blackout: initial?.keep_in_blackout ?? false,
    ideal_harvest_day: initial?.ideal_harvest_day ?? 10,
    harvest_min_days: initial?.harvest_min_days ?? null,
    harvest_max_days: initial?.harvest_max_days ?? null,
    expected_yield_oz_per_tray: initial?.expected_yield_oz_per_tray ?? 8,
    yield_per_tray: (initial?.yield_per_tray ?? {}) as Record<string, number>,
    is_continuous_harvest: initial?.is_continuous_harvest ?? false,
    productive_life_days: initial?.productive_life_days ?? null,
    growing_medium: initial?.growing_medium ?? ["soil"],
    preferred_medium: initial?.preferred_medium ?? "soil",
    tray_size: initial?.tray_size ?? "10x20",
    notes: initial?.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, val: any) {
    setForm((f: any) => ({ ...f, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const url = isEdit
        ? `/api/microgreens/crops/${initial!.id}`
        : "/api/microgreens/crops";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/admin/microgreens/crops");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Identity</legend>
        <label className="block">
          <span className="block text-sm">Name</span>
          <input className="input w-full" value={form.name}
            onChange={(e) => update("name", e.target.value)} required />
        </label>
        <label className="block">
          <span className="block text-sm">Variety (optional)</span>
          <input className="input w-full" value={form.variety}
            onChange={(e) => update("variety", e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm">Linked Item (optional)</span>
          <select className="input w-full" value={form.item_id ?? ""}
            onChange={(e) => update("item_id", e.target.value || null)}>
            <option value="">— none —</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Seed</legend>
        <label className="block">
          <span className="block text-sm">Seed density (g/tray)</span>
          <input type="number" step="0.1" className="input w-full"
            value={form.seed_density_g_per_tray}
            onChange={(e) => update("seed_density_g_per_tray", Number(e.target.value))} required />
        </label>
        <label className="block">
          <span className="block text-sm">Presoak hours</span>
          <input type="number" className="input w-full"
            value={form.presoak_hours}
            onChange={(e) => update("presoak_hours", Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="block text-sm">Presprout hours</span>
          <input type="number" className="input w-full"
            value={form.presprout_hours}
            onChange={(e) => update("presprout_hours", Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.bury_seed}
            onChange={(e) => update("bury_seed", e.target.checked)} />
          <span>Bury seed at sow</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Growth</legend>
        <label className="block">
          <span className="block text-sm">Blackout days</span>
          <input type="number" className="input w-full"
            value={form.blackout_days}
            onChange={(e) => update("blackout_days", Number(e.target.value))} required />
        </label>
        <label className="block">
          <span className="block text-sm">Ideal harvest day (total days from sow)</span>
          <input type="number" className="input w-full"
            value={form.ideal_harvest_day}
            onChange={(e) => update("ideal_harvest_day", Number(e.target.value))} required />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.weight_during_blackout}
            onChange={(e) => update("weight_during_blackout", e.target.checked)} />
          <span>Weight during blackout</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.keep_in_blackout}
            onChange={(e) => update("keep_in_blackout", e.target.checked)} />
          <span>Keep in blackout entire grow (corn/popcorn)</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Yield</legend>
        <p className="text-xs text-farm-muted leading-relaxed">
          Alternatives model: one tray yields the LG count <span className="font-medium">or</span> the SM count <span className="font-medium">or</span> the EA count, depending on packing decision. Leave any unit blank if you don't pack this crop in that size.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {YIELD_UNITS.map((u) => (
            <label key={u} className="block">
              <span className="block text-xs text-farm-muted">{YIELD_UNIT_LABELS[u]} per tray</span>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input w-full"
                value={form.yield_per_tray[u] ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = { ...form.yield_per_tray };
                  if (raw === "" || Number(raw) <= 0) {
                    delete next[u];
                  } else {
                    next[u] = Number(raw);
                  }
                  update("yield_per_tray", next);
                }}
                placeholder="—"
              />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="block text-sm text-farm-muted">
            Legacy: oz per tray (only used by old reports — not the sow planner)
          </span>
          <input type="number" step="0.1" className="input w-full"
            value={form.expected_yield_oz_per_tray}
            onChange={(e) => update("expected_yield_oz_per_tray", Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_continuous_harvest}
            onChange={(e) => update("is_continuous_harvest", e.target.checked)} />
          <span>Continuous harvest (nasturtium / wheatgrass second-cut)</span>
        </label>
        {form.is_continuous_harvest && (
          <label className="block">
            <span className="block text-sm">Productive life (days)</span>
            <input type="number" className="input w-full"
              value={form.productive_life_days ?? ""}
              onChange={(e) => update("productive_life_days", Number(e.target.value) || null)} />
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Medium</legend>
        <div className="flex gap-3">
          {GROWING_MEDIA.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox"
                checked={form.growing_medium.includes(m)}
                onChange={(e) => update("growing_medium",
                  e.target.checked
                    ? [...form.growing_medium, m]
                    : form.growing_medium.filter((x: string) => x !== m))} />
              <span className="capitalize">{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="block text-sm">Notes</span>
        <textarea className="input w-full" rows={3} value={form.notes}
          onChange={(e) => update("notes", e.target.value)} />
      </label>

      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? "Saving…" : isEdit ? "Save" : "Create crop"}
      </button>
    </form>
  );
}
