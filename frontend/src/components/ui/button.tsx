import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--navy-950)] text-white hover:bg-[var(--navy-900)]",
        secondary:
          "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-muted)]",
        ghost:
          "text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
        gold:
          "bg-[var(--accent)] text-white hover:bg-[#96783f]",
        danger: "bg-[var(--critical)] text-white hover:bg-[#a33232]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "size-9 p-0",
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
