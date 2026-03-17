import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl text-sm font-medium transform-gpu transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[460ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[130%] before:opacity-0 before:transition-[transform,opacity] before:duration-[900ms] before:ease-[cubic-bezier(0.16,1,0.3,1)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-[420ms] [&_svg]:ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer",
  {
    variants: {
      variant: {
        default: "before:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] before:opacity-100 hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_24px_50px_rgba(91,102,255,0.4)] hover:before:translate-x-[130%] active:translate-y-0 active:scale-[0.988] active:duration-[160ms] bg-primary text-primary-foreground shadow-[0_18px_38px_rgba(91,102,255,0.32)]",
        destructive: "before:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] before:opacity-100 hover:-translate-y-px hover:bg-destructive/92 hover:shadow-[0_22px_44px_rgba(220,38,38,0.32)] hover:before:translate-x-[130%] active:translate-y-0 active:scale-[0.988] active:duration-[160ms] bg-destructive text-destructive-foreground shadow-[0_16px_36px_rgba(220,38,38,0.24)]",
        outline: "before:hidden border border-white/12 bg-white/[0.04] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-px hover:border-white/18 hover:bg-white/[0.07] hover:shadow-[0_18px_36px_rgba(2,6,23,0.22)] active:translate-y-0 active:scale-[0.99] active:duration-[160ms]",
        secondary: "before:hidden border border-white/10 bg-secondary/80 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-px hover:bg-secondary hover:shadow-[0_18px_36px_rgba(2,6,23,0.18)] active:translate-y-0 active:scale-[0.99] active:duration-[160ms]",
        ghost: "before:hidden text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] active:scale-[0.99] active:duration-[160ms]",
        link: "before:hidden overflow-visible rounded-none px-0 py-0 shadow-none text-primary underline-offset-4 hover:text-primary/90 hover:[&_svg]:translate-x-0.5 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2.5 sm:h-11",
        sm: "h-9 rounded-xl px-3.5 text-xs",
        lg: "h-11 rounded-2xl px-5 text-sm sm:h-12 sm:px-6",
        icon: "h-10 w-10 before:hidden sm:h-11 sm:w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
