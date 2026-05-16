import { HackathonEffects } from "@/components/hackathon/HackathonEffects";

export default function HackathonEffectsDevPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-red opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20 blur-[120px]" />

      <section className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-red-300/80">
          Local Animation Lab
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 sm:text-6xl">
          Hackathon Effects
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-6 text-gray-400">
          Use the test panel in the bottom-right corner to preview score, submission,
          event start, and team formation animations without touching live event data.
        </p>
      </section>

      <HackathonEffects
        scoresCount={0}
        projectSubmitted={false}
        eventStarted={false}
        teamFormed={false}
      />
    </main>
  );
}
