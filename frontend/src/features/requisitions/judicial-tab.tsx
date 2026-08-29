"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetRequisitionEventsQueryKey,
  getGetRequisitionLegalCasesQueryKey,
  useGetRequisitionEvents,
  useGetRequisitionLegalCases,
} from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, Dialog, EmptyState, Skeleton, StatusBadge } from "@/components/ui/core";
import { useAuth } from "@/providers/auth-provider";
import { createLegalCase, createTerrainEvent, rescheduleTerrainEvent } from "@/lib/api/phase-b";
import { formatDate } from "@/lib/utils";
import { CalendarPlus, Gavel, Plus } from "lucide-react";
import { toast } from "sonner";

type JudicialEvent = { id: string; legalCaseId?: string | null; type: string; title: string; occurredAt: string; shortDescription?: string | null; isScheduled: boolean; scheduledAt?: string | null };
type LegalCase = { id: string; number: string; court: string; phase: string; currentStage: string; currentStatus?: string | null; latestEvent?: { title: string; occurredAt: string } | null; nextEvent?: { title: string; scheduledAt: string } | null };
const eventTypes = [["COURT_TRANSMISSION", "Transmission au tribunal"], ["COURT_HEARING_SCHEDULED", "Audience programmée"], ["COURT_HEARING_HELD", "Audience tenue"], ["COURT_DELIBERATION", "Délibération"], ["COURT_DECISION", "Décision"], ["COURT_APPEAL", "Appel"], ["COURT_CLOSED", "Clôture"], ["COURT_OTHER", "Autre événement judiciaire"]] as const;
const stages = ["A_CONFIRMER", "TRANSMIS_AU_TRIBUNAL", "ENREGISTRE_AU_TRIBUNAL", "EN_ATTENTE_AUDIENCE", "AUDIENCE_PROGRAMMEE", "AUDIENCE_TENUE", "REPORTE", "EN_DELIBERE", "DECISION_RENDUE", "APPEL_EN_COURS", "CLOTURE"];
const judicialTypes = new Set(["COURT_TRANSMISSION", "COURT_CASE_CREATED", "COURT_HEARING_SCHEDULED", "COURT_HEARING_POSTPONED", "COURT_HEARING_HELD", "COURT_DELIBERATION", "COURT_DECISION", "COURT_APPEAL", "COURT_CLOSED", "COURT_OTHER"]);

