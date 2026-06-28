"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Box = {
  id?: string;
  name?: string;
  location?: string | null;
  size?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export function BoxForm({ initial }: { initial?: Box }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial?.id;

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    location: initial?.location ?? "",
    size: initial?.size ?? "",
    notes: initial?.notes ?? "",
    is_active: initial?.is_active ?? true,
  });

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const url = isEdit ? `/api/planter-boxes/${initial!.id}` : "/api/planter-boxes";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(isEdit ? `/admin/planter-boxes/${initial!.id}` : `/admin/planter-boxes/${json.box.id}`);
        router.refresh();
      } else {
        setError((await res.json()).error ?? "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <label className="block">
        <span className="block text-sm">Box name</span>
        <input className="input-field" value={form.name} required
          onChange={(e) => update("name", e.target.value)} placeholder="e.g. North bed #3" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm">Location</span>
          <input className="input-field" value={form.location}
            onChange={(e) => update("location", e.target.value)} placeholder="greenhouse / field" />
        </label>
        <label className="block">
          <span className="block text-sm">Size</span>
          <input className="input-field" value={form.size}
            onChange={(e) => update("size", e.target.value)} placeholder="4×8 ft" />
        </label>
      </div>
      <label className="block">
        <span className="block text-sm">Notes</span>
        <textarea className="input-field" rows={3} value={form.notes}
          onChange={(e) => update("notes", e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_active}
          onChange={(e) => update("is_active", e.target.checked)} />
        <span>Active</span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? "Saving…" : isEdit ? "Save box" : "Create box"}
      </button>
    </form>
  );
}
