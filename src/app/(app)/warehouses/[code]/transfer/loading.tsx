import { Skeleton } from "@/components/ui/skeleton";

export default function TransferLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-[720px] rounded-[28px]" />
      <Skeleton className="h-24 rounded-[28px]" />
    </div>
  );
}
