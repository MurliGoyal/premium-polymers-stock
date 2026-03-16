import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[24px]" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-[28px]" />
        <Skeleton className="h-80 rounded-[28px]" />
        <Skeleton className="h-80 rounded-[28px]" />
      </div>
    </div>
  );
}
