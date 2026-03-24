"use client";

import { useState, useTransition, useEffect } from "react";
import {
  importCreditCodes,
  autoAssignCredits,
  unassignCredit,
  deleteCreditCode,
  fetchCursorCredits,
} from "@/lib/actions/cursor-credits";
import { resetEasterEggs, fetchEasterEggs, saveEggRewardCode } from "@/lib/actions/easter-eggs";
import type { EggRow } from "@/lib/actions/easter-eggs";
import { cn } from "@/lib/utils";
import { Gift, ChevronDown, ChevronUp, Trash2, UserX, RotateCcw, Check, Pencil } from "lucide-react";
import type { CursorCredit } from "@/types";

interface CreditsAdminTabProps {
  eventId: string;
  adminCode: string;
  initialCredits: CursorCredit[];
}

function statusLabel(c: CursorCredit) {
  if (c.redeemed_at) return "Redeemed";
  if (c.assigned_to) return "Assigned";
  return "Unassigned";
}

function statusColor(c: CursorCredit) {
  if (c.redeemed_at) return "text-green-400 bg-green-400/10";
  if (c.assigned_to) return "text-blue-400 bg-blue-400/10";
  return "text-gray-500 bg-white/5";
}

export function CreditsAdminTab({
  eventId,
  adminCode,
  initialCredits,
}: CreditsAdminTabProps) {
  const [credits, setCredits] = useState<CursorCredit[]>(initialCredits);
  const [importOpen, setImportOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rowLoading, setRowLoading] = useState<string | null>(null);
  const [eggResetMsg, setEggResetMsg] = useState<string | null>(null);
  const [eggResetting, setEggResetting] = useState(false);
  const [eggs, setEggs] = useState<EggRow[]>([]);
  const [eggInputs, setEggInputs] = useState<Record<string, string>>({});
  const [eggEditing, setEggEditing] = useState<string | null>(null);
  const [eggSaving, setEggSaving] = useState<string | null>(null);
  const [eggSaveMsg, setEggSaveMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEasterEggs(eventId).then((rows) => {
      setEggs(rows);
      const inputs: Record<string, string> = {};
      rows.forEach((r) => { inputs[r.egg_id] = r.credit_code || ""; });
      setEggInputs(inputs);
    });
  }, [eventId]);

  const handleSaveEggCode = async (eggId: string) => {
    const code = eggInputs[eggId]?.trim();
    if (!code) return;
    setEggSaving(eggId);
    const result = await saveEggRewardCode(eventId, eggId, code);
    setEggSaving(null);
    if (result.success) {
      setEggSaveMsg((prev) => ({ ...prev, [eggId]: "Saved" }));
      setEggEditing(null);
      const fresh = await fetchEasterEggs(eventId);
      setEggs(fresh);
      const inputs: Record<string, string> = {};
      fresh.forEach((r) => { inputs[r.egg_id] = r.credit_code || ""; });
      setEggInputs(inputs);
      setTimeout(() => setEggSaveMsg((prev) => { const n = { ...prev }; delete n[eggId]; return n; }), 2000);
    } else {
      setEggSaveMsg((prev) => ({ ...prev, [eggId]: `Error: ${result.error}` }));
    }
  };

  const total = credits.length;
  const assigned = credits.filter((c) => c.assigned_to).length;
  const available = credits.filter((c) => !c.assigned_to).length;
  const redeemed = credits.filter((c) => c.redeemed_at).length;

  const handleImport = () => {
    const lines = rawInput.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    startTransition(async () => {
      setImportMsg(null);
      const result = await importCreditCodes(eventId, lines, adminCode);
      if (result.error) {
        setImportMsg(`Error: ${result.error}`);
      } else {
        setImportMsg(`Inserted ${result.inserted} code${result.inserted !== 1 ? "s" : ""}${result.duplicates ? `, ${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} skipped` : ""}.`);
        setRawInput("");
        const fresh = await fetchCursorCredits(eventId);
        setCredits(fresh);
      }
    });
  };

  const handleAutoAssign = () => {
    startTransition(async () => {
      setAutoMsg(null);
      const result = await autoAssignCredits(eventId, adminCode);
      if (result.error) {
        setAutoMsg(`Error: ${result.error}`);
      } else if (result.assigned === 0 && !result.noCodesLeft) {
        setAutoMsg("All checked-in attendees already have a credit.");
      } else if (result.noCodesLeft && result.assigned === 0) {
        setAutoMsg("No codes available in the pool.");
      } else {
        setAutoMsg(
          `Assigned ${result.assigned} credit${result.assigned !== 1 ? "s" : ""}${result.noCodesLeft ? " — pool exhausted, some attendees not covered" : "."}`
        );
      }
      const fresh = await fetchCursorCredits(eventId);
      setCredits(fresh);
    });
  };

  const handleUnassign = async (creditId: string) => {
    setRowLoading(creditId);
    const result = await unassignCredit(creditId, adminCode);
    setRowLoading(null);
    if (!result.error) {
      setCredits((prev) =>
        prev.map((c) =>
          c.id === creditId
            ? { ...c, assigned_to: null, registration_id: null, assigned_at: null }
            : c
        )
      );
    }
  };

  const handleEggReset = async () => {
    if (!confirm("Reset all Cursor eggs? This unclaims all eggs and deletes the placeholder credits so the hunt can be re-run.")) return;
    setEggResetting(true);
    setEggResetMsg(null);
    const result = await resetEasterEggs(eventId);
    setEggResetting(false);
    if (result.success) {
      setEggResetMsg("Cursor eggs reset — all unclaimed, $50 credits removed. Reward codes preserved.");
      const fresh = await fetchCursorCredits(eventId);
      setCredits(fresh);
      const freshEggs = await fetchEasterEggs(eventId);
      setEggs(freshEggs);
    } else {
      setEggResetMsg(`Error: ${result.error}`);
    }
  };

  const handleDelete = async (creditId: string) => {
    setRowLoading(creditId);
    const result = await deleteCreditCode(creditId, adminCode);
    setRowLoading(null);
    if (!result.error) {
      setCredits((prev) => prev.filter((c) => c.id !== creditId));
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", value: total },
          { label: "Assigned", value: assigned, color: "text-blue-400" },
          { label: "Available", value: available, color: "text-gray-400" },
          { label: "Redeemed", value: redeemed, color: "text-green-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-2xl px-5 py-3 border border-white/10 flex flex-col items-center min-w-[80px]"
          >
            <span className={cn("text-2xl font-light", stat.color ?? "text-white")}>
              {stat.value}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mt-0.5">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Cursor Egg Hunt */}
      <div className="glass rounded-3xl p-6 border border-white/[0.06] space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-base">🥚</span>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">
            Cursor Egg Hunt
          </p>
        </div>

        {/* Reward codes per egg */}
        {eggs.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Pre-load $50 reward codes. When someone claims an egg they get the code instantly.
            </p>
            <div className="space-y-2">
              {eggs.map((egg) => {
                const isEditing = eggEditing === egg.egg_id;
                const isSaving = eggSaving === egg.egg_id;
                const msg = eggSaveMsg[egg.egg_id];
                return (
                  <div key={egg.egg_id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium w-10">
                          {egg.egg_id.replace("_", " ")}
                        </span>
                        <span className="text-xs text-gray-500">{egg.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {egg.claimed_by ? (
                          <span className="text-[10px] uppercase tracking-widest font-medium px-2.5 py-1 rounded-full text-blue-400 bg-blue-400/10">
                            Claimed
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-widest font-medium px-2.5 py-1 rounded-full text-gray-500 bg-white/5">
                            Unclaimed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing || !egg.credit_code ? (
                        <>
                          <input
                            type="text"
                            value={eggInputs[egg.egg_id] || ""}
                            onChange={(e) => setEggInputs((prev) => ({ ...prev, [egg.egg_id]: e.target.value }))}
                            placeholder="Paste referral code or URL…"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 font-mono"
                          />
                          <button
                            onClick={() => handleSaveEggCode(egg.egg_id)}
                            disabled={isSaving || !eggInputs[egg.egg_id]?.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                          {isEditing && (
                            <button
                              onClick={() => {
                                setEggEditing(null);
                                setEggInputs((prev) => ({ ...prev, [egg.egg_id]: egg.credit_code || "" }));
                              }}
                              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <code className="flex-1 font-mono text-sm text-white/70 truncate">
                            {egg.credit_code}
                          </code>
                          <button
                            onClick={() => setEggEditing(egg.egg_id)}
                            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                            title="Edit code"
                          >
                            <Pencil className="w-3 h-3 text-gray-500" />
                          </button>
                        </>
                      )}
                    </div>
                    {msg && (
                      <p className={cn("text-xs", msg.startsWith("Error") ? "text-red-400" : "text-green-400")}>
                        {msg}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reset */}
        <div className="pt-2 border-t border-white/[0.04] space-y-2">
          <p className="text-xs text-gray-600">
            Reset unclaims all eggs and removes $50 credits. Pre-loaded codes are preserved.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleEggReset}
              disabled={eggResetting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {eggResetting ? "Resetting…" : "Reset Eggs"}
            </button>
            {eggResetMsg && (
              <p className="text-xs text-gray-500">{eggResetMsg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Auto-assign */}
      <div className="glass rounded-3xl p-6 border border-white/10 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">
          Auto-Assign
        </p>
        <p className="text-sm text-gray-400">
          Assigns one code to every checked-in attendee that doesn&apos;t yet have a credit.
        </p>
        <button
          onClick={handleAutoAssign}
          disabled={isPending || available === 0}
          className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40"
        >
          {isPending ? "Assigning…" : "Assign to All Checked-In"}
        </button>
        {autoMsg && (
          <p className="text-sm text-gray-400">{autoMsg}</p>
        )}
      </div>

      {/* Import */}
      <div className="glass rounded-3xl p-6 border border-white/10 space-y-3">
        <button
          onClick={() => setImportOpen((o) => !o)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">
            Import Codes
          </p>
          {importOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>
        {importOpen && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-500">
              One code per line. Accepts plain codes or full{" "}
              <code className="text-gray-400">https://cursor.com/referral?code=</code> URLs.
            </p>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={6}
              placeholder={"ABC123\nDEF456\nhttps://cursor.com/referral?code=GHI789"}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none font-mono"
            />
            {importMsg && (
              <p className="text-sm text-gray-400">{importMsg}</p>
            )}
            <button
              onClick={handleImport}
              disabled={isPending || !rawInput.trim()}
              className="px-6 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40"
            >
              {isPending ? "Importing…" : "Import"}
            </button>
          </div>
        )}
      </div>

      {/* Codes table */}
      {credits.length === 0 ? (
        <div className="glass rounded-3xl p-8 border border-white/10 text-center">
          <Gift className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No codes imported yet.</p>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/10 overflow-hidden">
          <div className="divide-y divide-white/[0.05]">
            {credits.map((credit) => {
              const isLoading = rowLoading === credit.id;
              return (
                <div
                  key={credit.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Code */}
                  <code className="font-mono text-sm text-white/70 flex-shrink-0 w-36 truncate">
                    {credit.credit_code}
                  </code>

                  {/* Assignee */}
                  <div className="flex-1 min-w-0">
                    {credit.user ? (
                      <div>
                        <p className="text-sm text-white truncate">{credit.user.name}</p>
                        {credit.user.email && (
                          <p className="text-xs text-gray-500 truncate">{credit.user.email}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Unassigned</p>
                    )}
                  </div>

                  {/* Status */}
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                      statusColor(credit)
                    )}
                  >
                    {statusLabel(credit)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {credit.assigned_to && !credit.redeemed_at && (
                      <button
                        onClick={() => handleUnassign(credit.id)}
                        disabled={isLoading}
                        title="Unassign"
                        className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-40"
                      >
                        <UserX className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    )}
                    {!credit.assigned_to && (
                      <button
                        onClick={() => handleDelete(credit.id)}
                        disabled={isLoading}
                        title="Delete"
                        className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-400/10 hover:border-red-400/20 transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
