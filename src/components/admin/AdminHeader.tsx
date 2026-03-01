"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AdminHeaderProps {
  adminCode?: string;
  eventSlug?: string; // kept for legacy compatibility, not used for routing
  title?: string;
  subtitle: string;
  rightElement?: React.ReactNode;
  showBackArrow?: boolean;
  showLogout?: boolean;
}

export function AdminHeader({
  adminCode,
  eventSlug,
  title = "Calgary Cursor Meetup",
  subtitle,
  rightElement,
  showBackArrow = true,
  showLogout = true
}: AdminHeaderProps) {
  const router = useRouter();

  // Use adminCode for new simplified routes; fall back to eventSlug for legacy
  const adminPath = adminCode ? `/admin/${adminCode}` : (eventSlug ? `/admin/${eventSlug}` : "/admin/login");

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="z-10 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-10">
            {showBackArrow && (
              <Link
                href={adminPath}
                prefetch={false}
                className="text-white/40 hover:text-white transition-colors group"
              >
                <ArrowLeft strokeWidth={1.5} className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </Link>
            )}
            <Link
              href={adminPath}
              prefetch={false}
              className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:bg-white/10 transition-all cursor-pointer group"
            >
              <Image
                src="/cursor-icon.png"
                alt="Cursor"
                width={48}
                height={48}
                className="object-contain group-hover:scale-105 transition-transform"
              />
            </Link>
            <div className="ml-2">
              <h1 className="text-4xl font-light tracking-tight text-white">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[12px] uppercase tracking-[0.4em] text-gray-700 font-medium">{subtitle}</p>
            {rightElement && rightElement}
            {showLogout && (
              <button
                onClick={handleLogout}
                className="ml-4 p-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                title="Sign out"
              >
                <LogOut strokeWidth={1.5} className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
