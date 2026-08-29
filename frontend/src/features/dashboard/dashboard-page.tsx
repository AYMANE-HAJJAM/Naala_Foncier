"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useGetDashboard, useGetUsers } from "@/generated/api/naala";
import { PageHeader, SectionHeader } from "@/components/shared/page";
import { MetricItem } from "@/components/shared/primitives";
import { Badge, Card, Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type {
  AgendaEvent,
  DocumentItem,
  NotificationItem,
  Requisition,
} from "@/types/domain";

/** ADMIN dashboard only — USER uses UserDashboardPage on /dashboard */
export function DashboardPage() {
  const { data: response, isLoading, isError, refetch } = useGetDashboard();
  const usersQuery = useGetUsers();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-72" />
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
    pendingAiProposals?: number;
    activity: {
      id: string;
      title: string;
      detail: string;
      date: string;
      user: string;
    }[];
  };

  const reqs = data.requisitions ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const atCourt = reqs.filter((r) =>
    /tribunal|audience|délibr/i.test(r.status),
  ).length;
  const upcoming = (data.agenda ?? []).filter(
    (a) => a.date && a.date >= today,
  ).length;
  const overdue = (data.agenda ?? []).filter(
    (a) => a.date && a.date < today,
  ).length;
  const recentDocs = (data.documents ?? []).slice(0, 6);
  const usersPayload = usersQuery.data?.data;
  const activeUsers = Array.isArray(usersPayload) ? usersPayload.length : 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Suivi des réquisitions, documents et échéances judiciaires."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricItem label="Réquisitions actives" value={String(reqs.length)} />
        <MetricItem label="Dossiers au tribunal" value={String(atCourt)} />
        <MetricItem label="Prochaines audiences" value={String(upcoming)} />
        <MetricItem
          label="Dates dépassées à mettre à jour"
          value={String(overdue)}
          urgent={overdue > 0}
        />
        <MetricItem
          label="Documents récents"
          value={String(recentDocs.length)}
        />
        <MetricItem
          label="Utilisateurs actifs"
          value={String(activeUsers || "—")}
        />
      </div>

      {(data.pendingAiProposals ?? 0) > 0 && (
        <Card className="mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--navy-950)]">
              Mises à jour à valider
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {data.pendingAiProposals} proposition
              {(data.pendingAiProposals ?? 0) > 1 ? "s" : ""} d’analyse en
              attente de revue administrateur
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/requisitions">Voir les terrains</Link>
          </Button>
        </Card>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
        <Card>
          <SectionHeader
            title="Agenda judiciaire"
            subtitle="Y compris dates passées à actualiser"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/agenda">Voir tout</Link>
              </Button>
            }
          />
          <ul className="divide-y divide-[var(--border)]">
            {(data.agenda ?? []).slice(0, 8).map((a) => {
              const past = a.date != null && a.date < today;
              return (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{a.title}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {a.type}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-semibold tabular-nums">
                        {formatDate(a.date)}
                      </p>
                      {past && (
                        <Badge tone="warning" className="mt-1">
                          À mettre à jour
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {(data.agenda ?? []).length === 0 && (
              <li className="px-5 py-6 text-sm text-[var(--text-muted)]">
                Aucune échéance enregistrée.
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <SectionHeader title="Terrains nécessitant une mise à jour" />
          <ul className="divide-y divide-[var(--border)]">
            {[...reqs]
              .filter(
                (r) => r.importantDate != null && r.importantDate < today,
              )
              .slice(0, 8)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{r.number}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                      {r.property}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/requisitions/${r.id}`}>Ouvrir</Link>
                  </Button>
                </li>
              ))}
            {[...reqs].filter(
              (r) => r.importantDate != null && r.importantDate < today,
            ).length === 0 && (
              <li className="px-5 py-6 text-sm text-[var(--text-muted)]">
                Aucun dossier en retard de mise à jour.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Documents récents" />
          <ul className="divide-y divide-[var(--border)]">
            {recentDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <b className="font-semibold">{d.title}</b>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {d.category} · {d.uploadedBy}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] text-[var(--text-muted)] tabular-nums">
                  {formatDate(d.date)}
                </span>
              </li>
            ))}
            {recentDocs.length === 0 && (
              <li className="px-5 py-6 text-sm text-[var(--text-muted)]">
                Aucun document récent.
              </li>
            )}
          </ul>
        </Card>
        <Card>
          <SectionHeader title="Activité récente" />
          <ul className="divide-y divide-[var(--border)]">
            {(data.activity ?? []).slice(0, 8).map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <b className="font-semibold">{a.title}</b>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  {a.detail} · {a.user}
                </p>
              </li>
            ))}
            {(data.activity ?? []).length === 0 && (
              <li className="px-5 py-6 text-sm text-[var(--text-muted)]">
                Aucune activité récente.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