export function JudicialTrackingTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const qc = useQueryClient();
  const casesQuery = useGetRequisitionLegalCases(r.id);
  const eventsQuery = useGetRequisitionEvents(r.id);
  const cases = (casesQuery.data?.data ?? []) as unknown as LegalCase[];
  const events = ((eventsQuery.data?.data ?? []) as unknown as JudicialEvent[]).filter((event) => judicialTypes.has(event.type));
  const [caseOpen, setCaseOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = async () => Promise.all([qc.invalidateQueries({ queryKey: getGetRequisitionLegalCasesQueryKey(r.id) }), qc.invalidateQueries({ queryKey: getGetRequisitionEventsQueryKey(r.id) })]);
  if (casesQuery.isLoading || eventsQuery.isLoading) return <Skeleton className="h-72" />;
  const futureEvents = events.filter((event) => event.isScheduled && event.scheduledAt && new Date(event.scheduledAt) > new Date());

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[17px] font-semibold text-[var(--navy-950)]">Suivi judiciaire</h2>{admin && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setCaseOpen(true)}><Plus className="size-4" /> Affaire</Button><Button size="sm" onClick={() => setEventOpen(true)}><Gavel className="size-4" /> Événement</Button>{futureEvents.length > 0 && <Button size="sm" variant="secondary" onClick={() => setRescheduleOpen(true)}><CalendarPlus className="size-4" /> Reporter</Button>}</div>}</div>
    {cases.length === 0 ? <EmptyState title="Aucune affaire judiciaire enregistrée" description="Aucune affaire n’est actuellement reliée à ce terrain." /> : <div className="grid gap-3 md:grid-cols-2">{cases.map((courtCase) => <Card key={courtCase.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[var(--text-muted)]">Affaire</p><p className="mt-1 font-semibold">{courtCase.number}</p></div><StatusBadge status={courtCase.currentStage} /></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--text-muted)]">Tribunal</dt><dd className="mt-1">{courtCase.court}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Statut actuel</dt><dd className="mt-1">{courtCase.currentStatus || courtCase.currentStage}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Dernier événement</dt><dd className="mt-1">{courtCase.latestEvent?.title ?? "Aucun"}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Prochaine date</dt><dd className="mt-1">{courtCase.nextEvent ? formatDate(courtCase.nextEvent.scheduledAt) : "Aucune"}</dd></div></dl></Card>)}</div>}
    <Card className="overflow-hidden"><div className="border-b border-[var(--border)] px-5 py-4"><h3 className="text-sm font-semibold">Historique judiciaire</h3></div>{events.length === 0 ? <p className="px-5 py-6 text-sm text-[var(--text-muted)]">Aucun événement judiciaire enregistré.</p> : <ol className="divide-y divide-[var(--border)]">{events.map((event) => <li key={event.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[130px_1fr]"><time className="text-xs text-[var(--text-muted)]">{formatDate(event.occurredAt)}</time><div><p className="text-sm font-medium">{event.title}</p>{event.shortDescription && <p className="mt-1 text-xs text-[var(--text-muted)]">{event.shortDescription}</p>}{event.isScheduled && event.scheduledAt && <p className="mt-1 text-xs font-medium">Échéance : {formatDate(event.scheduledAt)}</p>}</div></li>)}</ol>}</Card>
    <CaseDialog open={caseOpen} close={() => setCaseOpen(false)} requisitionId={r.id} busy={busy} submit={async (body) => { setBusy(true); try { await createLegalCase(body); await refresh(); setCaseOpen(false); toast.success("Affaire créée"); } catch { toast.error("Impossible de créer l’affaire"); } finally { setBusy(false); } }} />
    <EventDialog open={eventOpen} close={() => setEventOpen(false)} requisitionId={r.id} cases={cases} busy={busy} submit={async (body) => { setBusy(true); try { await createTerrainEvent(body); await refresh(); setEventOpen(false); toast.success("Événement enregistré"); } catch { toast.error("Impossible d’enregistrer l’événement"); } finally { setBusy(false); } }} />
    <RescheduleDialog open={rescheduleOpen} close={() => setRescheduleOpen(false)} events={futureEvents} busy={busy} submit={async (id, scheduledAt) => { setBusy(true); try { await rescheduleTerrainEvent(id, { scheduledAt: new Date(scheduledAt).toISOString() }); await refresh(); setRescheduleOpen(false); toast.success("Audience reportée"); } catch { toast.error("Impossible de reporter l’audience"); } finally { setBusy(false); } }} />
  </div>;
}

function CaseDialog({ open, close, requisitionId, busy, submit }: { open: boolean; close: () => void; requisitionId: string; busy: boolean; submit: (body: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ caseNumber: "", courtName: "", caseType: "", currentPhase: "", currentStage: "A_CONFIRMER", opposingParties: "" });
  return <Dialog open={open} onOpenChange={(value) => !value && close()} title="Créer une affaire"><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit({ requisitionId, ...form }); }}>{[["caseNumber", "N° dossier"], ["courtName", "Tribunal"], ["caseType", "Type d’affaire"], ["currentPhase", "Phase"], ["opposingParties", "Parties adverses"]].map(([key, label]) => <label key={key} className="text-xs font-medium">{label}<input required className="nf-input mt-1" value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<label className="text-xs font-medium">Statut UI<select className="nf-input mt-1" value={form.currentStage} onChange={(e) => setForm({ ...form, currentStage: e.target.value })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><Button disabled={busy} type="submit">Créer l’affaire</Button></form></Dialog>;
}

function EventDialog({ open, close, requisitionId, cases, busy, submit }: { open: boolean; close: () => void; requisitionId: string; cases: LegalCase[]; busy: boolean; submit: (body: Record<string, unknown>) => Promise<void> }) {
  const [type, setType] = useState("COURT_HEARING_SCHEDULED"); const [title, setTitle] = useState("Audience programmée"); const [legalCaseId, setLegalCaseId] = useState(""); const [date, setDate] = useState(""); const [description, setDescription] = useState(""); const scheduled = type === "COURT_HEARING_SCHEDULED";
  return <Dialog open={open} onOpenChange={(value) => !value && close()} title="Ajouter un événement judiciaire"><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); const iso = new Date(date).toISOString(); void submit({ requisitionId, type, title, shortDescription: description || undefined, legalCaseId: legalCaseId || undefined, occurredAt: scheduled ? new Date().toISOString() : iso, isScheduled: scheduled, scheduledAt: scheduled ? iso : undefined }); }}><label className="text-xs font-medium">Affaire<select className="nf-input mt-1" value={legalCaseId} onChange={(e) => setLegalCaseId(e.target.value)}><option value="">Événement général</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}</select></label><label className="text-xs font-medium">Type<select className="nf-input mt-1" value={type} onChange={(e) => { setType(e.target.value); setTitle(eventTypes.find(([value]) => value === e.target.value)?.[1] ?? "Événement judiciaire"); }}>{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-medium">Titre<input required className="nf-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="text-xs font-medium">{scheduled ? "Date programmée" : "Date de l’événement"}<input required type="datetime-local" className="nf-input mt-1" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="text-xs font-medium">Résultat / note<textarea className="nf-input mt-1 min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} /></label><Button disabled={busy} type="submit">Enregistrer</Button></form></Dialog>;
}

function RescheduleDialog({ open, close, events, busy, submit }: { open: boolean; close: () => void; events: JudicialEvent[]; busy: boolean; submit: (id: string, date: string) => Promise<void> }) {
  const [id, setId] = useState(""); const [date, setDate] = useState("");
  return <Dialog open={open} onOpenChange={(value) => !value && close()} title="Reporter une audience"><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(id, date); }}><label className="text-xs font-medium">Échéance<select required className="nf-input mt-1" value={id} onChange={(e) => setId(e.target.value)}><option value="">Choisir</option>{events.map((item) => <option key={item.id} value={item.id}>{item.title} · {formatDate(item.scheduledAt)}</option>)}</select></label><label className="text-xs font-medium">Nouvelle date<input required type="datetime-local" className="nf-input mt-1" min={new Date().toISOString().slice(0, 16)} value={date} onChange={(e) => setDate(e.target.value)} /></label><Button disabled={busy || !id} type="submit">Confirmer le report</Button></form></Dialog>;
}
