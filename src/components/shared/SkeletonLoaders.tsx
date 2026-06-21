import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-muted",
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b flex gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24 mr-auto" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4 items-center">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 mr-auto" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPIBar() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
