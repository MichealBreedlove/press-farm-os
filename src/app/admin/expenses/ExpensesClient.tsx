"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  vendor: string | null;
}

interface Props {
  month: string;
  expenses: Expense[];
  totalByCategory: Record<string, number>;
  grandTotal: number;
}

export function ExpensesClient({ month, expenses, totalByCategory, grandTotal }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: `${month}-01`,
    category: EXPENSE_CATEGORIES[0] as string,
    description: "",
    vendor: "",
    amount: "",
  });

  // Known vendors for autocomplete
  const knownVendors = Array.from(new Set(expenses.map((e) => e.vendor).filter(Boolean))) as string[];

  function resetForm() {
    setForm({ date: `${month}-01`, category: EXPENSE_CATEGORIES[0], description: "", vendor: "", amount: "" });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(exp: Expense) {
    setForm({
      date: exp.date,
      category: exp.category,
      description: exp.description ?? "",
      vendor: exp.vendor ?? "",
      amount: String(exp.amount),
    });
    setEditingId(exp.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        date: form.date,
        category: form.category,
        description: form.description || null,
        vendor: form.vendor || null,
        amount: parseFloat(form.amount),
      };

      const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to save");
      }
      resetForm();
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const categoriesWithData = EXPENSE_CATEGORIES.filter((c) => totalByCategory[c]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {categoriesWithData.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {categoriesWithData.map((cat) => (
            <div key={cat} className="card p-3">
              <p className="text-xs text-gray-500">{cat}</p>
              <p className="text-base font-semibold text-gray-900 mt-0.5">
                ${totalByCategory[cat].toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex justify-between items-center">
        <span className="text-sm font-medium text-orange-800">Total Expenses</span>
        <span className="text-lg font-bold text-orange-900">${grandTotal.toFixed(2)}</span>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm text-farm-dark">
              {editingId ? "Edit Expense" : "New Expense"}
            </h3>
            <button type="button" onClick={resetForm} className="text-gray-400 min-h-0 min-w-0 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" required value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
              <input type="number" required min="0.01" step="0.01" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input-field">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
              <input type="text" value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                placeholder="e.g. Amazon, Home Depot"
                list="vendor-suggestions"
                className="input-field" />
              <datalist id="vendor-suggestions">
                {knownVendors.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input type="text" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What was purchased..."
              className="input-field" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : editingId ? "Update Expense" : "Save Expense"}
          </button>
        </form>
      )}

      {/* Expense list */}
      <div className="space-y-2">
        {expenses.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No expenses logged for this month.</p>
        )}
        {expenses.map((exp) => (
          <div key={exp.id} className="card px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-gray">{exp.category}</span>
                  {exp.vendor && <span className="text-xs text-blue-600 font-medium">{exp.vendor}</span>}
                  <span className="text-xs text-gray-400">
                    {new Date(exp.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                {exp.description && (
                  <p className="text-sm text-gray-700 mt-1 truncate">{exp.description}</p>
                )}
                <p className="text-base font-semibold text-gray-900 mt-1">${exp.amount.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(exp)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-farm-green transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(exp.id)}
                  disabled={deleting === exp.id}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                >
                  {deleting === exp.id ? <span className="text-xs">...</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
