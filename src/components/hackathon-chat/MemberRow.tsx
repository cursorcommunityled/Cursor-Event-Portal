"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Shield } from "lucide-react";
import type { ChatMember } from "@/types";
import { Avatar } from "./Avatar";
import { MemberCard } from "./MemberCard";

export function MemberRow({
  member,
  onOpenProfile,
}: {
  member: ChatMember;
  onOpenProfile: (member: ChatMember) => void;
}) {
  const [showCard, setShowCard] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (showCard && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const cardWidth = 256; // w-64
      const cardHeight = 240; // estimated max height
      
      // Sidebar is on the right, so open to the left by default
      let left = rect.left - cardWidth - 12;
      
      // Fallback if not enough space on left
      if (left < 16) {
        left = rect.right + 12;
      }
      
      let top = rect.top;
      // Adjust if overflowing bottom
      if (top + cardHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - cardHeight - 16);
      }

      setCardPos({ top, left });
    }
  }, [showCard]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="relative flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.06] transition-all duration-200 cursor-pointer group text-left"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
      onClick={() => onOpenProfile(member)}
    >
      <div className="ring-1 ring-white/15 rounded-2xl shadow-sm">
        <Avatar member={member} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-100 truncate group-hover:text-white transition-colors">{member.name}</p>
        {member.team_role === "leader" && (
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-yellow-300">Lead</span>
        )}
      </div>
      {(member.role === "admin" || member.role === "staff" || member.role === "facilitator") && (
        <Shield className="w-4 h-4 text-red-200 shrink-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
      )}
      {showCard && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed z-[100] pointer-events-none" 
          style={{ top: cardPos.top, left: cardPos.left }}
        >
          <MemberCard member={member} />
        </div>,
        document.body
      )}
    </button>
  );
}