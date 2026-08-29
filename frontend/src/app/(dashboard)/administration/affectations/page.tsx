"use client";

import { useEffect, useMemo, useState } from "react";
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

type AccessRow = {
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
};

export default function AffectationsPage() {
  const reqQuery = useGetRequisitions();
  const usersQuery = useGetUsers();
  const terrains = ((reqQuery.data?.data ?? []) as Requisition[]).filter(
    (r) => r.isPrincipal !== false && r.number !== "R 16605/31",
  );
  const users = (usersQuery.data?.data ?? []) as UserItem[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = selectedId ?? terrains[0]?.id ?? "";
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [userId, setUserId] = useState("");

  const selected = useMemo(
    () => terrains.find((t) => t.id === effectiveSelectedId),
    [terrains, effectiveSelectedId],
  );

  useEffect(() => {
    if (!effectiveSelectedId) return;
    let cancelled = false;
    (async () => {
      setLoadingAccess(true);
      try {
        const rows = await getRequisitionAccess(effectiveSelectedId);
        if (!cancelled) setAccess(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) {
          setAccess([]);
          toast.error("Impossible de charger les affectations");
        }
      } finally {
        if (!cancelled) setLoadingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedId]);

  const assignedIds = new Set(access.map((a) => a.userId));
  const assignable = users.filter((u) => !assignedIds.has(u.id));

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
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-1">
            {terrains.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-[var(--radius-md)] px-3 py-2.5 text-left text-[13px] transition ${
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

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            {selected ? (
              <>
                <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
                  {selected.number} — {selected.property}
                </h2>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Utilisateurs ayant accès
                </p>

                {loadingAccess ? (
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
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
                        >
                          <span className="text-[13px]">{label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await revokeRequisitionAccess(
                                  selected.id,
                                  row.userId,
                                );
                                setAccess((prev) =>
                                  prev.filter((a) => a.userId !== row.userId),
                                );
                                toast.success("Accès retiré");
                              } catch {
                                toast.error("Échec du retrait d’accès");
                              }
                            }}
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
                    disabled={!userId}
                    onClick={async () => {
                      try {
                        await grantRequisitionAccess(selected.id, userId);
                        const u = users.find((x) => x.id === userId);
                        setAccess((prev) => [
                          ...prev,
                          {
                            userId,
                            user: u
                              ? {
                                  id: u.id,
                                  firstName: u.name.split(" ")[0] ?? u.name,
                                  lastName: u.name.split(" ").slice(1).join(" "),
                                  email: u.email,
                                }
                              : undefined,
                          },
                        ]);
                        setUserId("");
                        toast.success("Terrain affecté");
                      } catch {
                        toast.error("Échec de l’affectation");
                      }
                    }}
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
