"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { checkIn, undoCheckIn, deregister, addRegistrationByEmail, clearEventRegistrations, saveRegistrationList } from "@/lib/actions/registration";
import type { Event, Registration, AgendaItem } from "@/types";
import { Search, UserCheck, UserX, Users, Clock, ArrowLeft, Trash2, Save } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AttendeeDetailModal } from "@/components/admin/AttendeeDetailModal";
import { EventStatusBar } from "@/components/staff/EventStatusBar";

interface CheckInClientProps {
  event: Event;
  eventSlug: string;
  adminCode?: string;
  initialRegistrations: Registration[];
  stats: { registered: number; checkedIn: number };
  initialAgendaItems: AgendaItem[];
  embedded?: boolean;
}

// Helper to get human-readable labels for signals
const SIGNAL_LABELS: Record<string, string> = {
  "learn-ai": "Learn AI/ML",
  "learn-coding": "Coding",
  "networking": "Networking",
  "find-cofounders": "Co-founders",
  "hire-talent": "Hire",
  "find-job": "Job Search",
  "explore-tools": "Tools",
  "ai-expertise": "AI/ML",
  "software-dev": "Dev",
  "design": "Design",
  "business-strategy": "Strategy",
  "funding-investment": "Funding",
  "mentorship": "Mentor",
  "collaboration": "Collab",
};

