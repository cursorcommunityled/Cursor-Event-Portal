"use client";

import { Shield, Star } from "lucide-react";
import type { ChatMember } from "@/types";
import { Avatar } from "./Avatar";

export function MemberCard({ member }: { member: ChatMember }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/80 p-5 w-64 space-y-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] z-50 backdrop-blur-3xl">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:15px_15px]" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-[40px]" />
      
      <div className="relative flex items-center gap-4">
        <div className="ring-1 ring-white/15 rounded-2xl shadow-lg">
          <Avatar member={member} size="md" />
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-bold truncate text-white tracking-tight">{member.name}</p>
          {member.role === "admin" || member.role === "staff" || member.role === "facilitator" ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1 drop-shadow-md">
              <Shield className="w-3 h-3" /> Admin
            </span>
          ) : member.team_role === "leader" ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400 flex items-center gap-1 drop-shadow-md">
              <Star className="w-3 h-3" /> Team Lead
            </span>
          ) : null}
        </div>
      </div>
      {member.team && (
        <div className="relative border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="ring-1 ring-white/15 rounded-2xl shadow-sm">
            <Avatar member={member} size="sm" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Team</p>
            <p className="text-[14px] font-bold text-gray-200 truncate mt-0.5">{member.team.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}