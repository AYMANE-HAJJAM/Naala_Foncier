"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCheck } from "lucide-react";
import {
  useGetAlerts,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/generated/api/naala";
import type { NotificationItem } from "@/types/domain";
import { PageHeader } from "@/components/shared/page";
import { EmptyState, Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { startOfLocalDay } from "@/lib/domain/date";
import { uiErrorMessage } from "@/lib/api/error-message";

function groupNotifications(alerts: NotificationItem[]) {
  const now = startOfLocalDay(new Date());
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: {
    key: string;
    label: string;
    items: NotificationItem[];
  }[] = [
    { key: "today", label: "Aujourd’hui", items: [] },
    { key: "week", label: "Cette semaine", items: [] },
    { key: "older", label: "Plus anciennes", items: [] },
  ];

  for (const n of alerts) {
    const raw =
      (n as NotificationItem & { createdAt?: string }).createdAt ?? "";
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) {
      groups[2].items.push(n);
      continue;
    }
    const day = startOfLocalDay(date);
    if (day.getTime() === now.getTime()) groups[0].items.push(n);
    else if (day >= weekAgo) groups[1].items.push(n);
    else groups[2].items.push(n);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function NotificationsPage() {
  const { data, isLoading, refetch } = useGetAlerts();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const alerts = useMemo(
    () => (data?.data ?? []) as unknown as NotificationItem[],
    [data],
  );

  const groups = useMemo(() => groupNotifications(alerts), [alerts]);

  if (isLoading) return <Skeleton className="h-[420px]" />;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Alertes liées à vos terrains, audiences et documents."
        actions={
          <Button
            variant="secondary"
            disabled={markAll.isPending || alerts.length === 0}
            onClick={async () => {
              try {
                await markAll.mutateAsync();
                await refetch();
                toast.success("Toutes les notifications sont lues");
              } catch (error) {
                toast.error(uiErrorMessage(error, "Impossible de tout marquer comme lu"));
              }
            }}
          >
            <CheckCheck className="size-4" />
            Tout marquer comme lu
          </Button>
        }
      />

      {alerts.length === 0 ? (
        <EmptyState
          title="Aucune notification"
          description="Les rappels d’audience et les dépôts de documents apparaîtront ici."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-muted)]">
                {group.label}
              </h2>
              <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] divide-y divide-[var(--border)]">
                {group.items.map((n) => {
                  const createdAt = (
                    n as NotificationItem & { createdAt?: string }
                  ).createdAt;
                  return (
                    <li key={n.id}>
                      <Link
                        href={
                          n.requisitionId
                            ? `/requisitions/${n.requisitionId}`
                            : "/notifications"
                        }
                        className={cn(
                          "flex items-start gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] sm:px-5",
                          !n.read && "bg-[color-mix(in_srgb,var(--gold-100)_35%,white)]",
                        )}
                        onClick={async () => {
                          if (!n.read) {
                            try {
                              await markOne.mutateAsync({ id: n.id });
                              await refetch();
                            } catch (error) {
                              toast.error(uiErrorMessage(error, "Impossible de marquer cette notification comme lue"));
                            }
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "mt-2 size-1.5 shrink-0 rounded-full",
                            n.read ? "bg-transparent" : "bg-[var(--accent)]",
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p
                              className={cn(
                                "text-[14px]",
                                n.read
                                  ? "font-medium text-[var(--text)]"
                                  : "font-semibold text-[var(--navy-950)]",
                              )}
                            >
                              {n.title}
                            </p>
                            <span className="text-[11px] tabular-nums text-[var(--text-faint)]">
                              {createdAt
                                ? formatDate(createdAt.slice(0, 10))
                                : ""}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                            {n.description}
                          </p>
                          {n.requisitionId && (
                            <p className="mt-1.5 text-[12px] font-medium text-[var(--accent)]">
                              Ouvrir le dossier
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
