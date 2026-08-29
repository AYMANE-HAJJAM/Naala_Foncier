"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useGetDashboard, useGetReports } from "@/generated/api/naala";
import { PageHeader, SectionHeader } from "@/components/shared/page";
import { MetricItem } from "@/components/shared/primitives";
import { Card, Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type {
  AgendaEvent,
  DocumentItem,
  NotificationItem,
  ReportItem,
  Requisition,
} from "@/types/domain";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function UserDashboardPage() {
  const { data: response, isLoading, isError, refetch } = useGetDashboard();
  const reportsQuery = useGetReports();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError || !response) {
    return (
      <Card className="p-10 text-center">
        <AlertTriangle className="mx-auto size-7 text-[var(--critical)]" />
        <h2 className="mt-3 text-base font-semibold">
          Impossible de charger le tableau de bord
        </h2>
        <Button onClick={() => refetch()} className="mt-4">
          Réessayer
        </Button>
      </Card>
    );
  }

  const data = response.data as unknown as {
    requisitions: Requisition[];
    documents: DocumentItem[];
    alerts: NotificationItem[];
    agenda: AgendaEvent[];
  };

  const reqs = data.requisitions ?? [];
  const today = todayIso();
  const docs = [...(data.documents ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const recentDocs = docs.slice(0, 5);
  const reports = ([...(reportsQuery.data?.data ?? [])] as ReportItem[]).sort(
    (a, b) => b.generatedAt.localeCompare(a.generatedAt),
  );
  const recentReports = reports.slice(0, 5);

  const futureAgenda = [...(data.agenda ?? [])]
    .filter((a) => a.date && a.date >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const nearestAgenda = futureAgenda[0];

  const futureReqDates = reqs
    .map((r) => r.importantDate)
    .filter((d): d is string => Boolean(d && d >= today))
    .sort();
  const nearestReqDate = futureReqDates[0];

  const nearestDate =
    nearestAgenda?.date && nearestReqDate
      ? nearestAgenda.date <= nearestReqDate
        ? nearestAgenda.date
        : nearestReqDate
      : nearestAgenda?.date ?? nearestReqDate ?? null;

  const nearestLabel = nearestAgenda?.date === nearestDate
    ? nearestAgenda.title
    : nearestDate
      ? reqs.find((r) => r.importantDate === nearestDate)?.property
      : null;

  const updates = [...reqs]
    .sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate))
    .slice(0, 6);

  const reqById = (id: string) => reqs.find((r) => r.id === id);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d’ensemble de vos terrains et prochaines échéances."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricItem
          label="Terrains attribués"
          value={String(reqs.length)}
        />
        <MetricItem
          label="Prochaine date importante"
          value={nearestDate ? formatDate(nearestDate) : "—"}
        />
        <MetricItem
          label="Nouveaux documents"
          value={String(recentDocs.length)}
        />
        <MetricItem
          label="Rapports récemment ajoutés"
          value={String(recentReports.length)}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[17px] font-semibold text-[var(--navy-950)]">
            Prochaine échéance
          </h2>
          {nearestDate ? (
            <Card className="p-5">
              <p className="text-[22px] font-semibold tabular-nums tracking-tight text-[var(--navy-950)]">
                {formatDate(nearestDate)}
              </p>
              {nearestLabel && (
                <p className="mt-2 text-[14px] text-[var(--text)]">
                  {nearestLabel}
                </p>
              )}
              {nearestAgenda?.date === nearestDate && nearestAgenda.requisitionId && (
                <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
                  <Link href={`/requisitions/${nearestAgenda.requisitionId}`}>
                    Ouvrir le dossier
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </Card>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Aucune échéance à venir.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[17px] font-semibold text-[var(--navy-950)]">
            Dernières mises à jour
          </h2>
          {updates.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Aucune mise à jour récente.
            </p>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--border)]">
                {updates.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requisitions/${r.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-muted)]"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--accent)]">
                          {r.number}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-[var(--text)]">
                          {r.status || "Mise à jour du dossier"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
                        {formatDate(r.lastUpdate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader
            title="Documents récents"
            className="mb-0 px-0 pt-0"
            bordered={false}
          />
          {recentDocs.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Aucun document partagé récemment.
            </p>
          ) : (
            <Card className="mt-2 overflow-hidden">
              <ul className="divide-y divide-[var(--border)]">
                {recentDocs.map((d) => {
                  const req = reqById(d.requisitionId);
                  return (
                    <li key={d.id}>
                      <Link
                        href={
                          d.requisitionId
                            ? `/requisitions/${d.requisitionId}?tab=documents`
                            : "/mes-dossiers"
                        }
                        className="block px-4 py-3 hover:bg-[var(--surface-muted)]"
                      >
                        <p className="text-[13px] font-semibold">{d.title}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                          {req?.number ?? d.category} · {formatDate(d.date)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionHeader
            title="Rapports récents"
            className="mb-0 px-0 pt-0"
            bordered={false}
          />
          {reportsQuery.isLoading ? (
            <Skeleton className="mt-2 h-32" />
          ) : recentReports.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Aucun rapport disponible.
            </p>
          ) : (
            <Card className="mt-2 overflow-hidden">
              <ul className="divide-y divide-[var(--border)]">
                {recentReports.map((r) => {
                  const req = reqById(r.requisitionId);
                  return (
                    <li key={r.id}>
                      <Link
                        href={
                          r.requisitionId
                            ? `/requisitions/${r.requisitionId}?tab=rapports`
                            : "/mes-dossiers"
                        }
                        className="block px-4 py-3 hover:bg-[var(--surface-muted)]"
                      >
                        <p className="text-[13px] font-semibold">{r.title}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                          {req?.number ?? r.version} ·{" "}
                          {formatDate(r.generatedAt.slice(0, 10))}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
