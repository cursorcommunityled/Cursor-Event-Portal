"use client";

import { useState, useTransition } from "react";
import {
  importCreditCodes,
  autoAssignCredits,
  unassignCredit,
  deleteCreditCode,
  fetchCursorCredits,
} from "@/lib/actions/cursor-credits";
import { cn } from "@/lib/utils";
import { Gift, ChevronDown, ChevronUp, Trash2, UserX } from "lucide-react";
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
