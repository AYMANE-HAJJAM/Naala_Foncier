import type { LucideIcon } from "lucide-react";
import { CalendarClock, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type SituationPanelProps = {
  statusLabel: string;
  explanation: string;
  latestEvent: string;
  latestEventDate: string | null;
  eventResult?: string | null;
  platformUpdatedAt: string;
  blocked?: boolean;
  actions?: React.ReactNode;
};

export function SituationPanel({
  statusLabel,
  explanation,
  latestEvent,
  latestEventDate,
  eventResult,
  platformUpdatedAt,
  blocked = false,
  actions,
}: SituationPanelProps) {
  return (
    <section
      className={cn(
        "relative h-full rounded-[12px] border px-5 py-5",
        blocked
          ? "border-amber-200/90 bg-amber-50/50"
          : "border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      {actions ? (
        <div className="absolute right-4 top-4">{actions}</div>
      ) : null}

      <div className={cn("flex items-start gap-3", actions && "pr-24")}>
        <Info
          className={cn(
            "mt-1 size-4 shrink-0",
            blocked ? "text-amber-800" : "text-[var(--navy-800)]",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[12px] text-[var(--text-muted)]">Situation du dossier</p>
          <p className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-[var(--navy-950)]">
            {statusLabel}
          </p>
          <p className="mt-2 text-[14px] leading-6 text-[var(--text)]">
            {explanation}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-[var(--border)]/80 pt-4 sm:grid-cols-2">
        <Fact
          icon={CalendarClock}
          label="Dernier événement connu"
          value={latestEvent}
        />
        <Fact
          label="Date"
          value={latestEventDate ?? "Non renseignée"}
        />
        {eventResult ? (
          <Fact
            label="Résultat / suite"
            value={eventResult}
            className="sm:col-span-2"
          />
        ) : null}
      </div>

      <p className="mt-4 text-[12px] text-[var(--text-muted)]">
        Mise à jour plateforme : {platformUpdatedAt}
      </p>
    </section>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold leading-5 text-[var(--navy-950)]">
        {value}
      </p>
    </div>
  );
}
