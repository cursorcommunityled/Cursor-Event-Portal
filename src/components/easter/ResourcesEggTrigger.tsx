"use client";

import { Info } from "lucide-react";

const EASTER_EVENT_SLUG = "calgary-march-2026";

export function ResourcesEggTrigger({ eventSlug }: { eventSlug: string }) {
  if (eventSlug !== EASTER_EVENT_SLUG) return null;

  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("egg-found", { detail: { eggId: "egg_2" } })
    );
  };

  return (
    <div className="space-y-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center gap-4 px-2">
        <p className="text-[10px] font-medium text-gray-700 uppercase tracking-[0.4em]">
          About
        </p>
        <div className="h-[1px] flex-1 bg-white/[0.03]" />
      </div>

      <div className="space-y-4">
        <button className="block group w-full text-left" onClick={handleClick}>
          <div className="glass rounded-[32px] p-6 flex items-center gap-6 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/10 hover:translate-x-1 border-white/[0.03] relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.02)]">
              <Info className="w-6 h-6 stroke-[1.5px] opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-light text-white tracking-tight">About Cursor</h3>
              <p className="text-xs text-gray-600 font-light mt-1 tracking-wide">Learn about the team behind Cursor</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
