"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Requisition } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/core";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  createTerrainEvent,
  type TerrainEventDto,
} from "@/lib/api/phase1";
import { toast } from "sonner";
import { CalendarWorkspace } from "@/features/calendar/calendar-workspace";
import { dateOnlyToIsoAtNoonUtc, localDateKey } from "@/lib/domain/date";
import { uiErrorMessage } from "@/lib/api/error-message";
import {
  getGetRequisitionEventsQueryKey,
  useGetRequisitionEvents,
} from "@/generated/api/naala";

export function TerrainTimelineTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const queryClient = useQueryClient();
  const eventsQuery = useGetRequisitionEvents(r.id);
  const events = (eventsQuery.data?.data ?? []) as unknown as TerrainEventDto[];
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateKey());
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">
          Historique chronologique (événements validés).
        </p>
        {admin && (
          <Button size="sm" onClick={() => setOpen(!open)}>
            <Plus className="size-4" />
            Ajouter une mise à jour
          </Button>
        )}
      </div>

      {open && admin && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input
              className="nf-input"
              placeholder="Titre de la mise à jour"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="date"
              className="nf-input"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!title.trim()) return;
                try {
                  await createTerrainEvent({
                    requisitionId: r.id,
                    type: "GENERAL_UPDATE",
                    occurredAt: dateOnlyToIsoAtNoonUtc(occurredAt),
                    title: title.trim(),
                  });
                  setTitle("");
                  setOpen(false);
                  toast.success("Mise à jour ajoutée");
                  await queryClient.invalidateQueries({
                    queryKey: getGetRequisitionEventsQueryKey(r.id),
                  });
                } catch (error) {
                  toast.error(uiErrorMessage(error, "Impossible d’ajouter l’événement"));
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {eventsQuery.isLoading ? (
        <Skeleton className="h-40" />
      ) : events.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">
          Aucun événement validé pour l’instant.
        </p>
      ) : (
        <ol className="relative space-y-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-5 py-2 shadow-[var(--shadow-xs)] before:absolute before:bottom-6 before:left-[29px] before:top-6 before:w-px before:bg-[var(--border)]">
          {events.map((e) => (
            <li key={e.id} className="relative py-4 pl-7">
              <span className="absolute left-0 top-[22px] size-2.5 rounded-full bg-[var(--navy-800)] ring-[3px] ring-white" />
              <p className="text-[12px] font-medium tabular-nums text-[var(--text-muted)]">
                {formatDate(e.occurredAt)}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--navy-950)]">
                {e.title}
              </p>
              {e.shortDescription ? (
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  {e.shortDescription}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TerrainCalendarTab({ r }: { r: Requisition }) {
  return <CalendarWorkspace requisition={r} />;
}
