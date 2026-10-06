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
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-xs)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]",
        urgent && "border-amber-300/80 bg-[linear-gradient(145deg,#fff,var(--surface),#fffbeb)]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[var(--navy-800)]",
          urgent && "bg-[var(--warning)]",
        )}
      />
      <p className="text-[12px] font-medium text-[var(--text-muted)] leading-snug">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-[25px] font-semibold tracking-[-0.035em] tabular-nums leading-none",
          urgent ? "text-[var(--warning)]" : "text-[var(--navy-950)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function IdentityStrip({
  cells,
  compact = false,
}: {
  cells: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[];
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5 xl:divide-x">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <div
              key={cell.label}
              className={cn(
                "flex gap-3 transition-colors hover:bg-[var(--surface-muted)]",
                compact ? "px-3 py-2.5" : "px-4 py-4",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-muted)]",
                  compact ? "size-7" : "size-8",
                )}
              >
                <Icon className="size-3.5 text-[var(--navy-700)]" />
              </span>
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                  {cell.label}
                </span>
                <b className={cn("block truncate text-[13px] font-semibold text-[var(--text)]", compact ? "mt-0.5" : "mt-1")}>
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
      aria-label={`Ouvrir la catégorie ${code} — ${title}`}
      className="group flex min-h-[164px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
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
        <span className="text-[12px] font-semibold text-[var(--navy-900)] transition-transform group-hover:translate-x-0.5">
          Ouvrir
        </span>
      </div>
    </button>
  );
}
