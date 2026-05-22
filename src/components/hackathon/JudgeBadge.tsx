import { Gavel } from "lucide-react";
import type { Mentor } from "@/types";

interface JudgeBadgeProps {
  judge: Mentor;
}

export function JudgeBadge({ judge }: JudgeBadgeProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-black/40 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 group hover:border-amber-500/40 transition-colors">
      <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
        <Gavel className="w-24 h-24 text-amber-500" strokeWidth={1.25} />
      </div>
      
      {judge.photo_url ? (
        <img
          src={judge.photo_url}
          alt={judge.name}
          className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover flex-shrink-0 border-2 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)] z-10"
        />
      ) : (
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-amber-500/10 flex items-center justify-center text-4xl font-light text-amber-500 flex-shrink-0 border-2 border-amber-500/30 z-10">
          {judge.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-xl sm:text-2xl font-medium text-white tracking-tight">{judge.name}</h3>
          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            Judge
          </span>
        </div>
        
        <div className="flex flex-col gap-0.5 mb-4">
          {judge.title && <p className="text-sm text-amber-100/80 font-medium">{judge.title}</p>}
          {judge.company && <p className="text-xs text-amber-100/60 uppercase tracking-wider">{judge.company}</p>}
        </div>

        {judge.bio && (
          <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{judge.bio}</p>
        )}
        
        {judge.is_mentor && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            Also available as a Mentor
          </div>
        )}
      </div>
    </div>
  );
}
