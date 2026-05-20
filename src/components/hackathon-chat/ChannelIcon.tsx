"use client";

import { Hash, Lock, Megaphone, BookOpen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChannelIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("w-3.5 h-3.5", className);
  if (type === "spawn_point") return <Zap className={cls} />;
  if (type === "announcements") return <Megaphone className={cls} />;
  if (type === "team") return <Lock className={cls} />;
  if (type === "resources") return <BookOpen className={cls} />;
  return <Hash className={cls} />;
}