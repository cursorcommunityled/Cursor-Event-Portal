"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  UserPlus,
  Check,
  Loader2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface Attendee {
  id: string;
  name: string;
  email: string | null;
}

interface AttendeeCheckinFormProps {
  eventId: string;
  eventSlug: string;
  seatingEnabled?: boolean;
  isHackathon?: boolean;
}

type Step = "email" | "confirm" | "guest" | "submitting";


export function AttendeeCheckinForm({
  eventId,
  eventSlug,
  seatingEnabled = false,
  isHackathon = false,
}: AttendeeCheckinFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
  const [checkInToken, setCheckInToken] = useState<string | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [bringingGuest, setBringingGuest] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  const [pendingTableNumber, setPendingTableNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!seatingEnabled) {
      setPendingTableNumber(null);
      return;
    }

    const tableParam = searchParams.get("table");
    if (!tableParam) return;
    const parsed = Number.parseInt(tableParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setPendingTableNumber(parsed);
    }
  }, [searchParams, seatingEnabled]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      if (hasCheckedSession) return;
      setHasCheckedSession(true);

      setIsLooking(true);
      try {
        // Try to lookup registration using session (no email provided)
        const response = await fetch("/api/lookup-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });

        const data = await response.json();

        if (data.found) {
          const token = data.checkInToken ?? null;
          setCheckInToken(token);
          // Pre-fill email if available
          if (data.attendee.email) {
            setEmail(data.attendee.email);
          }
          if (token) {
            setFoundAttendee(data.attendee);
            setAlreadyCheckedIn(data.alreadyCheckedIn || false);
            setStep("confirm");
          }
        }
        // If not found, silently continue - user can enter email manually
      } catch (err) {
        // Silently fail - user can enter email manually
      } finally {
        setIsLooking(false);
      }
    };

    checkSession();
  }, [eventId, hasCheckedSession]);

  const handleEmailLookup = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLooking(true);
    setError("");

    try {
      const response = await fetch("/api/lookup-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: email.trim() }),
      });

      const data = await response.json();

      if (!data.found) {
        setCheckInToken(null);
        setError(
          "No registration found for this email. Please use your Luma registration email."
        );
        setIsLooking(false);
        return;
      }

      setFoundAttendee(data.attendee);
      setCheckInToken(data.checkInToken ?? null);
      setAlreadyCheckedIn(data.alreadyCheckedIn || false);
      setStep("confirm");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLooking(false);
    }
  };

  const registerTableFromQr = async () => {
    if (!seatingEnabled || !pendingTableNumber) return;
    try {
      const response = await fetch("/api/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          tableNumber: pendingTableNumber,
        }),
      });

      if (response.ok) {
        setPendingTableNumber(null);
      }
    } catch (err) {
      console.error("[AttendeeCheckinForm] QR check-in failed:", err);
    }
  };

  const handleConfirm = async () => {
    if (!foundAttendee) return;
    if (!checkInToken) {
      setError("Please look up your registration again.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          attendeeId: foundAttendee.id,
          guest: null,
          // Session only — venue check-in comes from Luma scan / staff.
          skipCheckIn: true,
          checkInToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Sign-in failed");
        setIsSubmitting(false);
        return;
      }

      await registerTableFromQr();

      router.push(isHackathon ? `/${eventSlug}/hackathon` : `/${eventSlug}/agenda`);
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!foundAttendee) return;
    if (!checkInToken) {
      setError("Please look up your registration again.");
      return;
    }

    // Validate guest info if bringing someone
    if (bringingGuest && !guestName.trim()) {
      setError("Please enter your guest's name");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          attendeeId: foundAttendee.id,
          guest: bringingGuest
            ? { name: guestName.trim(), email: guestEmail.trim() || null }
            : null,
          skipCheckIn: true,
          checkInToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Check-in failed");
        setIsSubmitting(false);
        return;
      }

      await registerTableFromQr();

      router.push(isHackathon ? `/${eventSlug}/hackathon` : `/${eventSlug}/agenda`);
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === "email" && !isLooking) {
      handleEmailLookup();
    }
  };


  // Step 1: Email input
  if (step === "email") {
    return (
      <div className="glass rounded-[40px] p-10 border-white/20 shadow-2xl relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-bold">
              Cursor Calgary Portal
            </p>
            <p className="text-gray-500 text-sm font-light">
              Enter your Luma registration email to access the portal ahead of the event
            </p>
          </div>

          <div className="relative group">
            <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700 group-focus-within:text-white transition-colors" />
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full bg-transparent border-b border-white/10 rounded-none pl-10 pr-4 h-14 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/30 transition-all text-xl font-light"
              autoFocus
              autoComplete="email"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/80 animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-light">{error}</p>
            </div>
          )}

          <button
            onClick={handleEmailLookup}
            disabled={isLooking || !email.trim()}
            className="w-full h-16 rounded-[32px] bg-white text-black hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            {isLooking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="text-sm font-bold uppercase tracking-[0.2em]">
                Find My Registration
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Confirm identity
  if (step === "confirm" && foundAttendee) {
    return (
      <div className="glass rounded-[40px] p-10 border-white/20 shadow-2xl relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="space-y-8 animate-fade-in">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-bold">
                Registration Found
              </p>
              <p className="text-2xl font-light text-white leading-tight">
                {foundAttendee.name}
              </p>
              {alreadyCheckedIn && (
                <p className="text-green-400/80 text-sm font-light">
                  Already signed in
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/80 animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-light">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full h-16 rounded-[32px] bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="text-sm font-bold uppercase tracking-[0.2em]">
                  {alreadyCheckedIn ? "Continue" : "Yes, That's Me"}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setStep("email");
                setFoundAttendee(null);
                setError("");
              }}
              disabled={isSubmitting}
              className="w-full h-12 rounded-[24px] border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              <span className="text-xs font-medium uppercase tracking-[0.15em]">
                Try Different Email
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Guest question
  if (step === "guest") {
    return (
      <div className="glass rounded-[40px] p-10 border-white/20 shadow-2xl relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="space-y-10 animate-fade-in">
          {/* Selected attendee - Ultra minimal */}
          <div className="flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-bold">
                Entering as
              </p>
              <p className="text-2xl font-light text-white leading-tight">
                {foundAttendee?.name}
              </p>
            </div>
            <button
              onClick={() => {
                setFoundAttendee(null);
                setStep("email");
                setBringingGuest(null);
              }}
              className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-gray-600 hover:text-white hover:border-white/20 transition-all"
            >
              <ChevronRight className="w-4 h-4 rotate-180 -translate-x-0.5" />
            </button>
          </div>

          {/* Guest question - Minimal buttons */}
          {bringingGuest === null && (
            <div className="space-y-8 py-4">
              <p className="text-center text-xs font-light tracking-[0.2em] text-gray-500 uppercase">
                Bringing a guest?
              </p>
              <div className="grid grid-cols-2 gap-6">
                <button
                  className="group relative aspect-square rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all overflow-hidden"
                  onClick={() => setBringingGuest(false)}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 group-hover:scale-110 transition-transform">
                    <span className="text-xl font-light text-white/40 group-hover:text-white transition-colors">
                      No
                    </span>
                    <span className="text-[8px] uppercase tracking-[0.3em] text-gray-700 group-hover:text-gray-500">
                      Just Me
                    </span>
                  </div>
                </button>
                <button
                  className="group relative aspect-square rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all overflow-hidden"
                  onClick={() => setBringingGuest(true)}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 group-hover:scale-110 transition-transform">
                    <UserPlus className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
                    <span className="text-[8px] uppercase tracking-[0.3em] text-gray-700 group-hover:text-gray-500">
                      Plus One
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Guest form - Simplified */}
          {bringingGuest === true && (
            <div className="space-y-6 animate-slide-up">
              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 rounded-none px-0 h-14 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/30 transition-all text-lg font-light"
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Guest Email (Optional)"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 rounded-none px-0 h-14 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/30 transition-all text-lg font-light"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-center p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/80 text-[10px] font-medium uppercase tracking-widest animate-fade-in">
              {error}
            </div>
          )}

          {/* Submit button - Ultra sleek white/black */}
          {bringingGuest !== null && (
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-16 rounded-[32px] bg-white text-black hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-sm font-bold uppercase tracking-[0.2em]">
                    Enter Portal
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

