import { cn } from "@/lib/utils";

interface RaceCarProps {
  isWinning: boolean;
  isMoving: boolean;
  variant?: "red" | "white";
}

export function RaceCar({ isWinning, isMoving, variant = "white" }: RaceCarProps) {
  const bodyColor = variant === "red" ? "bg-red-500" : "bg-sky-400";
  const noseColor = variant === "red" ? "border-l-red-400" : "border-l-cyan-300";
  const stripeColor = variant === "red" ? "bg-yellow-300" : "bg-white";

  return (
    <div className="relative h-9 w-14 drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)]">
      {isMoving && (
        <div className="absolute -left-10 top-1/2 h-8 w-12 -translate-y-1/2">
          <span className="absolute right-1 top-2 h-3 w-5 rounded-full bg-white/25 blur-[2px] animate-ping" />
          <span
            className="absolute right-5 top-0 h-4 w-4 rounded-full bg-white/20 blur-[2px] animate-ping"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="absolute right-7 bottom-0 h-3 w-6 rounded-full bg-zinc-300/15 blur-[2px] animate-ping"
            style={{ animationDelay: "240ms" }}
          />
        </div>
      )}

      {isWinning && isMoving && (
        <div className="absolute -left-3 top-3 h-3 w-5 rounded-full bg-gradient-to-l from-orange-300 via-red-500 to-transparent blur-[1px] animate-pulse" />
      )}

      <div className={cn("absolute left-2 top-3 h-4 w-9 rounded-l-full rounded-r-md", bodyColor)} />
      <div className={cn("absolute right-0 top-[11px] h-0 w-0 border-y-[7px] border-y-transparent border-l-[13px]", noseColor)} />
      <div className="absolute left-5 top-1 h-4 w-5 skew-x-[-18deg] rounded-t-md bg-white/70" />
      <div className={cn("absolute left-3 top-[18px] h-1 w-8 rounded-full", stripeColor)} />
      <div className="absolute right-[3px] top-[16px] h-1.5 w-1.5 rounded-full bg-yellow-200 shadow-[0_0_8px_rgba(254,240,138,0.9)]" />
      <div className="absolute left-4 bottom-1 h-3 w-3 rounded-full border-2 border-zinc-500 bg-black" />
      <div className="absolute right-2 bottom-1 h-3 w-3 rounded-full border-2 border-zinc-500 bg-black" />
    </div>
  );
}
