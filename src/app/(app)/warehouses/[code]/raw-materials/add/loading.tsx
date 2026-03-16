import { Skeleton } from "@/components/ui/skeleton";

export default function AddMaterialLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-[420px] rounded-[28px]" />
      <Skeleton className="h-[420px] rounded-[28px]" />
      <Skeleton className="h-24 rounded-[28px]" />
    </div>
  );
}
