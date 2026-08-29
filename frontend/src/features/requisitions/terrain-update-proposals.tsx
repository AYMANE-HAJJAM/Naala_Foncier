"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/core";
import {
  confirmRequisitionAiProposal,
  getRequisitionAiProposals,
  rejectRequisitionAiProposal,
  type TerrainUpdateProposalDto,
} from "@/lib/api/phase1";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

function confidenceLabel(c: string) {
  if (c === "HIGH" || c === "ELEVEE") return "Confiance élevée";
  if (c === "MEDIUM" || c === "MOYENNE") return "Confiance moyenne";
  return "Confiance faible";
}

export function TerrainUpdateProposalsPanel({
  requisitionId,
}: {
  requisitionId: string;
}) {
  const { isAdmin: admin } = useAuth();
  const qc = useQueryClient();
  const [proposals, setProposals] = useState<TerrainUpdateProposalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!admin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await getRequisitionAiProposals(requisitionId);
      setProposals(rows.filter((p) => p.status === "PROPOSED"));
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [admin, requisitionId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  if (!admin) return null;
  if (loading) {
    return (
      <Card className="p-4 text-sm text-[var(--text-muted)]">
        Chargement des mises à jour proposées…
      </Card>
    );
  }
  if (!proposals.length) return null;

  const confirm = async (
    p: TerrainUpdateProposalDto,
    resolution?: "KEEP_CURRENT" | "USE_PROPOSED" | "MANUAL_VALUE",
  ) => {
    setBusyId(p.id);
    try {
      await confirmRequisitionAiProposal(requisitionId, p.id, {
        resolution,
        manualValue: manualValues[p.id],
      });
      toast.success("Proposition confirmée");
      await load();
      void qc.invalidateQueries({ queryKey: [`/api/requisitions/${requisitionId}`] });
      void qc.invalidateQueries({ queryKey: [`/api/requisitions/${requisitionId}/events`] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de confirmation");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (p: TerrainUpdateProposalDto) => {
    setBusyId(p.id);
    try {
      await rejectRequisitionAiProposal(requisitionId, p.id);
      toast.success("Proposition rejetée");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du rejet");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--navy-950)]">
            Mises à jour proposées
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {proposals.length} proposition{proposals.length > 1 ? "s" : ""} à
            vérifier — analyse automatique
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
          Actualiser
        </Button>
      </div>

      <div className="space-y-3">
        {proposals.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--navy-950)]">
                  {p.title}
                </p>
                {p.summary && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.summary}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                {confidenceLabel(String(p.confidence))}
              </span>
            </div>

            {p.proposalType === "IDENTITY_CONFLICT" && (
              <div className="mt-3 space-y-2 text-xs">
                <p>
                  <span className="text-[var(--text-muted)]">Actuel :</span>{" "}
                  {String(p.proposedData.currentValue ?? "—")}
                </p>
                <p>
                  <span className="text-[var(--text-muted)]">Document :</span>{" "}
                  {String(p.proposedData.documentValue ?? "—")}
                </p>
                <input
                  placeholder="Valeur manuelle (optionnel)"
                  value={manualValues[p.id] ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setManualValues((m) => ({ ...m, [p.id]: e.target.value }))
                  }
                  className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-white px-2 text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === p.id}
                    onClick={() => void confirm(p, "KEEP_CURRENT")}
                  >
                    Conserver actuelle
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === p.id}
                    onClick={() => void confirm(p, "USE_PROPOSED")}
                  >
                    Utiliser nouvelle
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === p.id || !manualValues[p.id]?.trim()}
                    onClick={() => void confirm(p, "MANUAL_VALUE")}
                  >
                    Saisir manuellement
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
              {p.sourceFilename && (
                <span>
                  Source : {p.sourceFilename}
                  {p.sourcePage ? ` — p. ${p.sourcePage}` : ""}
                </span>
              )}
              {p.evidenceText && (
                <span className="italic">&laquo; {p.evidenceText} &raquo;</span>
              )}
            </div>

            {p.proposalType !== "IDENTITY_CONFLICT" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busyId === p.id}
                  onClick={() => void confirm(p)}
                >
                  <Check className="size-3.5" />
                  Confirmer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === p.id}
                  onClick={() => void reject(p)}
                >
                  <X className="size-3.5" />
                  Rejeter
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        Les propositions ne modifient pas les données officielles tant qu’un
        administrateur ne les confirme pas.
      </p>
    </Card>
  );
}
