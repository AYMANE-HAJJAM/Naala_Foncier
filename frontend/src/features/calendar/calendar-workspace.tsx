"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCalendarEventsQueryKey,
  getGetUpcomingCalendarEventsQueryKey,
  useCreateTerrainEvent,
  useGetCalendarEvents,
  useGetRequisitions,
  useGetUpcomingCalendarEvents,
} from "@/generated/api/naala";
import type { CreateTerrainEventDtoType } from "@/generated/api/model";
import { PageHeader, SectionHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Card, Dialog, EmptyState, Skeleton } from "@/components/ui/core";
import { useAuth } from "@/providers/auth-provider";
import { cn, formatDate } from "@/lib/utils";
import type { Requisition } from "@/types/domain";
import { toast } from "sonner";
import { uiErrorMessage } from "@/lib/api/error-message";

export type CalendarEventItem = {
  id: string;
  requisitionId: string;
  requisitionReference: string;
  propertyName: string;
  type: string;
  title: string;
  shortDescription?: string | null;
  occurredAt: string;
  scheduledAt?: string | null;
  calendarAt: string;
  isScheduled: boolean;
};

const EVENT_TYPES: Array<{
  value: CreateTerrainEventDtoType;
  label: string;
}> = [
  { value: "COURT_HEARING_SCHEDULED", label: "Audience" },
  { value: "COURT_DELIBERATION", label: "Délibération" },
  { value: "BORNAGE_SCHEDULED", label: "Bornage" },
  { value: "ANCFCC_STATUS_UPDATED", label: "Échéance" },
  { value: "GENERAL_UPDATE", label: "Réunion" },
  { value: "OTHER", label: "Autre" },
];

const TYPE_LABELS: Record<string, string> = {
  COURT_HEARING_SCHEDULED: "Audience",
  COURT_HEARING_POSTPONED: "Audience reportée",
  COURT_DELIBERATION: "Délibération",
  COURT_DECISION: "Décision",
  BORNAGE_SCHEDULED: "Bornage",
  BORNAGE_ATTEMPTED: "Bornage",
  BORNAGE_BLOCKED: "Bornage",
  BORNAGE_COMPLETED: "Bornage",
  DOCUMENT_RECEIVED: "Document",
  ANCFCC_STATUS_UPDATED: "Échéance",
  GENERAL_UPDATE: "Réunion",
  OTHER: "Autre",
};

export function isUpcomingCalendarEvent(
  event: Pick<CalendarEventItem, "isScheduled" | "scheduledAt">,
  now: Date,
) {
  if (!event.isScheduled || !event.scheduledAt) return false;
  const scheduledAt = new Date(event.scheduledAt);
  return !Number.isNaN(scheduledAt.getTime()) && scheduledAt >= now;
}

function eventDate(event: CalendarEventItem) {
  return new Date(event.calendarAt || event.scheduledAt || event.occurredAt);
}

function eventTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? "Événement";
}

function dateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non renseignée";
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  return hasTime
    ? `${formatDate(date.toISOString())} à ${format(date, "HH:mm")}`
    : formatDate(date.toISOString());
}

function CalendarEventLink({ event }: { event: CalendarEventItem }) {
  return (
    <Link
      href={`/requisitions/${event.requisitionId}?tab=calendrier`}
      className="block min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-3.5 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--navy-950)]">
            {event.title}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {eventTypeLabel(event.type)} · {event.requisitionReference}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text)]">
          {dateTimeLabel(event.calendarAt)}
        </span>
      </div>
    </Link>
  );
}

