interface Props {
  className?: string;
}

/** ZayZoon sponsor shoutout — only render when event.slug === "calgary-july-2026". */
export function ZayZoonSponsorBadge({ className }: Props) {
  return (
    <div className={className ?? "flex items-center gap-3"}>
      <div className="hidden h-10 w-px bg-white/10 sm:block" aria-hidden />
      <div className="flex items-center gap-2.5">
        <img
          src="/sponsors/zayzoon.svg"
          alt="ZayZoon"
          className="h-7 w-auto sm:h-8"
        />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
          Sponsored by ZayZoon
        </p>
      </div>
    </div>
  );
}
