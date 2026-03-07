"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, X, Check, CheckCheck, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { InAppNotification } from "@/types";

const TYPE_ICONS: Record<string, string> = {
  poll_opened:          "📊",
  table_assigned:       "🪑",
  demo_slot_available:  "🎯",
  survey_live:          "📋",
  announcement:         "📣",
};

interface NotificationBellProps {
  userId: string;
  eventId: string;
  eventSlug: string;
}

export function NotificationBell({ userId, eventId, eventSlug }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getMyNotifications(userId, eventId);
    setNotifications(data);
    setLoading(false);
  }, [userId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time subscription for new notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "in_app_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as InAppNotification;
          if (newNotif.event_id === eventId) {
            setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, eventId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    await markNotificationRead(id, userId);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    await markAllNotificationsRead(userId, eventId);
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-2xl border transition-all",
          open
            ? "bg-white/10 border-white/20 text-white"
            : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06]"
        )}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 glass rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-slide-up z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-700 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-700">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Bell className="w-6 h-6 text-gray-800 mx-auto mb-2" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-700">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-3.5 border-b border-white/[0.03] transition-all group",
                    !n.read_at && "bg-white/[0.02]"
                  )}
                >
                  <span className="text-base shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-snug",
                      n.read_at ? "text-gray-500" : "text-white font-medium"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[9px] text-gray-700 mt-1">{formatTime(n.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.action_url && (
                      <Link
                        href={n.action_url}
                        onClick={() => { handleMarkRead(n.id); setOpen(false); }}
                        className="p-1 text-gray-700 hover:text-white transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    {!n.read_at && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1 text-gray-700 hover:text-green-400 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/[0.03] flex items-center justify-between">
            <Link
              href={`/${eventSlug}/notifications`}
              onClick={() => setOpen(false)}
              className="text-[9px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
            >
              Preferences
            </Link>
            <Link
              href={`/${eventSlug}/notifications`}
              onClick={() => setOpen(false)}
              className="text-[9px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
