"use client";

import { cn } from "@/lib/utils";
import { TeamIcon } from "@/components/hackathon/TeamIcon";
import type { ChatMember } from "@/types";

export function Avatar({
  member, size = "sm",
}: {
  member: Pick<ChatMember, "id" | "name" | "team"> | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-10 h-10" : "w-12 h-12";
  const font = size === "sm" ? "text-[14px]" : "text-[16px]";

  if (member?.team) {
    return (
      <TeamIcon
        photo={member.team.icon_photo}
        name={member.team.name}
        className={cn(dim, "rounded-2xl bg-white/5 ring-1 ring-white/10")}
        fallbackClassName="opacity-20"
        sizes={size === "sm" ? "40px" : "48px"}
      />
    );
  }

  // Initials fallback — colour derived from name
  const initials = member?.name
    ? member.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const hue = member?.name
    ? [...member.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    : 200;

  return (
    <div
      className={cn(dim, "rounded-2xl shrink-0 flex items-center justify-center text-white font-semibold shadow-inner", font)}
      style={{ 
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${hue}, 70%, 20%))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2)`
      }}
    >
      {initials}
    </div>
  );
}
