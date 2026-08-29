"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Risk } from "@/types/domain";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "critical" | "warning" | "success" | "info" | "neutral";
  className?: string;
}) {
  const tones = {
    critical: "border-red-200/80 bg-red-50 text-[var(--critical)]",
    warning: "border-amber-200/80 bg-amber-50 text-[var(--warning)]",
    success: "border-emerald-200/80 bg-emerald-50 text-[var(--success)]",
    info: "border-sky-200/70 bg-sky-50/80 text-[var(--info)]",
    neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--slate-700)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: Risk | string }) {
  const tone = risk.includes("Critique")
    ? "critical"
    : risk.includes("Élevé")
      ? "warning"
      : risk === "Faible"
        ? "success"
        : "info";
  return <Badge tone={tone}>{risk}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes("Bloqu") || status.includes("retard")
      ? "critical"
      : status.includes("Terminé") ||
          status.includes("Validé") ||
          status.includes("Disponible")
        ? "success"
        : status.includes("cours") || status.includes("Audience")
          ? "info"
          : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1 overflow-hidden rounded-full bg-[var(--slate-100)]",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-[var(--navy-800)] transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl" | "wizard";
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--navy-950)]/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(11,23,40,.12)]",
            size === "md" && "max-h-[90vh] max-w-lg",
            size === "lg" && "max-h-[90vh] max-w-2xl",
            size === "xl" && "max-h-[90vh] max-w-4xl",
            size === "wizard" &&
              "max-h-[85vh] w-[min(1100px,90vw)] max-w-[min(1100px,90vw)]",
          )}
        >
          <div className="pr-10">
            <DialogPrimitive.Title className="text-lg font-semibold text-[var(--navy-950)]">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] hover:bg-[var(--slate-100)]"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-1.5 max-w-md text-[13px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-md)] bg-[var(--slate-200)]/70",
        className,
      )}
    />
  );
}
