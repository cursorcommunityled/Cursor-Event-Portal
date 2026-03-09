"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageCircle, HandHelping, Zap, Users2 } from "lucide-react";

interface SocialsSubNavProps {
  eventSlug: string;
}

const SUB_TABS = [
  { href: "qa", label: "Q&A", icon: MessageCircle },
  { href: "help", label: "Help", icon: HandHelping },
  { href: "exchange", label: "Exchange", icon: Zap },
  { href: "networking", label: "Networking", icon: Users2 },
] as const;

export function SocialsSubNav({ eventSlug }: SocialsSubNavProps) {
  const pathname = usePathname();
  const base = `/${eventSlug}/socials`;

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {SUB_TABS.map((tab) => {
        const href = `${base}/${tab.href}`;
        const isActive = pathname === href || pathname.startsWith(href + "?");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 text-sm font-medium",
              isActive
                ? "bg-white text-black shadow-glow scale-105"
                : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className={cn("w-4 h-4", isActive ? "text-black" : "text-gray-600")} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
