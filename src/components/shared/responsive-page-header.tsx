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
    <section className={cn("surface-panel rounded-[28px] p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">{eyebrow}</div>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-gradient sm:text-4xl">{title}</h1>
              {badge}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
