"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
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
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: `${month}-01`,
    category: EXPENSE_CATEGORIES[0] as string,
    description: "",
    amount: "",
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          category: form.category,
          description: form.description || undefined,
          amount: parseFloat(form.amount),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to save");
      }
      setForm({ date: `${month}-01`, category: EXPENSE_CATEGORIES[0], description: "", amount: "" });
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to delete");
      }
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
      <button
        onClick={() => setShowForm((v) => !v)}
        className="w-full min-h-[44px] bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 active:bg-gray-700 transition-colors"
      >
        {showForm ? "Cancel" : "+ Add Expense"}
      </button>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="card p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">New Expense</h3>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Tomato seeds from Baker Creek"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full min-h-[44px] text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Expense"}
          </button>
        </form>
      )}

      {/* Expense list */}
      <div className="space-y-2">
        {expenses.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No expenses logged for this month.</p>
        )}
        {expenses.map((exp) => (
          <div key={exp.id} className="card p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-gray">
                  {exp.category}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(exp.date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {exp.description && (
                <p className="text-sm text-gray-700 mt-1 truncate">{exp.description}</p>
              )}
              <p className="text-base font-semibold text-gray-900 mt-1">${exp.amount.toFixed(2)}</p>
            </div>
            <button
              onClick={() => handleDelete(exp.id)}
              disabled={deleting === exp.id || isPending}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-red-500 disabled:opacity-50 transition-colors"
              aria-label="Delete expense"
            >
              {deleting === exp.id ? (
                <span className="text-xs">…</span>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>

      {error && !showForm && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
