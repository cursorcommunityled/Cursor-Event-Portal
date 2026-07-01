"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { saveLumaEventId, syncLumaGuests, type LumaSyncSummary } from "@/lib/actions/luma-sync";
import { cn } from "@/lib/utils";

interface LumaSyncCardProps {
  eventId: string;
  adminCode: string;
  initialLumaEventId: string | null;
}

export function LumaSyncCard({ eventId, adminCode, initialLumaEventId }: LumaSyncCardProps) {
  const router = useRouter();
  const [lumaEventId, setLumaEventId] = useState(initialLumaEventId ?? "");
  const [savedId, setSavedId] = useState(initialLumaEventId ?? "");
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<LumaSyncSummary | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isSyncing, startSyncing] = useTransition();

  const handleSave = () => {
    startSaving(async () => {
      const res = await saveLumaEventId(eventId, lumaEventId, adminCode);
      if (res.success) {
        setSavedId(lumaEventId.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const handleSync = () => {
    setResult(null);
    startSyncing(async () => {
      const summary = await syncLumaGuests(eventId, adminCode);
      setResult(summary);
      router.refresh();
    });
  };

  return (
    <div className="glass rounded-[28px] p-6 border border-white/[0.04]">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-1">
            Luma Event ID
          </p>
          <p className="text-[9px] text-gray-700">
            From the Luma API / event URL — starts with evt-
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={lumaEventId}
            onChange={(e) => setLumaEventId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="evt-..."
            className="w-44 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 transition-all placeholder:text-gray-700"
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "h-10 px-5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-1.5",
              saved
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
            )}
          >
            {saved ? <><Check className="w-3 h-3" /> Saved</> : "Save"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
        <p className="text-[9px] text-gray-700 flex-1">
          Pulls the guest list from Luma: checks in scanned guests and assigns
          their Cursor credits. Live check-ins also stream in automatically via
          webhook.
        </p>
        <button
          onClick={handleSync}
          disabled={isSyncing || !savedId}
          className={cn(
            "h-10 px-6 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-2",
            !savedId
              ? "bg-white/[0.03] text-gray-700 border border-white/[0.06] cursor-not-allowed"
              : "bg-white text-black shadow-glow hover:scale-105"
          )}
        >
          <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing" : "Sync Now"}
        </button>
      </div>

      {result && (
        <div className="mt-4 animate-fade-in">
          {result.error ? (
            <p className="text-[11px] text-red-400">{result.error}</p>
          ) : (
            <p className="text-[11px] text-gray-400">
              {result.total} Luma guests · {result.created} new · {result.checkedIn} checked in ·{" "}
              {result.creditsAssigned} credits assigned
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
            </p>
          )}
          {result.noCodesLeft && (
            <p className="text-[11px] text-amber-400 mt-1">
              Ran out of credit codes — import more to cover remaining attendees.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
