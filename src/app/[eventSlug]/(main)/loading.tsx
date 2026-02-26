import { Skeleton } from "@/components/ui/skeleton";

export default function MainLoading() {
  return (
    <main className="max-w-lg mx-auto w-full px-6 py-12 space-y-12">
      <div className="space-y-4">
        <Skeleton className="h-3 w-20 opacity-30" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[24px] p-6 border-white/5 bg-white/[0.02] space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-3 w-1/2 opacity-50" />
          </div>
        ))}
      </div>
    </main>
  );
}
