"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMember } from "@/types";

export function Avatar({
  member, size = "sm",
}: {
  member: Pick<ChatMember, "id" | "name" | "team"> | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-10 h-10" : "w-12 h-12";
  const font = size === "sm" ? "text-[14px]" : "text-[16px]";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  const photo = member?.team?.icon_photo;
  if (photo?.status === "approved" && photo.file_url) {
    return (
      <div className={cn(dim, "rounded-2xl overflow-hidden shrink-0 relative bg-white/5 ring-1 ring-white/10")}>
        <Image src={photo.file_url} alt={member!.team!.name} fill className="object-cover" sizes="48px" />
      </div>
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
      {member?.team?.icon_photo ? (
        <ImageIcon className={cn(iconDim, "text-white/50")} />
      ) : (
        initials
      )}
    </div>
  );
}