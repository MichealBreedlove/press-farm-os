"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Check } from "lucide-react";

const EMAIL_FIELDS = [
  {
    key: "email_labor_report",
    label: "Weekly Timesheet Report",
    description: "Supervisor who receives the weekly labor timesheet (sent Saturdays)",
    placeholder: "supervisor@pressnapavalley.com",
  },
  {
    key: "email_availability_updates",
    label: "Availability Updates",
    description: "Receives availability and offer sheet update emails",
    placeholder: "kitchen@example.com",
  },
  {
    key: "email_order_notifications",
    label: "Order Notifications",
    description: "Receives notifications when chefs submit orders",
    placeholder: "orders@pressfarm.app",
  },
  {
    key: "email_admin",
    label: "Admin Email",
    description: "Primary admin email for the farm",
    placeholder: "micheal@pressfarm.app",
  },
];

export function EmailSettingsClient({ settings, farmId }: { settings: Record<string, string>; farmId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of EMAIL_FIELDS) init[f.key] = settings[f.key] ?? "";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farm_id: farmId, settings: form }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Email Addresses</h2>
            <p className="text-xs text-gray-400">Configure where different types of emails are sent</p>
          </div>
        </div>

        <div className="space-y-4">
          {EMAIL_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-farm-dark mb-0.5">{field.label}</label>
              <p className="text-xs text-gray-400 mb-1.5">{field.description}</p>
              <input
                type="email"
                value={form[field.key]}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="input-field"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saved ? (
          <><Check className="w-4 h-4" /> Saved</>
        ) : saving ? (
          "Saving..."
        ) : (
          <><Save className="w-4 h-4" /> Save Email Settings</>
        )}
      </button>
    </div>
  );
}
