"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetRequisitions, useGetUsers } from "@/generated/api/naala";
import type { Requisition, UserItem } from "@/types/domain";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/core";
import {
  getRequisitionAccess,
  grantRequisitionAccess,
  revokeRequisitionAccess,
} from "@/lib/api/phase1";
import { toast } from "sonner";
import { domainQueryKeys } from "@/lib/api/query-keys";
import { uiErrorMessage } from "@/lib/api/error-message";

type AccessRow = {
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
};

export default function AffectationsPage() {
  const queryClient = useQueryClient();
  const reqQuery = useGetRequisitions();
  const usersQuery = useGetUsers();
  const terrains = ((reqQuery.data?.data ?? []) as Requisition[]).filter(
    (r) => r.isPrincipal !== false && r.number !== "R 16605/31",
  );
  const users = useMemo(
    () => (usersQuery.data?.data ?? []) as UserItem[],
    [usersQuery.data?.data],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = selectedId ?? terrains[0]?.id ?? "";
  const [userId, setUserId] = useState("");

  const selected = useMemo(
    () => terrains.find((t) => t.id === effectiveSelectedId),
    [terrains, effectiveSelectedId],
  );

  const accessQuery = useQuery({
    queryKey: domainQueryKeys.requisitionAccess(effectiveSelectedId),
    queryFn: () => getRequisitionAccess(effectiveSelectedId),
    enabled: Boolean(effectiveSelectedId),
    select: (rows): AccessRow[] => (Array.isArray(rows) ? rows : []),
  });
  const access = useMemo(() => accessQuery.data ?? [], [accessQuery.data]);

  const revokeMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      revokeRequisitionAccess(effectiveSelectedId, targetUserId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: domainQueryKeys.requisitionAccess(effectiveSelectedId),
      });
      toast.success("Accès retiré");
    },
    onError: (error) => toast.error(uiErrorMessage(error, "Échec du retrait d’accès")),
  });

  const grantMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      grantRequisitionAccess(effectiveSelectedId, targetUserId),
    onSuccess: async () => {
      setUserId("");
      await queryClient.invalidateQueries({
        queryKey: domainQueryKeys.requisitionAccess(effectiveSelectedId),
      });
      toast.success("Terrain affecté");
    },
    onError: (error) => toast.error(uiErrorMessage(error, "Échec de l’affectation")),
  });

  const assignedIds = useMemo(() => new Set(access.map((row) => row.userId)), [access]);
  const assignable = useMemo(
    () => users.filter((user) => !assignedIds.has(user.id)),
    [assignedIds, users],
  );

  return (
    <>
      <PageHeader
        title="Affectation des terrains"
        subtitle="Un utilisateur ne voit que les terrains qui lui sont assignés."
      />

      {reqQuery.isLoading ? (
        <Skeleton className="h-64" />
      ) : terrains.length === 0 ? (
        <EmptyState title="Aucun terrain" description="Créez d’abord un terrain." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="nf-panel space-y-1 p-2">
            {terrains.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-[var(--radius-md)] px-3.5 py-3 text-left text-[13px] transition ${
                  effectiveSelectedId === t.id
                    ? "bg-[var(--navy-950)] text-white"
                    : "hover:bg-[var(--surface-muted)] text-[var(--text)]"
                }`}
              >
                <span className="font-semibold">{t.number}</span>
                <span className="mt-0.5 block opacity-80">{t.property}</span>
              </button>
            ))}
          </div>

          <div className="nf-panel-raised p-5 sm:p-6">
            {selected ? (
              <>
                <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
                  {selected.number} — {selected.property}
                </h2>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Utilisateurs ayant accès
                </p>

                {accessQuery.isLoading ? (
                  <Skeleton className="mt-4 h-24" />
                ) : (
                  <ul className="mt-4 space-y-2">
                    {access.length === 0 && (
                      <li className="text-[13px] text-[var(--text-muted)]">
                        Aucun utilisateur affecté.
                      </li>
                    )}
                    {access.map((row) => {
                      const label = row.user
                        ? `${row.user.firstName} ${row.user.lastName}`
                        : users.find((u) => u.id === row.userId)?.name ??
                          row.userId;
                      return (
                        <li
                          key={row.userId}
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                        >
                          <span className="text-[13px]">{label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              revokeMutation.isPending &&
                              revokeMutation.variables === row.userId
                            }
                            onClick={() => revokeMutation.mutate(row.userId)}
                          >
                            Retirer
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex-1 text-[12px] font-medium text-[var(--text-muted)]">
                    Ajouter un utilisateur
                    <select
                      className="nf-input mt-1"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    >
                      <option value="">Choisir…</option>
                      {assignable.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    disabled={!userId || grantMutation.isPending}
                    onClick={() => grantMutation.mutate(userId)}
                  >
                    Affecter
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
