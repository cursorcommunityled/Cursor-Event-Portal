"use client";

import { cn } from "@/lib/utils";

interface EventSubNavProps {
  activeTab: "schedule" | "themes" | "credits";
  onTabChange: (tab: "schedule" | "themes" | "credits") => void;
  isHackathon?: boolean;
}

const TABS = [
  { id: "schedule" as const, label: "Schedule" },
  { id: "themes"   as const, label: "Themes" },
  { id: "credits"  as const, label: "Credits" },
];

export function EventSubNav({ activeTab, onTabChange, isHackathon }: EventSubNavProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.id === "themes" && isHackathon;
        
        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              "px-6 py-3 rounded-full transition-all duration-300 text-sm font-medium",
              isActive && !isDisabled
                ? "bg-white text-black shadow-glow scale-105"
                : isDisabled
                  ? "bg-white/5 text-gray-700 cursor-not-allowed opacity-50"
                  : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
