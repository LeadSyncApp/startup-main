import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { Toggle } from "../../components/ui/Toggle";
import { api } from "../../lib/api";

interface Preferences {
  ORDER: boolean;
  MESSAGE: boolean;
  ALERT: boolean;
  SYSTEM: boolean;
}

const TOGGLES: { key: keyof Preferences; label: string }[] = [
  { key: "ORDER", label: "Order updates" },
  { key: "MESSAGE", label: "Customer messages & handoffs" },
  { key: "ALERT", label: "Alerts (low stock, payments, unanswered-message reminders)" },
  { key: "SYSTEM", label: "Team & account changes" },
];

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get("/notifications/preferences").then((data: Preferences) => {
      setPrefs(data);
    }).catch(() => {
      toast.error("Failed to load notification preferences");
    });
  }, []);

  const handleToggle = useCallback(async (key: keyof Preferences, value: boolean) => {
    if (!prefs) return;

    // Optimistic update
    setPrefs({ ...prefs, [key]: value });
    setSaving(key);

    try {
      await api.patch("/notifications/preferences", { [key]: value });
      toast.success("Preference saved");
    } catch {
      // Revert on failure
      setPrefs({ ...prefs, [key]: !value });
      toast.error("Failed to save preference");
    } finally {
      setSaving(null);
    }
  }, [prefs]);

  if (!prefs) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center justify-between py-3 animate-pulse">
            <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--app-border)" }} />
            <div className="h-6 w-11 rounded-full" style={{ backgroundColor: "var(--app-border)" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm mb-4" style={{ color: "var(--app-text-muted)" }}>
        Choose which notifications you receive. Changes take effect immediately.
      </p>
      <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
        {TOGGLES.map(({ key, label }) => (
          <Toggle
            key={key}
            label={label}
            checked={prefs[key]}
            onChange={(val) => handleToggle(key, val)}
            disabled={saving === key}
          />
        ))}
      </div>
    </div>
  );
}
