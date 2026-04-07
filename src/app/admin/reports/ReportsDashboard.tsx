"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type MonthlyPoint = {
  month: string;
  label: string;
  total_value: number;
  total_expenses: number;
  net_value: number;
  by_restaurant: Record<string, number>;
};

type TopItem = {
  item_id: string;
  name: string;
  category: string;
  unit: string;
  total_value: number;
  total_qty: number;
};

export default function ReportsDashboard({
  currentMonth,
  currentData,
  ytdValue,
  ytdExpenses,
  monthlyData,
  topItems,
  expenseBreakdown,
}: {
  currentMonth: string;
  currentData: { total_value: number; total_expenses: number; net_value: number; by_restaurant: Record<string, number> };
  ytdValue: number;
  ytdExpenses: number;
  monthlyData: MonthlyPoint[];
  topItems: TopItem[];
  expenseBreakdown: Record<string, number>;
}) {
  const restaurantNames = Array.from(
    new Set(monthlyData.flatMap((m) => Object.keys(m.by_restaurant)))
  );

  const COLORS = ["#00774A", "#4ade80", "#86efac"];

  // Cumulative EOM running total
  const runningData = monthlyData.map((m, i) => ({
    label: m.label,
    running: monthlyData.slice(0, i + 1).reduce((sum, x) => sum + x.total_value, 0),
  }));

  return (
    <div className="px-4 py-4 space-y-6">
      {/* MTD summary cards */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
          {monthLabel(currentMonth)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-gray-400">Delivery Value</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt(currentData.total_value)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-400">Expenses</p>
            <p className="text-xl font-bold text-red-600 mt-1">{fmt(currentData.total_expenses)}</p>
          </div>
          <div className="bg-farm-green text-white rounded-xl p-4">
            <p className="text-xs text-farm-green-light">Net Value</p>
            <p className="text-xl font-bold mt-1">{fmt(currentData.net_value)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-400">YTD Value</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt(ytdValue)}</p>
          </div>
        </div>

        {/* By restaurant */}
        {Object.keys(currentData.by_restaurant).length > 0 && (
          <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-2">By Restaurant</p>
            <div className="space-y-2">
              {Object.entries(currentData.by_restaurant).map(([name, value]) => (
                <div key={name} className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">{name}</p>
                  <p className="text-sm font-medium text-gray-900">{fmtFull(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Monthly value bar chart */}
      {monthlyData.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Monthly Delivery Value</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              {restaurantNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={`by_restaurant.${name}`}
                  name={name}
                  stackId="a"
                  fill={COLORS[i % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* YTD running total line chart */}
      {runningData.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Cumulative Value (12mo)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={runningData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Line
                type="monotone"
                dataKey="running"
                stroke="#00774A"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* YTD summary */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Year-to-Date {new Date().getFullYear()}
        </p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-sm font-semibold text-gray-900">{fmtFull(ytdValue)}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-sm font-semibold text-red-600">{fmtFull(ytdExpenses)}</p>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
            <p className="text-sm font-medium text-gray-700">Net Value</p>
            <p className="text-sm font-bold text-farm-green">{fmtFull(ytdValue - ytdExpenses)}</p>
          </div>
        </div>
      </div>

      {/* Expense breakdown */}
      {Object.keys(expenseBreakdown).length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Expenses — {monthLabel(currentMonth)}
          </p>
          <div className="space-y-2">
            {Object.entries(expenseBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex justify-between">
                  <p className="text-sm text-gray-500">{cat}</p>
                  <p className="text-sm text-gray-900">{fmtFull(amount)}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Top items */}
      {topItems.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">Top Items by Value (12mo)</p>
          </div>
          {topItems.map((item, i) => (
            <div
              key={item.item_id}
              className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0"
            >
              <p className="text-sm text-gray-400 w-6 shrink-0">{i + 1}</p>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.total_qty.toFixed(1)} {item.unit}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">{fmtFull(item.total_value)}</p>
            </div>
          ))}
        </div>
      )}

      {topItems.length === 0 && monthlyData.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">
          No delivery data yet — log deliveries to see reports
        </p>
      )}
    </div>
  );
}