export function CheckInClient({
  event,
  eventSlug,
  adminCode,
  initialRegistrations,
  stats,
  initialAgendaItems,
  embedded,
}: CheckInClientProps) {
  // Determine back link based on whether we have adminCode
  const backLink = adminCode
    ? `/admin/${eventSlug}/${adminCode}`
    : `/admin/${eventSlug}`;
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeregisterId, setConfirmDeregisterId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<{
    userId: string;
    userName: string;
    userEmail: string | null;
  } | null>(null);
  const [isSavingList, setIsSavingList] = useState(false);
  const [saveListStatus, setSaveListStatus] = useState<"idle" | "success" | "error">("idle");

  const filteredRegistrations = registrations.filter((reg) => {
    const query = searchQuery.toLowerCase();
    return (
      reg.user?.name.toLowerCase().includes(query) ||
      reg.user?.email?.toLowerCase().includes(query)
    );
  });

  const checkedInCount = registrations.filter((r) => r.checked_in_at).length;

  const handleCheckIn = async (registrationId: string) => {
    setActiveId(registrationId);
    setError(null);
    startTransition(async () => {
      try {
        const result = await checkIn(registrationId, event.slug);
        if (result.success) {
          setRegistrations((prev) =>
            prev.map((r) =>
              r.id === registrationId
                ? { ...r, checked_in_at: new Date().toISOString() }
                : r
            )
          );
        } else {
          setError(result.error || "Failed to check in");
          console.error("Check-in failed:", result.error);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        console.error("Check-in exception:", err);
      } finally {
        setActiveId(null);
      }
    });
  };

  const handleUndoCheckIn = async (registrationId: string) => {
    console.log("handleUndoCheckIn called for registration:", registrationId);
    setActiveId(registrationId);
    setError(null);
    startTransition(async () => {
      try {
        console.log("Calling undoCheckIn function...");
        const result = await undoCheckIn(registrationId, event.slug);
        console.log("undoCheckIn result:", result);
        if (result.success) {
          setRegistrations((prev) =>
            prev.map((r) =>
              r.id === registrationId ? { ...r, checked_in_at: null } : r
            )
          );
          console.log("Successfully updated local state");
        } else {
          setError(result.error || "Failed to undo check-in");
          console.error("Undo check-in failed:", result.error);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        console.error("Undo check-in exception:", err);
      } finally {
        setActiveId(null);
      }
    });
  };

  const handleDeregister = async (registrationId: string) => {
    setActiveId(registrationId);
    setError(null);
    startTransition(async () => {
      try {
        const result = await deregister(registrationId, event.slug);
        if (result.success) {
          setRegistrations((prev) =>
            prev.filter((r) => r.id !== registrationId)
          );
          setConfirmDeregisterId(null);
        } else {
          setError(result.error || "Failed to deregister");
          console.error("Deregister failed:", result.error);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        console.error("Deregister exception:", err);
      } finally {
        setActiveId(null);
      }
    });
  };

  const handleAddRegistration = async () => {
    if (!addEmail.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const result = await addRegistrationByEmail(event.id, event.slug, addEmail);
      if (result.success && result.registration) {
        setRegistrations((prev) => {
          const exists = prev.some((r) => r.id === result.registration.id);
          if (exists) return prev;
          return [result.registration, ...prev];
        });
        setAddEmail("");
      } else {
        setError(result.error || "Failed to add registration");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveList = async () => {
    setIsSavingList(true);
    setSaveListStatus("idle");
    try {
      const result = await saveRegistrationList(event.id, event.slug, adminCode);
      setSaveListStatus(result.success ? "success" : "error");
      if (!result.success) setError(result.error || "Failed to save registration list");
    } catch {
      setSaveListStatus("error");
      setError("Failed to save registration list");
    } finally {
      setIsSavingList(false);
      setTimeout(() => setSaveListStatus("idle"), 3000);
    }
  };

  const handleClearAll = async () => {
    setError(null);
    setConfirmClearAll(false);
    startTransition(async () => {
      const result = await clearEventRegistrations(event.id, event.slug, adminCode);
      if (result.success) {
        setRegistrations([]);
        setSearchQuery("");
        setConfirmDeregisterId(null);
      } else {
        setError(result.error || "Failed to clear registrations");
      }
    });
  };

  const mainContent = (
    <div className="space-y-12 animate-fade-in">
        {/* Stats - Floating Grid */}
        <div className="grid grid-cols-2 gap-6">
          <div className="glass rounded-[32px] p-8 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">Registered</p>
            <p className="text-4xl font-light tracking-tighter">{registrations.length}</p>
          </div>

          <div className="glass rounded-[32px] p-8 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserCheck className="w-8 h-8" />
            </div>
            <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">Checked In</p>
            <p className="text-4xl font-light tracking-tighter text-white">{checkedInCount}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {/* Save Registration List */}
          <button
            onClick={handleSaveList}
            disabled={isSavingList || registrations.length === 0}
            className={cn(
              "w-full h-12 rounded-2xl border text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed",
              saveListStatus === "success"
                ? "bg-white/10 border-white/30 text-white"
                : saveListStatus === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingList
              ? "Saving..."
              : saveListStatus === "success"
              ? `Saved — ${registrations.length} registered, ${checkedInCount} checked in`
              : saveListStatus === "error"
              ? "Save Failed"
              : "Save Registration List"}
          </button>

          {/* Remove All */}
          {confirmClearAll ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearAll}
                disabled={isPending}
                className="flex-1 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {isPending ? "..." : "Confirm Remove All"}
              </button>
              <button
                onClick={() => setConfirmClearAll(false)}
                className="h-12 px-6 rounded-2xl bg-white/5 border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="w-full h-12 rounded-2xl bg-white/[0.02] border border-white/10 text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-red-500/30 hover:bg-red-500/10 transition-all"
            >
              Remove All
            </button>
          )}
        </div>

        {/* Event Status Bar */}
        <EventStatusBar 
          event={event}
          initialAgendaItems={initialAgendaItems}
          eventId={event.id}
        />

        {/* Capacity - Ultra Minimal */}
        <div className="glass rounded-[32px] p-8 space-y-6">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.4em] text-gray-700 px-1">
            <span>Venue Capacity</span>
            <span>{checkedInCount} / {event.capacity}</span>
          </div>
          <div className="h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min((checkedInCount / event.capacity) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 items-end">
          {/* Search - Focusable Border */}
          <div className="relative group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="Search attendees"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b border-white/10 rounded-none pl-10 pr-4 h-16 text-white placeholder:text-gray-800 focus:outline-none focus:border-white/30 transition-all text-2xl font-light"
            />
          </div>

          {/* Quick add */}
          <div className="glass rounded-[28px] p-4 border border-white/5 flex items-center gap-3">
            <input
              type="email"
              placeholder="Add attendee email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isAdding && addEmail.trim()) {
                  e.preventDefault();
                  handleAddRegistration();
                }
              }}
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 h-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-all text-sm font-light"
            />
            <button
              onClick={handleAddRegistration}
              disabled={isAdding || !addEmail.trim()}
              className="h-12 px-5 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAdding ? "..." : "Add"}
            </button>
          </div>
        </div>

        {/* Attendee List */}
        <div className="space-y-4">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-24 glass rounded-[40px] border-dashed border-white/5 opacity-40">
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
                {searchQuery ? "No results found" : "Waiting for entries"}
              </p>
            </div>
          ) : (
            filteredRegistrations.map((registration, index) => {
              const isCheckedIn = !!registration.checked_in_at;
              const isActive = activeId === registration.id;

              return (
                <div
                  key={registration.id}
                  className={cn(
                    "glass rounded-[32px] p-6 transition-all duration-500 animate-slide-up flex items-center justify-between gap-6 group relative overflow-hidden",
                    isCheckedIn ? "bg-white/[0.04] border-white/20" : "bg-white/[0.01] border-white/5"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={(e) => {
                    // Only open modal if clicking on the attendee info area, not action buttons
                    const target = e.target as HTMLElement;
                    if (!target.closest('button') && !target.closest('[data-action-area]')) {
                      if (registration.user?.id) {
                        setSelectedAttendee({
                          userId: registration.user.id,
                          userName: registration.user.name,
                          userEmail: registration.user.email || null,
                        });
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity relative z-10">
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-light transition-all border",
                          isCheckedIn
                            ? "bg-white border-white text-black"
                            : "bg-white/[0.02] border-white/5 text-gray-600"
                        )}
                      >
                        {registration.user?.name.charAt(0).toUpperCase()}
                      </div>
                      {registration.user?.role === "admin" && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">A</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-light text-white truncate tracking-tight">
                        {registration.user?.name}
                      </p>
                      <p className="text-[10px] text-gray-700 uppercase tracking-widest truncate font-medium mt-0.5">
                        {registration.user?.email || "No email"}
                      </p>
                    </div>
                  </div>

                  {/* Intake Signals Hover Overlay */}
                  {registration.user?.intakes?.[0] && !registration.user.intakes[0].skipped && (() => {
                    const goals = registration.user.intakes[0].goals?.filter(g => g !== 'other') || [];
                    const offers = registration.user.intakes[0].offers?.filter(o => o !== 'other') || [];
                    const hasOther = registration.user.intakes[0].goals_other || registration.user.intakes[0].offers_other;
                    const totalSignals = goals.length + offers.length + (hasOther ? 1 : 0);
                    const isCompact = totalSignals > 4;

                    return (
                    <div className="absolute left-0 top-0 bottom-0 right-[140px] bg-black/90 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center px-8 z-30 pointer-events-none rounded-l-[32px]">
                      <div className="flex flex-col gap-2 w-full">
                        {/* Keep name visible in overlay */}
                        <div className="flex items-center gap-3 mb-1">
                          <div className="relative shrink-0">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-base font-light transition-all border",
                                isCheckedIn
                                  ? "bg-white border-white text-black"
                                  : "bg-white/[0.1] border-white/20 text-white"
                              )}
                            >
                              {registration.user?.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-light text-white truncate tracking-tight">
                              {registration.user?.name}
                            </p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest truncate font-medium mt-0.5">
                              {registration.user?.email || "No email"}
                            </p>
                          </div>
                        </div>
                        <div className={cn("flex flex-wrap", isCompact ? "gap-1" : "gap-1.5")}>
                          <span className={cn("uppercase tracking-[0.2em] text-gray-500 w-full", isCompact ? "text-[8px] mb-0.5" : "text-[9px] mb-1")}>Attendee Signals</span>
                          {goals.map((goal) => (
                            <Badge key={goal} variant="outline" className={cn(
                              "bg-white/5 border-white/10 text-white uppercase tracking-wider rounded-full",
                              isCompact ? "text-[7px] py-0.5 px-2" : "text-[8px] py-0.5 px-2.5"
                            )}>
                              {SIGNAL_LABELS[goal] || goal}
                            </Badge>
                          ))}
                          {offers.map((offer) => (
                            <Badge key={offer} variant="outline" className={cn(
                              "bg-white/20 border-white/30 text-white uppercase tracking-wider rounded-full font-bold",
                              isCompact ? "text-[7px] py-0.5 px-2" : "text-[8px] py-0.5 px-2.5"
                            )}>
                              {SIGNAL_LABELS[offer] || offer}
                            </Badge>
                          ))}
                          {hasOther && (
                            <Badge variant="outline" className={cn(
                              "bg-white/5 border-white/10 text-white uppercase tracking-wider rounded-full italic",
                              isCompact ? "text-[7px] py-0.5 px-2" : "text-[8px] py-0.5 px-2.5"
                            )}>
                              Other
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                  <div className="flex items-center gap-2 relative z-20" data-action-area>
                    {/* Deregister confirmation or button */}
                    {confirmDeregisterId === registration.id ? (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <button
                          onClick={() => handleDeregister(registration.id)}
                          disabled={isPending && activeId === registration.id}
                          className="h-10 px-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          {isActive ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeregisterId(null)}
                          className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-500 text-[9px] font-bold uppercase tracking-[0.15em] hover:text-white transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Deregister button */}
                        <button
                          onClick={() => setConfirmDeregisterId(registration.id)}
                          disabled={isPending}
                          className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove registration"
                        >
                          <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        </button>

                        {isCheckedIn ? (
                          <button
                            onClick={() => {
                              console.log("Undo button clicked for:", registration.id);
                              handleUndoCheckIn(registration.id);
                            }}
                            disabled={isPending && activeId === registration.id}
                            className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-700 hover:text-orange-500 hover:border-orange-500/20 transition-all flex items-center justify-center group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo check-in"
                          >
                            <UserX className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(registration.id)}
                            disabled={isPending}
                            className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all shadow-xl"
                          >
                            {isActive ? "..." : "Check In"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
    </div>
  );

  const modal = selectedAttendee ? (
    <AttendeeDetailModal
      userId={selectedAttendee.userId}
      eventId={event.id}
      eventSlug={eventSlug}
      userName={selectedAttendee.userName}
      userEmail={selectedAttendee.userEmail}
      isOpen={!!selectedAttendee}
      onClose={() => setSelectedAttendee(null)}
    />
  ) : null;

  if (embedded) {
    return (
      <>
        {mainContent}
        {modal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <header className="sticky top-0 z-40 glass border-b border-white/5 backdrop-blur-3xl">
        <div className="max-w-2xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href={backLink} className="flex items-center gap-2 text-gray-600 hover:text-white transition-all group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Exit</span>
          </Link>
          <h1 className="text-sm font-bold uppercase tracking-[0.4em]">Check-In</h1>
          <div className="w-12" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        {mainContent}
      </main>
      {modal}
      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Check-In</p>
      </footer>
    </div>
  );
}
