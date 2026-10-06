"use client";

import { useGetRequisitionActivity } from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { SectionTitle } from "@/components/shared/page";
import { Card } from "@/components/ui/core";
import { formatDate } from "@/lib/utils";

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  user: string;
};

export function HistoryTab({ r }: { r: Requisition }) {
  const { data, isLoading } = useGetRequisitionActivity(r.id);
  const items = (data?.data ?? []) as unknown as ActivityItem[];

  if (isLoading) {
    return (
      <Card className="p-8 text-sm text-[var(--text-muted)]">
        Chargement de l’historique…
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Historique"
        subtitle="Actions enregistrées sur ce dossier"
      />
      <div className="px-5 py-5 sm:px-6">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Aucune entrée d’historique pour ce dossier.
          </p>
        ) : (
          <div className="relative space-y-0 before:absolute before:bottom-5 before:left-[5px] before:top-5 before:w-px before:bg-[var(--border)]">
            {items.map((activity) => (
              <div
                className="relative grid gap-2 py-4 pl-7 sm:grid-cols-[120px_1fr] sm:gap-5"
                key={activity.id}
              >
                <span className="absolute left-0 top-[22px] size-[11px] rounded-full border-[3px] border-white bg-[var(--accent)] shadow-[0_0_0_1px_var(--border)]" />
                <div className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
                  {formatDate(activity.date.slice(0, 10))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{activity.title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                    {activity.detail}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                    {activity.user}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
