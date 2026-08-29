"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import type { Requisition } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/core";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  createTerrainEvent,
  getRequisitionEvents,
  type TerrainEventDto,
} from "@/lib/api/phase1";
import { toast } from "sonner";
import { CalendarWorkspace } from "@/features/calendar/calendar-workspace";

export function TerrainTimelineTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const [events, setEvents] = useState<TerrainEventDto[] | null>(null);
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getRequisitionEvents(r.id)
      .then((rows) => {
        if (cancelled) return;
        startTransition(() => {
          setEvents(Array.isArray(rows) ? rows : []);
        });
      })
      .catch(() => {
        if (cancelled) return;
        startTransition(() => setEvents([]));
      });
    return () => {
      cancelled = true;
    };
  }, [r.id, startTransition]);

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
                    occurredAt: new Date(
                      `${occurredAt}T12:00:00.000Z`,
                    ).toISOString(),
                    title: title.trim(),
                  });
                  setTitle("");
                  setOpen(false);
                  toast.success("Mise à jour ajoutée");
                  const rows = await getRequisitionEvents(r.id);
                  setEvents(Array.isArray(rows) ? rows : []);
                } catch {
                  toast.error("Impossible d’ajouter l’événement");
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {events === null ? (
        <Skeleton className="h-40" />
      ) : events.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">
          Aucun événement validé pour l’instant.
        </p>
      ) : (
        <ol className="relative ml-2 space-y-0 border-l border-[var(--border)]">
          {events.map((e) => (
            <li key={e.id} className="relative pb-6 pl-5">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-[var(--navy-800)]" />
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
