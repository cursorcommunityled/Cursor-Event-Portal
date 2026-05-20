"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { UserRound, X, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { HackathonProfile } from "@/types";
import { HackathonProfileEditor } from "@/components/hackathon/HackathonProfileEditor";
import { logoutAttendee } from "@/lib/actions/logout";

interface Props {
  eventId: string;
  eventSlug: string;
  initialProfile: HackathonProfile | null;
  userName?: string;
}

export function HackathonProfileButton({ eventId, eventSlug, initialProfile, userName }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const router = useRouter();

  const isProfileIncomplete = !initialProfile?.occupation || !initialProfile?.linkedin_url;

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

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await logoutAttendee();
      router.push(`/${eventSlug}`);
      router.refresh();
    });
  };

  return (
    <div className="relative flex flex-col items-center gap-1" ref={panelRef}>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "relative flex items-center justify-center w-10 h-10 rounded-[14px] border transition-all duration-300",
            open
              ? "bg-white/10 text-white shadow-inner border-white/20"
              : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06] backdrop-blur-md"
          )}
          title="My Profile"
        >
          <UserRound className="w-4 h-4" />
          
          {isProfileIncomplete && (
            <div className="absolute -right-4 -top-2 flex h-5 w-max items-center justify-center whitespace-nowrap rounded-full bg-white px-2 text-[10px] font-black leading-none text-black shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-bounce">
              Set up!
            </div>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-3 w-screen max-w-[min(90vw,600px)] z-50">
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:p-6 origin-top-right animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-300">
                  {userName ? `${userName.split(' ')[0]}'s Profile` : "My Hackathon Profile"}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto scrollbar-hide -mx-2 px-2 pb-2">
                <HackathonProfileEditor
                  eventId={eventId}
                  initialProfile={initialProfile}
                  userName={userName}
                  onSaved={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex items-center gap-1 text-[8px] uppercase tracking-[0.18em] text-gray-700 hover:text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-wait mt-1"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="w-2.5 h-2.5" />
        Logout
      </button>
    </div>
  );
}
