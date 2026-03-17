import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconChipVariants = cva(
  "inline-flex shrink-0 items-center justify-center border border-white/10 backdrop-blur-md transition-[background-color,border-color,box-shadow,color,transform] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
  {
    variants: {
      size: {
        sm: "h-9 w-9 rounded-[16px] [&_svg]:h-[15px] [&_svg]:w-[15px]",
        md: "h-10 w-10 rounded-[18px] [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-12 w-12 rounded-[20px] [&_svg]:h-5 [&_svg]:w-5",
      },
      tone: {
        default: "bg-white/[0.05] text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        primary: "border-primary/15 bg-primary/12 text-primary shadow-[0_14px_30px_rgba(91,102,255,0.16)]",
        blue: "border-sky-500/18 bg-sky-500/10 text-sky-300 shadow-[0_14px_30px_rgba(14,165,233,0.14)]",
        cyan: "border-cyan-500/18 bg-cyan-500/10 text-cyan-300 shadow-[0_14px_30px_rgba(34,211,238,0.14)]",
        emerald: "border-emerald-500/18 bg-emerald-500/10 text-emerald-300 shadow-[0_14px_30px_rgba(16,185,129,0.14)]",
        amber: "border-amber-500/18 bg-amber-500/10 text-amber-300 shadow-[0_14px_30px_rgba(245,158,11,0.14)]",
        danger: "border-red-500/18 bg-red-500/10 text-red-300 shadow-[0_14px_30px_rgba(239,68,68,0.14)]",
        slate: "border-white/10 bg-white/[0.04] text-slate-200 shadow-[0_14px_30px_rgba(15,23,42,0.18)]",
        violet: "border-violet-500/18 bg-violet-500/10 text-violet-300 shadow-[0_14px_30px_rgba(139,92,246,0.14)]",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "default",
    },
  }
);

export interface IconChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconChipVariants> {}

export function IconChip({ className, size, tone, ...props }: IconChipProps) {
  return <div className={cn(iconChipVariants({ size, tone }), className)} {...props} />;
}
