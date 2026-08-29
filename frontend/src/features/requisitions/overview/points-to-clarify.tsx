import { CircleHelp } from "lucide-react";

type PointsToClarifyProps = {
  items: string[];
};

export function PointsToClarify({ items }: PointsToClarifyProps) {
  if (items.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Aucun point ouvert n’est enregistré.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
      {items.slice(0, 4).map((item) => (
        <li key={item} className="flex gap-3 px-4 py-3.5">
          <CircleHelp
            className="mt-0.5 size-4 shrink-0 text-[var(--navy-800)]"
            aria-hidden
          />
          <p className="text-[14px] font-medium leading-5 text-[var(--navy-950)]">
            {item}
          </p>
        </li>
      ))}
    </ul>
  );
}
