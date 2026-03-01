import Link from "next/link";
import Image from "next/image";
import { getActiveEventSlug } from "@/lib/supabase/queries";

export const revalidate = 0;

export default async function HomePage() {
  const activeSlug = await getActiveEventSlug();
  return (
    <main className="min-h-screen bg-black-gradient flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Depth Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md z-10 text-center space-y-12 floating">
        <div className="space-y-6">
          <div className="relative w-full max-w-[280px] mx-auto">
            <Image
              src="/cursor-calgary.avif"
              alt="Cursor Calgary"
              width={280}
              height={140}
              className="w-full h-auto rounded-2xl shadow-[0_0_60px_rgba(255,255,255,0.1)]"
              priority
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-light text-white tracking-tight text-shadow-glow">
              Calgary Meetup
            </h1>
            <p className="text-gray-500 text-sm font-light tracking-widest uppercase opacity-50">
              Community Builder Event
            </p>
          </div>
        </div>

        <div className="glass rounded-[40px] p-8 space-y-4 border-white/[0.05] animate-slide-up">
          <Link
            href={`/${activeSlug}`}
            className="block w-full h-16 rounded-[24px] bg-white text-black flex items-center justify-center font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-[0.98]"
          >
            Event Dashboard
          </Link>
          <p className="text-[10px] text-gray-700 uppercase tracking-[0.3em] font-light pt-4">
            Authorized Access Only
          </p>
        </div>
      </div>
    </main>
  );
}
