import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end",
        className,
      )}
    >
      <div className="min-w-0">
        {back && (
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 h-8">
            <Link href={back}>
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </Button>
        )}
        <h1 className="text-[27px] font-semibold tracking-[-0.025em] text-[var(--navy-950)] leading-tight sm:text-[31px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-muted)]"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 opacity-60" />}
          {item.href ? (
            <Link
              className="hover:text-[var(--navy-900)]"
              href={item.href}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--text)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
  bordered = true,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 py-4.5 sm:px-6",
        bordered && "border-b border-[var(--border)]",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--navy-950)] leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** @deprecated Prefer SectionHeader */
export function SectionTitle(props: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return <SectionHeader {...props} />;
}
