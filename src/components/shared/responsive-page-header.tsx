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
    <section className={cn("surface-panel relative overflow-hidden rounded-[30px] p-5 sm:p-6", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(91,102,255,0.18),transparent_52%)]" />
      <div aria-hidden="true" className="animate-float-soft pointer-events-none absolute -right-10 top-4 h-28 w-28 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          {eyebrow ? (
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[clamp(2rem,7vw,3rem)] font-semibold tracking-[-0.04em] text-gradient">{title}</h1>
              {badge}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
