"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, FileText, MapPin, Ruler, Search } from "lucide-react";
import {
  useGetAlerts,
  useGetDashboard,
  useGetReports,
  useGetRequisitions,
} from "@/generated/api/naala";
import { PageHeader } from "@/components/shared/page";
import {
  EmptyState,
  Skeleton,
  StatusBadge,
} from "@/components/ui/core";
import { cn, formatDate } from "@/lib/utils";
import type {
  DocumentItem,
  NotificationItem,
  ReportItem,
  Requisition,
} from "@/types/domain";

function nextDateLabel(nextScheduled?: string | null) {
  if (!nextScheduled) return "Aucune date programmée";
  return formatDate(nextScheduled);
}

export function MesDossiersPage() {
  const { data, isLoading, isError } = useGetRequisitions();
  const dashQuery = useGetDashboard();
  const reportsQuery = useGetReports();
  const alertsQuery = useGetAlerts();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => (data?.data ?? []) as Requisition[], [data]);
  const docs = ((dashQuery.data?.data as { documents?: DocumentItem[] } | undefined)
    ?.documents ?? []) as DocumentItem[];
  const reports = (reportsQuery.data?.data ?? []) as ReportItem[];
  const alerts = (alertsQuery.data?.data ?? []) as unknown as NotificationItem[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.number, r.property, r.location].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Impossible de charger les terrains"
        description="Vérifiez votre connexion et réessayez."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Mes terrains"
        subtitle="Consultez les terrains qui vous sont attribués."
      />

      {rows.length > 0 && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-xs)]">
          <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (référence, propriété, localisation)…"
            className="nf-input nf-input--icon-left"
            aria-label="Rechercher un dossier"
          />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun terrain attribué"
          description="Votre gestionnaire ne vous a encore attribué aucun terrain."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          description="Aucun terrain ne correspond à votre recherche."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const docCount = docs.filter(
              (d) =>
                d.requisitionId === r.id &&
                String(d.category ?? "").toUpperCase() !== "RAPPORTS",
            ).length;
            const hasReport = reports.some((rep) => rep.requisitionId === r.id);
            const hasUnread = alerts.some(
              (n) => !n.read && n.requisitionId === r.id,
            );
            return (
              <DossierCard
                key={r.id}
                r={r}
                docCount={docCount}
                hasReport={hasReport}
                hasUnread={hasUnread}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function DossierCard({
  r,
  docCount,
  hasReport,
  hasUnread,
}: {
  r: Requisition;
  docCount: number;
  hasReport: boolean;
  hasUnread: boolean;
}) {
  return (
    <Link
      href={`/requisitions/${r.id}`}
      className={cn(
        "group relative flex min-h-[300px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5",
        "shadow-[var(--shadow-xs)] transition-all",
        "hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(168,137,74,0.45)]",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy-800),var(--accent))] opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="nf-eyebrow truncate">
            {r.number}
          </p>
          {hasUnread && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
              title="Notification non lue"
            />
          )}
        </div>
        <StatusBadge status={r.status || "Non renseigné"} />
      </div>

      <h2 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.02em] text-[var(--navy-950)] line-clamp-2">
        {r.property}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[var(--text-muted)]">
        <span className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2.5 py-2">
          <MapPin className="size-3.5 shrink-0 text-[var(--navy-700)]" />
          <span className="truncate">{r.location || "Non renseignée"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2.5 py-2">
          <Ruler className="size-3.5 shrink-0 text-[var(--navy-700)]" />
          <span className="truncate">{r.surface || "Non renseignée"}</span>
        </span>
      </div>

      <div className="mt-4 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          Situation actuelle
        </p>
        <p className="mt-1.5 text-[13px] leading-5 text-[var(--text)] line-clamp-3">
          {r.currentSituation ?? r.issue ?? "Situation à renseigner"}
        </p>
      </div>

      <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
        <div className="flex justify-between gap-2 text-[12px]">
          <span className="text-[var(--text-muted)]">Dernière mise à jour connue</span>
          <span className="max-w-[55%] text-right font-medium text-[var(--text)] line-clamp-2">
            {r.latestKnownEvent ??
              (r.latestKnownEventAt
                ? formatDate(r.latestKnownEventAt)
                : formatDate(r.lastUpdate))}
          </span>
        </div>
        <div className="flex justify-between gap-2 text-[12px]">
          <span className="text-[var(--text-muted)]">Prochaine date</span>
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-[var(--text)] text-right">
            <CalendarDays className="size-3.5 text-[var(--text-faint)]" />
            {nextDateLabel(r.nextScheduledEventAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
            {docCount > 0 && (
              <span>
                {docCount} doc{docCount > 1 ? "s" : ""}
              </span>
            )}
            {hasReport && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" />
                Rapport
              </span>
            )}
          </div>
          <ArrowUpRight className="size-4 text-[var(--text-faint)] transition group-hover:text-[var(--navy-900)]" />
        </div>
      </div>
    </Link>
  );
}
