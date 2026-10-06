"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetRequisitionQueryKey,
  useUpdateRequisition,
} from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { Dialog } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uiErrorMessage } from "@/lib/api/error-message";

type OverviewEditDialogProps = {
  r: Requisition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

const FRESHNESS_OPTIONS = [
  "À jour",
  "Résultat à renseigner",
  "Situation à actualiser",
  "Date ou nature à clarifier",
  "Aucun événement judiciaire confirmé",
] as const;

export function OverviewEditDialog({
  r,
  open,
  onOpenChange,
}: OverviewEditDialogProps) {
  const qc = useQueryClient();
  const update = useUpdateRequisition();
  const [statusLabel, setStatusLabel] = useState(r.status || "");
  const [situation, setSituation] = useState(
    r.currentSituation ?? r.issue ?? "",
  );
  const [latestEvent, setLatestEvent] = useState(
    r.latestKnownEvent ?? r.event ?? "",
  );
  const [latestEventAt, setLatestEventAt] = useState(
    r.latestKnownEventAt ?? "",
  );
  const [eventResult, setEventResult] = useState(r.eventResult ?? "");
  const [courtReached, setCourtReached] = useState(
    r.courtReached === "Oui"
      ? "Oui"
      : r.courtReached === "Non"
        ? "Non"
        : "À confirmer",
  );
  const [judicialEvent, setJudicialEvent] = useState(
    r.latestJudicialEvent ?? "",
  );
  const [judicialEventAt, setJudicialEventAt] = useState(
    r.latestJudicialEventAt ?? "",
  );
  const [judicialResult, setJudicialResult] = useState(r.judicialResult ?? "");
  const [nextDate, setNextDate] = useState(r.nextScheduledEventAt ?? "");
  const [freshness, setFreshness] = useState(
    r.dataFreshness ?? "Situation à actualiser",
  );
  const [points, setPoints] = useState(
    (r.pointsToClarify ?? r.constraints ?? r.criticalDetails ?? []).join("\n"),
  );

  const save = async () => {
    try {
      await update.mutateAsync({
        id: r.id,
        data: {
          mainStatusLabel: statusLabel.trim() || undefined,
          currentSituation: situation.trim() || undefined,
          latestKnownEvent: latestEvent.trim() || undefined,
          latestKnownEventAt: latestEventAt || undefined,
          eventResult: eventResult.trim() || undefined,
          courtReached,
          latestJudicialEvent: judicialEvent.trim() || undefined,
          latestJudicialEventAt: judicialEventAt || undefined,
          judicialResult: judicialResult.trim() || undefined,
          nextScheduledEventAt: nextDate || undefined,
          dataFreshness: freshness,
          pointsToClarify: linesToList(points),
          constraints: linesToList(points),
          eventLabel: latestEvent.trim() || undefined,
        } as never,
      });
      await qc.invalidateQueries({ queryKey: getGetRequisitionQueryKey(r.id) });
      toast.success("Situation factuelle mise à jour");
      onOpenChange(false);
    } catch (error) {
      toast.error(uiErrorMessage(error, "Impossible d’enregistrer"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mettre à jour la situation"
      description="Faits confirmés uniquement — pas de recommandations stratégiques."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Statut affiché">
            <input
              className="nf-input w-full"
              value={statusLabel}
              onChange={(e) => setStatusLabel(e.target.value)}
            />
          </Field>
          <Field label="Tribunal atteint">
            <select
              className="nf-input w-full"
              value={courtReached}
              onChange={(e) => setCourtReached(e.target.value)}
            >
              <option value="Oui">Oui</option>
              <option value="Non">Non</option>
              <option value="À confirmer">Transmission à confirmer</option>
            </select>
          </Field>
        </div>
        <Field label="Situation actuelle (explication)">
          <textarea
            className="nf-input min-h-[72px] w-full resize-y"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dernier événement connu">
            <input
              className="nf-input w-full"
              value={latestEvent}
              onChange={(e) => setLatestEvent(e.target.value)}
            />
          </Field>
          <Field label="Date de l’événement">
            <input
              type="date"
              className="nf-input w-full"
              value={latestEventAt}
              onChange={(e) => setLatestEventAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Résultat / suite de l’événement">
          <input
            className="nf-input w-full"
            value={eventResult}
            onChange={(e) => setEventResult(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dernier événement judiciaire">
            <input
              className="nf-input w-full"
              value={judicialEvent}
              onChange={(e) => setJudicialEvent(e.target.value)}
            />
          </Field>
          <Field label="Date judiciaire connue">
            <input
              type="date"
              className="nf-input w-full"
              value={judicialEventAt}
              onChange={(e) => setJudicialEventAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Résultat / statut judiciaire">
          <input
            className="nf-input w-full"
            value={judicialResult}
            onChange={(e) => setJudicialResult(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prochaine date réelle">
            <input
              type="date"
              className="nf-input w-full"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </Field>
          <Field label="Fraîcheur des données">
            <select
              className="nf-input w-full"
              value={freshness}
              onChange={(e) => setFreshness(e.target.value)}
            >
              {FRESHNESS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Points à clarifier (une ligne, max. 4)">
          <textarea
            className="nf-input min-h-[96px] w-full resize-y"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
