"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { createPoll, updatePoll, deletePoll, togglePollActive } from "@/lib/actions/polls";
import {
  getScheduledItems,
  createScheduledPoll,
  cancelScheduledItem,
} from "@/lib/actions/scheduling";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  X,
  Clock,
  BarChart3,
  CalendarClock,
} from "lucide-react";
import type { Event, Poll, ScheduledItem } from "@/types";

interface PollsAdminClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  initialPolls: Poll[];
  isEmbedded?: boolean;
}

export function PollsAdminClient({
  event,
  eventSlug,
  adminCode,
  initialPolls,
  isEmbedded = false,
}: PollsAdminClientProps) {
  const router = useRouter();
  const [polls, setPolls] = useState(initialPolls);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);

  useEffect(() => {
    if (!adminCode) return;
    getScheduledItems(event.id, adminCode).then(setScheduledItems);
  }, [event.id, adminCode]);

  const handleToggleActive = async (pollId: string) => {
    setLoading(pollId);
    const result = await togglePollActive(pollId, eventSlug, adminCode);
    if (result.success) {
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, is_active: result.is_active! } : p))
      );
      router.refresh();
    }
    setLoading(null);
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) return;
    setLoading(pollId);
    const result = await deletePoll(pollId, eventSlug, adminCode);
    if (result.success) {
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
      router.refresh();
    }
    setLoading(null);
  };

  const handleCreatePoll = async (data: {
    question: string;
    options: string[];
    ends_at?: string;
    is_active: boolean;
    scheduled_at?: string;
  }) => {
    setError(null);

    // Scheduled poll → save to scheduled_items
    if (data.scheduled_at && adminCode) {
      const durationMins = data.ends_at
        ? Math.round((new Date(data.ends_at).getTime() - new Date(data.scheduled_at).getTime()) / 60000)
        : null;

      const result = await createScheduledPoll(
        event.id,
        adminCode,
        data.question,
        data.options,
        durationMins,
        data.scheduled_at
      );

      if (result.success && result.item) {
        setScheduledItems((prev) =>
          [...prev, result.item!].sort(
            (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
          )
        );
        setShowCreateModal(false);
        return { success: true };
      }
      const msg = result.error || "Failed to schedule poll";
      setError(msg);
      return { success: false, error: msg };
    }

    // Immediate poll
    const result = await createPoll(event.id, eventSlug, data, adminCode);
    if (result.success && result.pollId) {
      setPolls((prev) => [
        {
          id: result.pollId!,
          event_id: event.id,
          question: data.question,
          options: data.options,
          ends_at: data.ends_at || null,
          is_active: data.is_active,
          show_results: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setShowCreateModal(false);
      router.refresh();
      return { success: true };
    }
    const msg = result.error || "Failed to create poll";
    setError(msg);
    return { success: false, error: msg };
  };

  const handleCancelScheduled = async (itemId: string) => {
    if (!adminCode) return;
    const result = await cancelScheduledItem(itemId, event.id, adminCode);
    if (result.success) {
      setScheduledItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  const content = (
    <main className={cn("max-w-4xl mx-auto px-6 py-8 space-y-6", isEmbedded && "py-0")}>
      {error && (
        <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Scheduled queue */}
      {scheduledItems.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-bold px-1">
            Scheduled
          </p>
          {scheduledItems.map((item) => (
            <div
              key={item.id}
              className="glass rounded-[28px] p-5 border-white/[0.04] flex items-center gap-4"
            >
              <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-light truncate">{item.poll_question}</p>
                <p className="text-[10px] text-amber-400/70 uppercase tracking-[0.15em] mt-0.5">
                  {new Date(item.scheduled_at).toLocaleString()} ·{" "}
                  {(item.poll_options as string[])?.length ?? 0} options
                  {item.poll_duration_minutes ? ` · ${item.poll_duration_minutes}m` : ""}
                </p>
              </div>
              <button
                onClick={() => handleCancelScheduled(item.id)}
                className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-red-400 hover:border-red-400/20 transition-all flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {polls.length === 0 ? (
        <div className="glass rounded-[40px] p-20 text-center space-y-4 border-dashed border-white/10">
          <BarChart3 className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-500 text-sm">No polls created yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-white text-sm underline underline-offset-4 hover:no-underline"
          >
            Create your first poll
          </button>
        </div>
      ) : (
        polls.map((poll) => (
          <div
            key={poll.id}
            className={cn(
              "glass rounded-[32px] p-8 transition-all",
              poll.is_active ? "border-green-500/30 bg-green-500/5" : "border-white/5"
            )}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  {poll.is_active ? (
                    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] uppercase tracking-[0.15em] font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-white/5 text-gray-500 text-[10px] uppercase tracking-[0.15em] font-medium">
                      Draft
                    </span>
                  )}
                  {poll.ends_at && (
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <Clock className="w-3 h-3" />
                      Ends {new Date(poll.ends_at).toLocaleString()}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-light text-white">{poll.question}</h3>

                <div className="flex flex-wrap gap-2">
                  {poll.options.map((option, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 text-gray-400 text-xs">
                      {option}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(poll.id)}
                  disabled={loading === poll.id}
                  className={cn(
                    "p-3 rounded-full transition-all",
                    poll.is_active
                      ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                      : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  )}
                  title={poll.is_active ? "Pause poll" : "Start poll"}
                >
                  {poll.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(poll.id)}
                  disabled={loading === poll.id}
                  className="p-3 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  title="Delete poll"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </main>
  );

  if (isEmbedded) {
    return (
      <>
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" />
            New Poll
          </button>
        </div>
        {content}
        {showCreateModal && (
          <CreatePollModal
            onClose={() => { setShowCreateModal(false); setError(null); }}
            onCreate={handleCreatePoll}
            error={error}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black-gradient text-white">
      <AdminHeader
        eventSlug={eventSlug}
        subtitle="Engagement Control"
        rightElement={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Poll
          </button>
        }
      />

      {content}

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Live Polls</p>
      </footer>

      {showCreateModal && (
        <CreatePollModal
          onClose={() => { setShowCreateModal(false); setError(null); }}
          onCreate={handleCreatePoll}
          error={error}
        />
      )}
    </div>
  );
}

type CreateMode = "now" | "scheduled";

function CreatePollModal({
  onClose,
  onCreate,
  error: externalError,
}: {
  onClose: () => void;
  onCreate: (data: {
    question: string;
    options: string[];
    ends_at?: string;
    is_active: boolean;
    scheduled_at?: string;
  }) => Promise<{ success?: boolean; error?: string } | void>;
  error?: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState<number | null>(null);
  const [mode, setMode] = useState<CreateMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);

  // Default scheduled time to 30 min from now
  useEffect(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledAt(local);
  }, []);

  const handleAddOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.filter((o) => o.trim()).length < 2) return;
    setLoading(true);

    let ends_at: string | undefined;
    if (duration && mode === "now") {
      const end = new Date();
      end.setMinutes(end.getMinutes() + duration);
      ends_at = end.toISOString();
    } else if (duration && mode === "scheduled" && scheduledAt) {
      const base = new Date(scheduledAt);
      base.setMinutes(base.getMinutes() + duration);
      ends_at = base.toISOString();
    }

    try {
      await onCreate({
        question: question.trim(),
        options: options.filter((o) => o.trim()),
        ends_at,
        is_active: mode === "now",
        scheduled_at: mode === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 animate-slide-up overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <h2 className="text-2xl font-light text-white mb-8">Create Poll</h2>

        {externalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{externalError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to ask?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[index] = e.target.value;
                    setOptions(newOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => handleRemoveOption(index)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button type="button" onClick={handleAddOption} className="text-sm text-gray-500 hover:text-white transition-colors">
                + Add option
              </button>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Duration (optional)
            </label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 5, 10, null].map((mins) => (
                <button
                  key={mins ?? "none"}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm transition-all",
                    duration === mins ? "bg-white text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  )}
                >
                  {mins ? `${mins}m` : "No limit"}
                </button>
              ))}
            </div>
          </div>

          {/* Launch mode */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Launch
            </label>
            <div className="flex gap-2">
              {(["now", "scheduled"] as CreateMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all",
                    mode === m ? "bg-white text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  )}
                >
                  {m === "scheduled" && <CalendarClock className="w-3.5 h-3.5" />}
                  {m === "now" ? "Start immediately" : "Schedule"}
                </button>
              ))}
            </div>

            {mode === "scheduled" && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Go Live At
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !question.trim() || options.filter((o) => o.trim()).length < 2 || (mode === "scheduled" && !scheduledAt)}
            className="w-full py-4 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "..." : mode === "scheduled" ? "Schedule Poll" : "Create Poll"}
          </button>
        </form>
      </div>
    </div>
  );
}
