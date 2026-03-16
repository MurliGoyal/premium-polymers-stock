import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl text-sm font-medium transform-gpu transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-300 ease-[cubic-bezier(0.2,1,0.22,1)] will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[130%] before:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.14),transparent)] before:transition-transform before:duration-700 before:ease-[cubic-bezier(0.2,1,0.22,1)] hover:before:translate-x-[130%] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_18px_38px_rgba(91,102,255,0.32)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_24px_50px_rgba(91,102,255,0.4)] active:translate-y-0 active:scale-[0.985]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_16px_36px_rgba(220,38,38,0.24)] hover:-translate-y-0.5 hover:bg-destructive/92 hover:shadow-[0_22px_44px_rgba(220,38,38,0.32)] active:translate-y-0 active:scale-[0.985]",
        outline: "border border-white/12 bg-white/[0.04] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.07] hover:shadow-[0_18px_36px_rgba(2,6,23,0.22)] active:translate-y-0 active:scale-[0.985]",
        secondary: "border border-white/10 bg-secondary/80 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:bg-secondary hover:shadow-[0_18px_36px_rgba(2,6,23,0.18)] active:translate-y-0 active:scale-[0.985]",
        ghost: "text-muted-foreground hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-foreground active:translate-y-0 active:scale-[0.985]",
        link: "overflow-visible before:hidden text-primary underline-offset-4 hover:text-primary/90 hover:[&_svg]:translate-x-0.5 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-xl px-3.5 text-xs",
        lg: "h-12 rounded-2xl px-6 text-sm",
        icon: "h-11 w-11",
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
