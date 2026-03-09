"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, Trash2, Send, CalendarClock, X, Clock } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { formatTime as formatTimeWithTZ, cn } from "@/lib/utils";
import {
  getScheduledItems,
  createScheduledAnnouncement,
  cancelScheduledItem,
} from "@/lib/actions/scheduling";
import type { Event, Announcement, ScheduledItem } from "@/types";

interface AnnouncementsClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  initialAnnouncements: Announcement[];
  isEmbedded?: boolean;
}

export function AnnouncementsClient({
  event,
  eventSlug,
  adminCode,
  initialAnnouncements,
  isEmbedded = false,
}: AnnouncementsClientProps) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [newContent, setNewContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Scheduling
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!adminCode) return;
    getScheduledItems(event.id, adminCode).then(setScheduledItems);
  }, [event.id, adminCode]);

  const handlePublish = async () => {
    if (!newContent.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/announcements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(adminCode ? { "x-admin-code": adminCode, "x-event-id": event.id } : {}),
          },
          body: JSON.stringify({ eventId: event.id, content: newContent.trim() }),
        });

        if (response.ok) {
          const newAnnouncement = await response.json();
          setAnnouncements((prev) => [newAnnouncement, ...prev]);
          setNewContent("");
          router.refresh();
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to publish" }));
          setError(errorData.error || "Failed to publish announcement");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  const handleDelete = async (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/announcements/${id}`, {
          method: "DELETE",
          headers: adminCode ? { "x-admin-code": adminCode, "x-event-id": event.id } : undefined,
        });
        if (response.ok) {
          setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          router.refresh();
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to delete" }));
          setError(errorData.error || "Failed to delete announcement");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  const handleSchedule = async (content: string, scheduledAt: string) => {
    if (!adminCode) return;
    const result = await createScheduledAnnouncement(event.id, adminCode, content, scheduledAt);
    if (result.success && result.item) {
      setScheduledItems((prev) => [...prev, result.item!].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ));
      setShowScheduleModal(false);
    } else {
      setError(result.error || "Failed to schedule announcement");
    }
  };

  const handleCancelScheduled = async (itemId: string) => {
    if (!adminCode) return;
    const result = await cancelScheduledItem(itemId, event.id, adminCode);
    if (result.success) {
      setScheduledItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  const formatTime = (date: string) =>
    formatTimeWithTZ(date, event.timezone || "America/Edmonton");

  const content = (
    <main className={cn("max-w-2xl mx-auto px-6 py-12 space-y-12 animate-fade-in", isEmbedded && "py-0")}>
      {error && (
        <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Draft / Broadcast Now */}
      <div className="glass rounded-[40px] p-10 space-y-8 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
            Draft Message
          </p>
          <Megaphone className="w-4 h-4 text-white/10" />
        </div>

        <div className="space-y-6">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What needs to be heard?"
            rows={2}
            className="w-full bg-transparent border-b border-white/10 rounded-none py-4 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-2xl font-light leading-tight resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={handlePublish}
              disabled={isPending || !newContent.trim()}
              className="flex-1 h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3"
            >
              <Send className="w-3.5 h-3.5" />
              {isPending ? "..." : "Broadcast Now"}
            </button>

            {adminCode && (
              <button
                onClick={() => setShowScheduleModal(true)}
                disabled={!newContent.trim()}
                className="h-14 px-6 rounded-full bg-white/5 border border-white/10 text-gray-400 font-medium uppercase tracking-[0.15em] text-[10px] hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scheduled Queue */}
      {scheduledItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-2">
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
              Scheduled
            </p>
            <div className="h-[1px] flex-1 bg-white/[0.03]" />
          </div>
          <div className="space-y-3">
            {scheduledItems.map((item) => (
              <div
                key={item.id}
                className="glass rounded-[28px] p-6 border-white/[0.04] flex items-center gap-4"
              >
                <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-light truncate">{item.content}</p>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-[0.2em] mt-1">
                    {new Date(item.scheduled_at).toLocaleString()}
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
        </div>
      )}

      {/* History */}
      <div className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
            History
          </p>
          <div className="h-[1px] flex-1 bg-white/[0.03]" />
        </div>

        {announcements.length === 0 ? (
          <div className="text-center py-24 glass rounded-[40px] border-dashed border-white/5 opacity-40">
            <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
              Silence is golden
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="glass rounded-[32px] p-8 border-white/[0.03] bg-white/[0.01] transition-all duration-500 animate-slide-up group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <p className="text-lg font-light text-white leading-relaxed tracking-tight">
                      {announcement.content}
                    </p>
                    <p className="text-[9px] text-gray-700 uppercase tracking-[0.3em] font-medium">
                      Published {formatTime(announcement.published_at!)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    disabled={isPending}
                    className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center group/btn"
                  >
                    <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );

  return (
    <>
      {isEmbedded ? (
        content
      ) : (
        <div className="min-h-screen bg-black-gradient text-white pb-20">
          <AdminHeader eventSlug={event.slug} subtitle="Announcements" />
          {content}
          <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
            <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Bulletin</p>
          </footer>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          content={newContent}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleSchedule}
        />
      )}
    </>
  );
}

function ScheduleModal({
  content,
  onClose,
  onSchedule,
}: {
  content: string;
  onClose: () => void;
  onSchedule: (content: string, scheduledAt: string) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);

  // Default to 30 min from now
  useEffect(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(local);
  }, []);

  const handleSubmit = async () => {
    if (!scheduledAt) return;
    setLoading(true);
    await onSchedule(content, new Date(scheduledAt).toISOString());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 animate-slide-up space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div>
          <h2 className="text-2xl font-light text-white">Schedule Broadcast</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mt-1">
            Will be sent automatically at the chosen time
          </p>
        </div>

        <div className="glass rounded-[20px] p-5 border-white/5">
          <p className="text-sm text-gray-400 font-light leading-relaxed">"{content}"</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Send At
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !scheduledAt}
          className="w-full py-4 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Scheduling..." : "Confirm Schedule"}
        </button>
      </div>
    </div>
  );
}
