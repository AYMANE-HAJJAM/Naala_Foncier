import { cn } from "@/lib/utils";

export function MetricItem({
  label,
  value,
  urgent,
  className,
}: {
  label: string;
  value: string;
  urgent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5",
        urgent && "border-amber-300/80 bg-amber-50/50",
        className,
      )}
    >
      <p className="text-[12px] font-medium text-[var(--text-muted)] leading-snug">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-[22px] font-semibold tracking-tight tabular-nums leading-none",
          urgent ? "text-[var(--warning)]" : "text-[var(--navy-950)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-0 sm:grid-cols-2",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="border-b border-[var(--border)] px-5 py-4 sm:odd:border-r"
        >
          <dt className="text-[12px] font-medium text-[var(--text-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function IdentityStrip({
  cells,
}: {
  cells: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5 xl:divide-x">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <div key={cell.label} className="flex gap-2.5 px-4 py-3.5">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--text-faint)]" />
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                  {cell.label}
                </span>
                <b className="mt-1 block truncate text-[13px] font-semibold text-[var(--text)]">
                  {cell.value}
                </b>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DocumentCategoryCard({
  code,
  title,
  description,
  count,
  latestDate,
  onOpen,
}: {
  code: string;
  title: string;
  description: string;
  count: number;
  latestDate?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[132px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--slate-300)] hover:bg-[var(--surface-muted)]"
    >
      <p className="text-[12px] font-semibold tabular-nums text-[var(--accent)]">
        {code} —
      </p>
      <h3 className="mt-2 text-[15px] font-semibold text-[var(--text)]">
        {title}
      </h3>
      <p className="mt-1 flex-1 text-[12px] leading-5 text-[var(--text-muted)] line-clamp-2">
        {description}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-[var(--border)] pt-3">
        <div>
          <p className="text-[12px] font-semibold text-[var(--text)]">
            {count} document{count !== 1 ? "s" : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
            {count === 0
              ? "Aucun document"
              : latestDate
                ? `Dernier : ${latestDate}`
                : ""}
          </p>
        </div>
        <span className="text-[12px] font-semibold text-[var(--navy-900)]">
          Ouvrir
        </span>
      </div>
    </button>
  );
}

export function CourtTimeline({
  events,
}: {
  events: {
    id: string;
    dateLabel: string;
    type: React.ReactNode;
    title: string;
    result?: string;
    nextAction?: string;
    past?: boolean;
    needsFollowUp?: boolean;
  }[];
}) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
        Aucun événement enregistré.
      </p>
    );
  }

  return (
    <div className="space-y-0 px-5 py-5">
      {events.map((h) => (
        <div key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
          <div className="flex w-[7.5rem] shrink-0 flex-col items-end pt-0.5">
            <span className="text-[12px] font-semibold tabular-nums text-[var(--text)]">
              {h.dateLabel}
            </span>
            {h.past && (
              <span className="mt-1 text-right text-[10px] font-medium text-[var(--warning)]">
                Date passée
              </span>
            )}
          </div>
          <div className="relative flex flex-col items-center">
            <span className="mt-1.5 size-2 rounded-full bg-[var(--navy-900)] ring-2 ring-[var(--canvas)]" />
            <span className="mt-1 w-px flex-1 bg-[var(--border)]" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">{h.type}</div>
            <p className="mt-2 text-[14px] font-semibold text-[var(--text)]">
              {h.title}
            </p>
            {h.result && (
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Résultat : {h.result}
              </p>
            )}
            {h.nextAction && (
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Suite : {h.nextAction}
              </p>
            )}
            {h.needsFollowUp && (
              <p className="mt-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                Cette date est passée. Le compte rendu ou la nouvelle situation
                doit être renseigné.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
