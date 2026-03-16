import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-12 w-60" />
        <Skeleton className="h-5 w-full max-w-3xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[24px]" />
        ))}
      </div>

      <Skeleton className="h-40 rounded-[28px]" />
      <Skeleton className="h-[640px] rounded-[28px]" />
    </div>
  );
}
