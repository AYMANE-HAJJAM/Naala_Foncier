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
      <div className="px-5 py-5">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Aucune entrée d’historique pour ce dossier.
          </p>
        ) : (
          <div className="space-y-0">
            {items.map((activity) => (
              <div
                className="relative flex gap-4 border-b border-[var(--border)] py-4 last:border-0"
                key={activity.id}
              >
                <div className="w-28 shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text)]">
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
