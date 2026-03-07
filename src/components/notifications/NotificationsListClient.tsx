"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { InAppNotification } from "@/types";

const TYPE_ICONS: Record<string, string> = {
  poll_opened:          "📊",
  table_assigned:       "🪑",
  demo_slot_available:  "🎯",
  survey_live:          "📋",
  announcement:         "📣",
};

interface Props {
  userId: string;
  eventId: string;
  initialNotifications: InAppNotification[];
}

export function NotificationsListClient({ userId, eventId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const unread = notifications.filter((n) => !n.read_at).length;

  // Real-time: append new notifications as they arrive
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notif-page-${userId}-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "in_app_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as InAppNotification;
          if (n.event_id === eventId) {
            setNotifications((prev) => [n, ...prev]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, eventId]);

  const handleRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    await markNotificationRead(id, userId);
  };

  const handleReadAll = async () => {
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
    <div className="glass rounded-[40px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.04]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 && (
          <button
            onClick={handleReadAll}
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
          >
            <CheckCheck className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <Bell className="w-8 h-8 text-gray-800 mx-auto mb-3" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-700">
            Nothing yet — you&apos;ll be notified when something happens
          </p>
        </div>
      ) : (
        <div>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 px-8 py-5 border-b border-white/[0.03] last:border-0 transition-all animate-slide-up",
                !n.read_at && "bg-white/[0.02]"
              )}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", n.read_at ? "text-gray-500" : "text-white font-medium")}>
                  {n.title}
                </p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-gray-700 mt-2 uppercase tracking-[0.15em]">
                  {formatTime(n.created_at)}
                </p>
              </div>
              {!n.read_at && (
                <button
                  onClick={() => handleRead(n.id)}
                  className="p-2 rounded-xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-green-400 hover:border-green-400/20 transition-all shrink-0"
                  title="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
