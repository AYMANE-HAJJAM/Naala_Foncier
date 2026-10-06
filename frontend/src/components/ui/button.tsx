import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--navy-950)] text-white shadow-[0_1px_2px_rgba(11,23,40,.2)] hover:bg-[var(--navy-900)] hover:shadow-[0_5px_14px_rgba(11,23,40,.14)]",
        secondary:
          "border border-[var(--border-strong)] bg-white text-[var(--text)] shadow-[var(--shadow-xs)] hover:border-[var(--slate-300)] hover:bg-[var(--surface-muted)]",
        ghost:
          "text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
        gold:
          "bg-[var(--accent)] text-white shadow-[0_1px_2px_rgba(118,88,34,.18)] hover:bg-[#96783f]",
        danger: "bg-[var(--critical)] text-white hover:bg-[#a33232]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[12px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
