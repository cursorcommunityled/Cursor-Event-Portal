"use client";

import { useState, useEffect, useTransition } from "react";
import { Mail, Smartphone } from "lucide-react";
import { getMyPreferences, updateMyPreferences } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { NotificationPreferences } from "@/types";

interface Row {
  label: string;
  description: string;
  inappKey: keyof NotificationPreferences;
  emailKey:  keyof NotificationPreferences;
}

const ROWS: Row[] = [
  {
    label: "Poll Opened",
    description: "When a new live poll starts",
    inappKey: "poll_opened_inapp",
    emailKey:  "poll_opened_email",
  },
  {
    label: "Table Assigned",
    description: "When your seat or table is set",
    inappKey: "table_assigned_inapp",
    emailKey:  "table_assigned_email",
  },
  {
    label: "Demo Slot Available",
    description: "When demo sign-ups open",
    inappKey: "demo_slot_inapp",
    emailKey:  "demo_slot_email",
  },
  {
    label: "Survey Live",
    description: "When a new survey is published",
    inappKey: "survey_live_inapp",
    emailKey:  "survey_live_email",
  },
  {
    label: "Broadcasts",
    description: "Admin announcements & messages",
    inappKey: "announcements_inapp",
    emailKey:  "announcements_email",
  },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative w-10 h-5 rounded-full transition-all duration-200 shrink-0",
        checked ? "bg-white" : "bg-white/10",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-200",
          checked ? "bg-black translate-x-5" : "bg-gray-500 translate-x-0"
        )}
      />
    </button>
  );
}

interface NotificationPreferencesProps {
  userId: string;
  eventId: string;
  hasEmail: boolean;
}

export function NotificationPreferencesPanel({ userId, eventId, hasEmail }: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMyPreferences(userId, eventId).then(setPrefs);
  }, [userId, eventId]);

  const toggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;

    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaved(false);

    startTransition(async () => {
      await updateMyPreferences(userId, eventId, { [key]: !prefs[key] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (!prefs) {
    return (
      <div className="glass rounded-[40px] p-8 animate-pulse">
        <div className="h-4 w-32 bg-white/5 rounded-full mb-6" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center py-4 border-b border-white/[0.03]">
            <div className="h-3 w-40 bg-white/5 rounded-full" />
            <div className="flex gap-6">
              <div className="w-10 h-5 bg-white/5 rounded-full" />
              <div className="w-10 h-5 bg-white/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass rounded-[40px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">
          Notification Preferences
        </p>
        {saved && (
          <span className="text-[9px] uppercase tracking-[0.2em] text-green-400">
            Saved
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-end gap-6 px-1 pb-1 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-gray-700 font-medium">
          <Smartphone className="w-3 h-3" />
          In-App
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-medium",
          hasEmail ? "text-gray-700" : "text-gray-800"
        )}>
          <Mail className="w-3 h-3" />
          Email
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-0"
          >
            <div>
              <p className="text-sm text-white font-light">{row.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{row.description}</p>
            </div>
            <div className="flex items-center gap-6">
              <Toggle
                checked={prefs[row.inappKey] as boolean}
                onChange={() => toggle(row.inappKey)}
                disabled={isPending}
              />
              <Toggle
                checked={prefs[row.emailKey] as boolean}
                onChange={() => toggle(row.emailKey)}
                disabled={isPending || !hasEmail}
              />
            </div>
          </div>
        ))}
      </div>

      {!hasEmail && (
        <p className="text-[10px] text-gray-700 text-center">
          Email notifications require an email address on your account.
        </p>
      )}
    </div>
  );
}
