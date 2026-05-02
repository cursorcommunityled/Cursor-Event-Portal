"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Event, Announcement } from "@/types";
import { ArrowLeft, Megaphone, Trash2, Send } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { formatTime as formatTimeWithTZ, cn } from "@/lib/utils";

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

  const handlePublish = async () => {
    if (!newContent.trim()) return;

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/announcements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(adminCode
              ? {
                  "x-admin-code": adminCode,
                  "x-event-id": event.id,
                }
              : {}),
          },
          body: JSON.stringify({
            eventId: event.id,
            content: newContent.trim(),
          }),
        });

        if (response.ok) {
          const newAnnouncement = await response.json();
          setAnnouncements((prev) => [newAnnouncement, ...prev]);
          setNewContent("");
          router.refresh();
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to publish announcement" }));
          setError(errorData.error || "Failed to publish announcement");
          console.error("Publish announcement error:", errorData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        console.error("Publish announcement exception:", err);
      }
    });
  };

  const handleDelete = async (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/announcements/${id}`, {
          method: "DELETE",
          headers: adminCode
            ? {
                "x-admin-code": adminCode,
                "x-event-id": event.id,
              }
            : undefined,
        });

        if (response.ok) {
          setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          router.refresh();
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to delete announcement" }));
          setError(errorData.error || "Failed to delete announcement");
          console.error("Delete announcement error:", errorData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        console.error("Delete announcement exception:", err);
      }
    });
  };

  const formatTime = (date: string) => {
    return formatTimeWithTZ(date, event.timezone || "America/Edmonton");
  };

  const content = (
    <main className={cn("max-w-2xl mx-auto px-6 py-12 space-y-12 animate-fade-in", isEmbedded && "py-0")}>
      {/* Error Message */}
      {error && (
        <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* New Announcement - Floating Box */}
      <div className="glass rounded-[40px] p-10 space-y-8 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
            Draft Message
          </p>
          <Megaphone className="w-4 h-4 text-white/10" />
        </div>

        <div className="space-y-10">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What needs to be heard?"
            rows={2}
            className="w-full bg-transparent border-b border-white/10 rounded-none py-4 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-2xl font-light leading-tight resize-none"
          />
          
          <button
            onClick={handlePublish}
            disabled={isPending || !newContent.trim()}
            className="w-full h-16 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3"
          >
            <Send className="w-3.5 h-3.5" />
            {isPending ? "..." : "Broadcast Now"}
          </button>
        </div>
      </div>

      {/* Previous Announcements */}
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

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader 
        eventSlug={event.slug} 
        subtitle="Announcements" 
      />

      {content}

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Bulletin</p>
        </div>
      </footer>
    </div>
  );
}