function NewEventDialog({
  open,
  onOpenChange,
  requisitions,
  lockedRequisition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisitions: Requisition[];
  lockedRequisition?: Requisition;
}) {
  const queryClient = useQueryClient();
  const createEvent = useCreateTerrainEvent();
  const today = format(new Date(), "yyyy-MM-dd");
  const [requisitionId, setRequisitionId] = useState(
    lockedRequisition?.id ?? requisitions[0]?.id ?? "",
  );
  const [type, setType] = useState<CreateTerrainEventDtoType>(
    "COURT_HEARING_SCHEDULED",
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");

  const submit = async () => {
    const targetId = lockedRequisition?.id ?? requisitionId;
    if (!targetId || !title.trim() || !date) {
      toast.error("Terrain, titre et date sont obligatoires");
      return;
    }
    const scheduledAt = new Date(`${date}T${time || "12:00"}:00`);
    try {
      await createEvent.mutateAsync({
        data: {
          requisitionId: targetId,
          type,
          title: title.trim(),
          shortDescription: description.trim() || undefined,
          occurredAt: scheduledAt.toISOString(),
          scheduledAt: scheduledAt.toISOString(),
          isScheduled: true,
          source: "MANUAL",
          validationStatus: "CONFIRMED",
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetCalendarEventsQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetUpcomingCalendarEventsQueryKey(),
        }),
      ]);
      setTitle("");
      setDescription("");
      setTime("");
      setDate(today);
      onOpenChange(false);
      toast.success("Événement ajouté au calendrier");
    } catch (error) {
      toast.error(uiErrorMessage(error, "Impossible d’ajouter l’événement"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouvel événement"
      description="Ajoutez une date confirmée au calendrier."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="nf-label sm:col-span-2">
          Terrain
          {lockedRequisition ? (
            <div className="nf-input mt-1 flex items-center">
              {lockedRequisition.number} · {lockedRequisition.property}
            </div>
          ) : (
            <select
              className="nf-input mt-1"
              value={requisitionId}
              onChange={(event) => setRequisitionId(event.target.value)}
            >
              {requisitions.map((requisition) => (
                <option key={requisition.id} value={requisition.id}>
                  {requisition.number} · {requisition.property}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="nf-label">
          Type
          <select
            className="nf-input mt-1"
            value={type}
            onChange={(event) =>
              setType(event.target.value as CreateTerrainEventDtoType)
            }
          >
            {EVENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="nf-label">
          Titre
          <input
            className="nf-input mt-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />
        </label>
        <label className="nf-label">
          Date
          <input
            className="nf-input mt-1"
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="nf-label">
          Heure optionnelle
          <input
            className="nf-input mt-1"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
        <label className="nf-label sm:col-span-2">
          Description courte optionnelle
          <textarea
            className="nf-input mt-1 min-h-20 resize-y py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={createEvent.isPending}>
          {createEvent.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Dialog>
  );
}

export function CalendarWorkspace({
  requisition,
  withHeader = false,
}: {
  requisition?: Requisition;
  withHeader?: boolean;
}) {
  const { isAdmin: admin } = useAuth();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [newEventOpen, setNewEventOpen] = useState(false);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const queryStart = subDays(monthStart, 30);
  const eventsQuery = useGetCalendarEvents({
    from: queryStart.toISOString(),
    to: monthEnd.toISOString(),
  });
  const upcomingQuery = useGetUpcomingCalendarEvents({ days: "365" });
  const requisitionsQuery = useGetRequisitions(undefined, {
    query: { enabled: admin && !requisition },
  });

  const calendarEvents = useMemo(() => {
    const rows = (eventsQuery.data?.data ??
      []) as unknown as CalendarEventItem[];
    return rows.filter(
      (event) => !requisition || event.requisitionId === requisition.id,
    );
  }, [eventsQuery.data, requisition]);
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const rows = (upcomingQuery.data?.data ??
      []) as unknown as CalendarEventItem[];
    return rows
      .filter(
        (event) =>
          (!requisition || event.requisitionId === requisition.id) &&
          isUpcomingCalendarEvent(event, now),
      )
      .sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
  }, [requisition, upcomingQuery.data]);
  const recentEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((event) => eventDate(event) < now)
      .sort((a, b) => eventDate(b).getTime() - eventDate(a).getTime())
      .slice(0, 8);
  }, [calendarEvents]);
  const requisitions = (
    (requisitionsQuery.data?.data ?? []) as Requisition[]
  ).filter(
    (item) => item.isPrincipal !== false && item.number !== "R 16605/31",
  );

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const offset = (getDay(first) + 6) % 7;
  const days = Array.from(
    { length: offset + Number(format(last, "d")) },
    (_, index) => (index < offset ? null : addDays(first, index - offset)),
  );

  const content = (
    <>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mois précédent"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-sm font-semibold capitalize text-[var(--navy-950)]">
              {format(month, "MMMM yyyy", { locale: fr })}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mois suivant"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {eventsQuery.isLoading ? (
            <Skeleton className="m-4 h-96" />
          ) : (
            <div className="max-w-full overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(
                    (day) => (
                      <div
                        key={day}
                        className="p-2 text-center text-[10px] font-semibold uppercase text-[var(--text-muted)]"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    const dayKey = day ? format(day, "yyyy-MM-dd") : "";
                    const dayEvents = day
                      ? calendarEvents.filter(
                          (event) =>
                            format(eventDate(event), "yyyy-MM-dd") === dayKey,
                        )
                      : [];
                    return (
                      <div
                        key={`${dayKey}-${index}`}
                        className="min-h-24 border-b border-r border-[var(--border)] p-2 transition-colors hover:bg-[var(--surface-muted)]/70"
                      >
                        <span
                          className={cn(
                            "grid size-6 place-items-center text-xs",
                            dayKey === format(new Date(), "yyyy-MM-dd") &&
                              "rounded-full bg-[var(--navy-950)] text-white",
                          )}
                        >
                          {day ? format(day, "d") : ""}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <Link
                              key={event.id}
                              href={`/requisitions/${event.requisitionId}?tab=calendrier`}
                              className="block truncate rounded-[var(--radius-sm)] border border-amber-200/60 bg-amber-50 px-1.5 py-1 text-[9px] font-semibold text-amber-900 hover:bg-amber-100"
                              title={`${event.requisitionReference} · ${event.title}`}
                            >
                              {event.requisitionReference} ·{" "}
                              {eventTypeLabel(event.type)}
                            </Link>
                          ))}
                          {dayEvents.length > 3 ? (
                            <span className="block text-[9px] text-[var(--text-muted)]">
                              +{dayEvents.length - 3} événement(s)
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Prochaines échéances" bordered />
            <div className="space-y-2 p-4">
              {upcomingQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : upcomingEvents.length === 0 ? (
                <EmptyState
                  title="Aucune échéance programmée"
                  description="Les prochaines dates confirmées apparaîtront ici."
                  className="py-7"
                />
              ) : (
                upcomingEvents
                  .slice(0, 12)
                  .map((event) => (
                    <CalendarEventLink key={event.id} event={event} />
                  ))
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Événements récents"
              subtitle="Dates passées à consulter ou actualiser"
              bordered
            />
            <div className="space-y-2 p-4">
              {recentEvents.length === 0 ? (
                <p className="text-[13px] text-[var(--text-muted)]">
                  Aucun événement récent.
                </p>
              ) : (
                recentEvents.map((event) => (
                  <CalendarEventLink key={event.id} event={event} />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {admin ? (
        <NewEventDialog
          open={newEventOpen}
          onOpenChange={setNewEventOpen}
          requisitions={requisitions}
          lockedRequisition={requisition}
        />
      ) : null}
    </>
  );

  if (!withHeader) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[var(--text-muted)]">
            Échéances confirmées de ce terrain.
          </p>
          {admin ? (
            <Button size="sm" onClick={() => setNewEventOpen(true)}>
              <Plus className="size-4" />
              Nouvel événement
            </Button>
          ) : null}
        </div>
        {content}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendrier"
        subtitle={
          admin
            ? "Suivez les échéances de l’ensemble des terrains."
            : "Suivez les échéances de vos terrains."
        }
        actions={
          admin ? (
            <Button onClick={() => setNewEventOpen(true)}>
              <Plus className="size-4" />
              Nouvel événement
            </Button>
          ) : undefined
        }
      />
      {content}
    </>
  );
}
