"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Trophy,
  Play,
  Vote,
  Square,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  Users,
  Code,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createCompetition,
  updateCompetition,
  deleteCompetition,
  updateCompetitionStatus,
  selectWinner,
  selectTop3Entries,
  selectAdminWinner,
  finalizeGroupWinner,
  castVote,
} from "@/lib/actions/competitions";
import type { CompetitionWithEntries, CompetitionStatus } from "@/types";

interface CompetitionsAdminClientProps {
  eventId: string;
  eventSlug: string;
  adminCode: string;
  initialCompetitions: CompetitionWithEntries[];
}

function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    return null;
  } catch {
    return null;
  }
}

const statusActions: Record<string, { label: string; next: CompetitionStatus; icon: typeof Play }> = {
  draft: { label: "Activate", next: "active", icon: Play },
  active: { label: "Open Voting", next: "voting", icon: Vote },
  voting: { label: "End Competition", next: "ended", icon: Square },
};

const statusBadge: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  active: "bg-green-500/20 text-green-400",
  voting: "bg-blue-500/20 text-blue-400",
  ended: "bg-gray-500/20 text-gray-500",
};

export function CompetitionsAdminClient({
  eventId,
  eventSlug,
  adminCode,
  initialCompetitions,
}: CompetitionsAdminClientProps) {
  const router = useRouter();
  const [competitions, setCompetitions] = useState(initialCompetitions);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    setCompetitions(initialCompetitions);
  }, [initialCompetitions]);

  useEffect(() => {
    console.log("[CompetitionsAdminClient] CLIENT MOUNTED:", { eventId, eventSlug, adminCode, competitionsCount: initialCompetitions.length });
  }, []);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRules, setNewRules] = useState("");
  const [newVotingMode, setNewVotingMode] = useState("group");
  const [newMaxEntries, setNewMaxEntries] = useState("");
  const [error, setError] = useState<string | null>(null);

  // top3: track which entries the admin has checked as finalists
  const [top3Selections, setTop3Selections] = useState<Record<string, Set<string>>>({});
  // admin voting state
  const [votingEntryId, setVotingEntryId] = useState<string | null>(null);
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});

  const toggleTop3Selection = (compId: string, entryId: string) => {
    setTop3Selections((prev) => {
      const current = new Set(prev[compId] || []);
      if (current.has(entryId)) {
        current.delete(entryId);
      } else if (current.size < 3) {
        current.add(entryId);
      }
      return { ...prev, [compId]: current };
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    console.log("[CompetitionsAdminClient] handleCreate START");

    if (!newTitle.trim()) {
      setError("Title is required.");
      return;
    }

    setLoading("create");
    setError(null);

    const payload = {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      rules: newRules.trim() || undefined,
      voting_mode: newVotingMode,
      max_entries: newMaxEntries ? (parseInt(newMaxEntries, 10) || undefined) : undefined,
    };

    try {
      const result = await createCompetition(eventId, eventSlug, payload, adminCode);

      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "success" in result && result.success) {
        setNewTitle("");
        setNewDesc("");
        setNewRules("");
        setNewVotingMode("group");
        setNewMaxEntries("");
        setShowCreateForm(false);
        router.refresh();
        return;
      }
      setError("Create failed. No response from server.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed.";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  const handleStatusChange = async (compId: string, nextStatus: string) => {
    setLoading(compId);
    setError(null);

    try {
      const result = await updateCompetitionStatus(compId, eventSlug, nextStatus, adminCode);

      if (result && "error" in result && result.error) {
        setError(result.error);
      } else if (result && "success" in result && result.success) {
        router.refresh();
      } else {
        setError("Status update failed. No response from server.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (compId: string) => {
    if (!confirm("Delete this competition and all its entries?")) return;
    setLoading(compId);
    await deleteCompetition(compId, eventSlug, adminCode);
    router.refresh();
    setLoading(null);
  };

  const handleSelectWinner = async (compId: string, method: "auto" | "manual", entryId?: string) => {
    setLoading(compId);
    const result = await selectWinner(compId, eventSlug, method, entryId, adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(null);
  };

  const handleConfirmTop3 = async (compId: string) => {
    const selected = top3Selections[compId];
    if (!selected || selected.size !== 3) {
      setError("Select exactly 3 finalists before confirming.");
      return;
    }
    setLoading(compId);
    setError(null);
    const result = await selectTop3Entries(compId, eventSlug, Array.from(selected), adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(null);
  };

  const handleSelectAdminWinner = async (compId: string, entryId: string) => {
    setLoading(compId);
    setError(null);
    const result = await selectAdminWinner(compId, eventSlug, entryId, adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(null);
  };

  const handleFinalizeGroupWinner = async (compId: string) => {
    setLoading(compId);
    setError(null);
    const result = await finalizeGroupWinner(compId, eventSlug, adminCode);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(null);
  };

  const handleCastVote = async (compId: string, entryId: string) => {
    setVotingEntryId(entryId);
    setVoteErrors((prev) => ({ ...prev, [entryId]: "" }));
    const result = await castVote(compId, entryId, eventSlug);
    setVotingEntryId(null);
    if (result?.error) {
      setVoteErrors((prev) => ({ ...prev, [entryId]: result.error! }));
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create button */}
      {!showCreateForm && (
        <button
          type="button"
          onClick={() => { setShowCreateForm(true); setError(null); }}
          className="glass rounded-[32px] p-6 border-white/10 hover:bg-white/10 transition-all w-full flex items-center gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-105 transition-all">
            <Plus className="w-5 h-5 text-gray-400 group-hover:text-white" />
          </div>
          <span className="text-sm text-gray-400 group-hover:text-white">Create Competition</span>
        </button>
      )}

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCreate(e);
          }}
          className="glass rounded-[32px] p-8 border-white/10 space-y-5"
        >
          <h3 className="text-lg font-light text-white">New Competition</h3>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
              placeholder="Competition title"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 resize-none"
              placeholder="What is this competition about?"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Rules</label>
            <textarea
              value={newRules}
              onChange={(e) => setNewRules(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 resize-none"
              placeholder="Competition rules..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Voting Mode</label>
              <select
                value={newVotingMode}
                onChange={(e) => setNewVotingMode(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 [&_option]:bg-white [&_option]:text-gray-900"
              >
                <option value="group" style={{ backgroundColor: "#fff", color: "#111" }}>Group (Upvote)</option>
                <option value="judges" style={{ backgroundColor: "#fff", color: "#111" }}>Judges (1-5)</option>
                <option value="both" style={{ backgroundColor: "#fff", color: "#111" }}>Both</option>
                <option value="top3" style={{ backgroundColor: "#fff", color: "#111" }}>Top 3 (Admin picks finalists, dual prizes)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Max Entries</label>
              <input
                type="number"
                value={newMaxEntries}
                onChange={(e) => setNewMaxEntries(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                placeholder="Unlimited"
                min={1}
              />
            </div>
          </div>

          {newVotingMode === "top3" && (
            <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-4 text-xs text-purple-300 space-y-1">
              <p className="font-medium">How Top 3 works:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-purple-400">
                <li>Collect all project submissions (Active phase)</li>
                <li>You select exactly 3 finalists from the entries</li>
                <li>Open voting — the group upvotes their favorite finalist</li>
                <li>You also pick your own winner from the 3 finalists</li>
                <li>Two prizes are awarded: People&apos;s Choice + Admin Pick</li>
              </ol>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading === "create"}
              className="px-6 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50"
            >
              {loading === "create" ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-3 rounded-2xl bg-white/5 text-gray-400 text-sm hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Competitions list */}
      {competitions.map((comp) => {
        const isExpanded = expandedId === comp.id;
        const action = statusActions[comp.status];
        const isTop3 = comp.voting_mode === "top3";
        const top3Ids = comp.top3_entry_ids || [];
        const pendingTop3 = top3Selections[comp.id] || new Set<string>();

        return (
          <div key={comp.id} className="glass rounded-[32px] border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-6 flex items-center justify-between">
              <button
                onClick={() => setExpandedId(isExpanded ? null : comp.id)}
                className="flex items-center gap-4 text-left flex-1"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-light text-white">{comp.title}</h3>
                    <span className={cn("text-[10px] uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-full", statusBadge[comp.status])}>
                      {comp.status}
                    </span>
                    {isTop3 && (
                      <span className="text-[10px] uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                        Top 3 Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {comp.entries?.length || 0} entries
                    {isTop3 && top3Ids.length === 3 && " - 3 finalists selected"}
                    {isTop3 && comp.group_winner_entry_id && " - People's Choice set"}
                    {isTop3 && comp.admin_winner_entry_id && " - Admin Pick set"}
                    {!isTop3 && comp.winner_entry_id && " - Winner selected"}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              <div className="flex items-center gap-2 ml-4">
                {action && (
                  <button
                    onClick={() => handleStatusChange(comp.id, action.next)}
                    disabled={loading === comp.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/15 transition-all disabled:opacity-50"
                  >
                    <action.icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(comp.id)}
                  disabled={loading === comp.id}
                  className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-white/10 p-6 space-y-4">
                {comp.description && (
                  <p className="text-sm text-gray-400">{comp.description}</p>
                )}

                {/* ── TOP 3 MODE ── */}
                {isTop3 && (
                  <div className="space-y-4">
                    {/* Step 1: Pick finalists (active phase, before top3 is locked) */}
                    {comp.status === "active" && (
                      <div className="bg-purple-500/10 rounded-2xl p-4 space-y-3 border border-purple-500/20">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-purple-400 font-medium">
                          Step 1 — Select 3 Finalists
                        </p>
                        <p className="text-xs text-gray-400">
                          Check exactly 3 entries below, then click Confirm Finalists. After that, open voting.
                        </p>
                        <p className="text-xs text-purple-300">
                          {pendingTop3.size}/3 selected
                          {top3Ids.length === 3 && (
                            <span className="ml-2 text-green-400">
                              (Finalists already saved — you can update them)
                            </span>
                          )}
                        </p>
                        {pendingTop3.size === 3 && (
                          <button
                            onClick={() => handleConfirmTop3(comp.id)}
                            disabled={loading === comp.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/30 text-purple-200 text-xs font-medium hover:bg-purple-500/40 transition-all disabled:opacity-50"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Confirm Finalists
                          </button>
                        )}
                      </div>
                    )}

                    {/* Step 2: Admin winner + group winner (voting/ended) */}
                    {(comp.status === "voting" || comp.status === "ended") && top3Ids.length === 3 && (
                      <div className="space-y-3">
                        {/* Admin Pick */}
                        <div className="bg-yellow-500/10 rounded-2xl p-4 space-y-3 border border-yellow-500/20">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-400 font-medium flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5" />
                            Admin Pick — click a finalist below to set your prize winner
                          </p>
                          {comp.admin_winner_entry_id && (
                            <p className="text-xs text-yellow-300">
                              Current Admin Pick: {comp.entries?.find((e) => e.id === comp.admin_winner_entry_id)?.title || "Unknown"}
                            </p>
                          )}
                        </div>

                        {/* People's Choice */}
                        <div className="bg-blue-500/10 rounded-2xl p-4 space-y-3 border border-blue-500/20">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-medium flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            People&apos;s Choice — calculated from group votes on the 3 finalists
                          </p>
                          <button
                            onClick={() => handleFinalizeGroupWinner(comp.id)}
                            disabled={loading === comp.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Calculate People&apos;s Choice (by vote count)
                          </button>
                          {comp.group_winner_entry_id && (
                            <p className="text-xs text-blue-300">
                              Current People&apos;s Choice: {comp.entries?.find((e) => e.id === comp.group_winner_entry_id)?.title || "Unknown"}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STANDARD MODES winner selection ── */}
                {!isTop3 && (comp.status === "voting" || comp.status === "ended") && (
                  <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                      Winner Selection
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectWinner(comp.id, "auto")}
                        disabled={loading === comp.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-300 text-xs font-medium hover:bg-yellow-500/30 transition-all disabled:opacity-50"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        Auto (Highest Score)
                      </button>
                    </div>
                    {comp.winner_entry_id && (
                      <p className="text-xs text-yellow-400">
                        Current winner: {comp.entries?.find((e) => e.id === comp.winner_entry_id)?.title || "Unknown"}
                      </p>
                    )}
                  </div>
                )}

                {/* Entries list */}
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                    Entries ({comp.entries?.length || 0})
                  </p>
                  {comp.entries && comp.entries.length > 0 ? (
                    comp.entries.map((entry) => {
                      const isFinalist = top3Ids.includes(entry.id);
                      const isPendingSelected = pendingTop3.has(entry.id);
                      const isAdminWinner = entry.id === comp.admin_winner_entry_id;
                      const isGroupWinner = entry.id === comp.group_winner_entry_id;
                      const isWinner = entry.id === comp.winner_entry_id;

                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            "rounded-xl border p-4 flex items-center justify-between",
                            isAdminWinner
                              ? "border-yellow-500/40 bg-yellow-500/10"
                              : isGroupWinner
                              ? "border-blue-500/40 bg-blue-500/10"
                              : isWinner
                              ? "border-yellow-500/30 bg-yellow-500/5"
                              : isFinalist
                              ? "border-purple-500/30 bg-purple-500/5"
                              : isPendingSelected
                              ? "border-purple-500/50 bg-purple-500/10"
                              : "border-white/10 bg-white/5"
                          )}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isAdminWinner && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                              {isGroupWinner && <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                              {isWinner && !isTop3 && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                              <span className="text-sm text-white">{entry.title}</span>
                              {isFinalist && !isAdminWinner && !isGroupWinner && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Finalist</span>
                              )}
                              {isAdminWinner && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">Admin Pick</span>
                              )}
                              {isGroupWinner && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">People&apos;s Choice</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {entry.user?.name || "Unknown"} — {entry.vote_count || 0} vote{(entry.vote_count || 0) !== 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            {/* StackBlitz preview */}
                            {(() => {
                              const ghRepo = parseGitHubRepo(entry.repo_url);
                              return ghRepo ? (
                                <a
                                  href={`https://stackblitz.com/github/${ghRepo.owner}/${ghRepo.repo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all text-[10px] font-medium"
                                  title="Open in StackBlitz"
                                >
                                  <Code className="w-3 h-3" />
                                  StackBlitz
                                </a>
                              ) : null;
                            })()}
                            <a
                              href={entry.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-all"
                              title="GitHub"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {entry.project_url && (
                              <a
                                href={entry.project_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-all"
                                title="Live demo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {entry.video_url && (
                              <a
                                href={entry.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-purple-300 transition-all"
                                title="Watch video"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              </a>
                            )}

                            {/* top3: checkbox for finalist selection (active phase) */}
                            {isTop3 && comp.status === "active" && (
                              <button
                                onClick={() => toggleTop3Selection(comp.id, entry.id)}
                                disabled={!isPendingSelected && pendingTop3.size >= 3}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40",
                                  isPendingSelected
                                    ? "bg-purple-500/40 text-purple-200 hover:bg-purple-500/50"
                                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                                )}
                              >
                                {isPendingSelected ? "Selected" : "Select"}
                              </button>
                            )}

                            {/* top3: vote button for admin (voting phase only) */}
                            {isTop3 && comp.status === "voting" && isFinalist && (
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  onClick={() => handleCastVote(comp.id, entry.id)}
                                  disabled={votingEntryId === entry.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
                                  title="Cast your vote for this entry (People's Choice)"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  {votingEntryId === entry.id ? "Voting…" : "Vote"}
                                </button>
                                {voteErrors[entry.id] && (
                                  <span className="text-[10px] text-red-400">{voteErrors[entry.id]}</span>
                                )}
                              </div>
                            )}

                            {/* top3: admin winner button (voting/ended) */}
                            {isTop3 && (comp.status === "voting" || comp.status === "ended") && isFinalist && (
                              <button
                                onClick={() => handleSelectAdminWinner(comp.id, entry.id)}
                                disabled={loading === comp.id}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                                  isAdminWinner
                                    ? "bg-yellow-500/30 text-yellow-200"
                                    : "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                                )}
                              >
                                {isAdminWinner ? "Admin Pick" : "Set Admin Pick"}
                              </button>
                            )}

                            {/* Standard modes: manual pick winner */}
                            {!isTop3 && (comp.status === "voting" || comp.status === "ended") && (
                              <button
                                onClick={() => handleSelectWinner(comp.id, "manual", entry.id)}
                                disabled={loading === comp.id}
                                className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                              >
                                Pick Winner
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-600">No entries yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {competitions.length === 0 && !showCreateForm && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No competitions yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
