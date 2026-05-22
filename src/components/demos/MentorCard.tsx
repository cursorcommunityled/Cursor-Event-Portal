import Link from "next/link";
import type { Mentor } from "@/types";

interface MentorCardProps {
  mentor: Mentor;
  eventSlug: string;
  availableSlots: number;
  isBooked: boolean;
}

export function MentorCard({ mentor, eventSlug, availableSlots, isBooked }: MentorCardProps) {
  const isInPerson = mentor.mentorship_mode === "in_person" || mentor.mentorship_mode === "hybrid";
  const modeLabel = mentor.mentorship_mode === "in_person"
    ? "In Person"
    : mentor.mentorship_mode === "hybrid"
      ? "Hybrid"
      : "Virtual";
  const availabilityText = availableSlots > 0
    ? `${availableSlots} slot${availableSlots !== 1 ? "s" : ""} available`
    : isInPerson
      ? "In-person details available"
      : "No slots available";

  return (
    <Link href={`/${eventSlug}/sessions/mentors/${mentor.id}`} className="group block h-full">
      <div className="glass rounded-[24px] p-5 border-white/10 hover:border-white/25 transition-all cursor-pointer space-y-4 h-full">
        <div className="flex items-start gap-4">
          {mentor.photo_url ? (
            <img
              src={mentor.photo_url}
              alt={mentor.name}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-light text-white flex-shrink-0">
              {mentor.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug">{mentor.name}</p>
            {mentor.title && <p className="text-xs text-gray-400 mt-0.5">{mentor.title}</p>}
            {mentor.company && <p className="text-xs text-gray-500">{mentor.company}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/10">
              {modeLabel}
            </span>
            {isBooked && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                Booked
              </span>
            )}
          </div>
        </div>

        {mentor.bio && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{mentor.bio}</p>
        )}

        {isInPerson && (mentor.in_person_schedule || mentor.in_person_location) && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
            {mentor.in_person_schedule && (
              <p className="text-xs text-gray-400">{mentor.in_person_schedule}</p>
            )}
            {mentor.in_person_location && (
              <p className="text-xs text-gray-500">{mentor.in_person_location}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-gray-600">
            {availabilityText}
          </p>
          <span className="text-[10px] uppercase tracking-[0.15em] text-gray-500 group-hover:text-gray-300">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
