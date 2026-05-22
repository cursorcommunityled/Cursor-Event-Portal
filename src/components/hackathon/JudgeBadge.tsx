import type { Mentor } from "@/types";

interface JudgeBadgeProps {
  judge: Mentor;
}

export function JudgeBadge({ judge }: JudgeBadgeProps) {
  return (
    <div className="glass rounded-[24px] p-5 border-white/10 flex items-center gap-4">
      {judge.photo_url ? (
        <img
          src={judge.photo_url}
          alt={judge.name}
          className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-light text-white flex-shrink-0">
          {judge.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{judge.name}</p>
        {judge.title && <p className="text-xs text-gray-400 mt-0.5">{judge.title}</p>}
        {judge.company && <p className="text-xs text-gray-500">{judge.company}</p>}
        {judge.bio && (
          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">{judge.bio}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {judge.is_mentor && (
          <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            Mentor
          </span>
        )}
        <span className="text-[9px] uppercase tracking-[0.15em] text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
          Judge
        </span>
      </div>
    </div>
  );
}
