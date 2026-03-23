import { cn } from "@/lib/utils";

type ResponsivePageHeaderProps = {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  description: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
};

export function ResponsivePageHeader({
  actions,
  badge,
  className,
  description,
  eyebrow,
  title,
}: ResponsivePageHeaderProps) {
  return (
    <section className={cn("surface-panel relative overflow-hidden rounded-[22px] p-4 sm:rounded-[30px] sm:p-6", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(91,102,255,0.18),transparent_52%)] sm:h-28"
      />
      <div
        aria-hidden="true"
        className="animate-float-soft pointer-events-none absolute -right-8 top-3 h-20 w-20 rounded-full bg-white/[0.04] blur-3xl sm:-right-10 sm:top-4 sm:h-28 sm:w-28"
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2.5 sm:space-y-3">
          {eyebrow ? (
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-3 sm:py-1.5 sm:text-[11px]">
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-col items-start gap-2 min-[480px]:flex-row min-[480px]:items-center">
              <h1 className="text-[clamp(1.75rem,8vw,3rem)] font-semibold leading-none tracking-[-0.045em] text-gradient">
                {title}
              </h1>
              {badge ? <div className="shrink-0">{badge}</div> : null}
            </div>
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:max-w-3xl sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions ? (
          <div className="grid w-full gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
