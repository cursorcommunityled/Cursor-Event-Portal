"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { createPoll, updatePoll, deletePoll, togglePollActive } from "@/lib/actions/polls";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  ArrowLeft,
  X,
  Clock,
  Users,
  BarChart3,
} from "lucide-react";
import type { Event, Poll } from "@/types";

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

  const handleToggleActive = async (pollId: string) => {
    setLoading(pollId);
    const result = await togglePollActive(pollId, eventSlug, adminCode);
    if (result.success) {
      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId ? { ...p, is_active: result.is_active! } : p
        )
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
  }) => {
    setError(null);
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
    } else {
      const errorMsg = result.error || "Failed to create poll";
      setError(errorMsg);
      console.error("Failed to create poll:", result.error);
      return { success: false, error: errorMsg };
    }
  };

  const content = (
    <main className={cn("max-w-4xl mx-auto px-6 py-8 space-y-6", isEmbedded && "py-0")}>
      {/* Error Message */}
      {error && (
        <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
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
              poll.is_active
                ? "border-green-500/30 bg-green-500/5"
                : "border-white/5"
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

                <h3 className="text-xl font-light text-white">
                  {poll.question}
                </h3>

                <div className="flex flex-wrap gap-2">
                  {poll.options.map((option, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-full bg-white/5 text-gray-400 text-xs"
                    >
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
                  {poll.is_active ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
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
            onClose={() => {
              setShowCreateModal(false);
              setError(null);
            }}
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

      {/* Content */}
      {content}

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Live Polls</p>
        </div>
      </footer>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePollModal
          onClose={() => {
            setShowCreateModal(false);
            setError(null);
          }}
          onCreate={handleCreatePoll}
          error={error}
        />
      )}
    </div>
  );
}

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
  }) => Promise<{ success?: boolean; error?: string } | void>;
  error?: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState<number | null>(null);
  const [startImmediately, setStartImmediately] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.filter((o) => o.trim()).length < 2) return;

    setLoading(true);

    let ends_at: string | undefined;
    if (duration) {
      const end = new Date();
      end.setMinutes(end.getMinutes() + duration);
      ends_at = end.toISOString();
    }

    try {
      const result = await onCreate({
        question: question.trim(),
        options: options.filter((o) => o.trim()),
        ends_at,
        is_active: startImmediately,
      });
      
      // If result indicates success, reset form (modal will close)
      if (result?.success !== false) {
        setQuestion("");
        setOptions(["", ""]);
        setDuration(null);
        setStartImmediately(true);
      }
    } catch (err) {
      console.error("Error creating poll:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <h2 className="text-2xl font-light text-white mb-8">Create Poll</h2>

        {externalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{externalError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                + Add option
              </button>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
              Duration (optional)
            </label>
            <div className="flex gap-2">
              {[1, 2, 5, 10, null].map((mins) => (
                <button
                  key={mins ?? "none"}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm transition-all",
                    duration === mins
                      ? "bg-white text-black"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  )}
                >
                  {mins ? `${mins}m` : "No limit"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStartImmediately(!startImmediately)}
              className={cn(
                "w-5 h-5 rounded border transition-all flex items-center justify-center",
                startImmediately
                  ? "bg-white border-white"
                  : "border-white/20 bg-transparent"
              )}
            >
              {startImmediately && (
                <svg
                  className="w-3 h-3 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
            <span className="text-sm text-gray-400">Start poll immediately</span>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !question.trim() ||
              options.filter((o) => o.trim()).length < 2
            }
            className="w-full py-4 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Creating..." : "Create Poll"}
          </button>
        </form>
      </div>
    </div>
  );
}
