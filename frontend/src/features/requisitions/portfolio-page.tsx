"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";
import {
  getGetRequisitionsQueryKey,
  useGetRequisitions,
} from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { PageHeader } from "@/components/shared/page";
import { EmptyState, Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { NouveauTerrainWizard } from "./nouveau-terrain-wizard";
import { toast } from "sonner";

const PRINCIPAL_ORDER = [
  "R 20657/31",
  "R 20629/31",
  "R 20696/31",
  "R 20611/31",
  "R 20612/31",
  "R 148026/31",
];

function shortStatus(r: Requisition): string {
  if (r.status) return r.status;
  if (r.courtReached === "Oui") return "Au tribunal";
  if (r.oppositionCount) return `${r.oppositionCount} oppositions`;
  return r.currentSituation ?? "Situation à renseigner";
}

function TerrainCard({ r }: { r: Requisition }) {
  const docCount = r.documentCount ?? r.availableDocuments?.length ?? 0;
  const latest =
    r.latestKnownEvent ??
    (r.latestKnownEventAt ? formatDate(r.latestKnownEventAt) : null);

  return (
    <Link
      href={`/requisitions/${r.id}`}
      className="group block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--navy-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-800)]/30"
    >
      <p className="text-[12px] font-semibold tracking-wide text-[var(--navy-800)]">
        {r.number}
      </p>
      <h3 className="mt-1 text-[17px] font-semibold text-[var(--navy-950)]">
        {r.property}
      </h3>
      {r.surface ? (
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">{r.surface}</p>
      ) : null}

      <p className="mt-4 text-[14px] font-medium text-[var(--text)]">
        {shortStatus(r)}
      </p>
      {r.oppositionCount != null && r.oppositionCount > 0 ? (
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {r.oppositionCount} opposition{r.oppositionCount > 1 ? "s" : ""}
        </p>
      ) : null}

      <div className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3 text-[12px]">
        <p>
          <span className="text-[var(--text-muted)]">Dernière information : </span>
          <span className="text-[var(--text)]">
            {latest ?? "Non renseignée"}
          </span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Prochaine date : </span>
          <span className="text-[var(--text)]">
            {r.nextScheduledEventAt
              ? formatDate(r.nextScheduledEventAt)
              : "Aucune date programmée"}
          </span>
        </p>
        <p className="text-[var(--text-muted)]">
          {docCount} document{docCount > 1 ? "s" : ""}
        </p>
      </div>

      {r.linkedRequisition ? (
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Lié à {r.linkedRequisition}
        </p>
      ) : null}

      <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--navy-900)]">
        Ouvrir
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function PortfolioPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useGetRequisitions();
  const rows = useMemo(
    () => (data?.data ?? []) as Requisition[],
    [data?.data],
  );
  const { user, isAdmin: admin } = useAuth();
  const canCreate = Boolean(user?.permissions.includes("requisition.create"));
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(
    () => canCreate && searchParams.get("nouveau") === "1",
  );

  useEffect(() => {
    if (searchParams.get("nouveau") === "1") {
      router.replace("/requisitions", { scroll: false });
    }
  }, [searchParams, router]);

  const principal = useMemo(() => {
    const list = rows.filter(
      (r) => r.isPrincipal !== false && r.number !== "R 16605/31",
    );
    return [...list].sort((a, b) => {
      const ia = PRINCIPAL_ORDER.indexOf(a.number);
      const ib = PRINCIPAL_ORDER.indexOf(b.number);
      if (ia === -1 && ib === -1) return (a.rank ?? 99) - (b.rank ?? 99);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return principal;
    return principal.filter((r) =>
      [r.number, r.property, r.location, r.status]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [principal, search]);

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={admin ? "Terrains" : "Mes terrains"}
        subtitle={
          admin
            ? "Portefeuille foncier — identité, statut et documents."
            : "Terrains qui vous sont attribués."
        }
        actions={
          canCreate ? (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" />
              Nouveau terrain
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un terrain…"
            className="nf-input nf-input--icon-left"
          />
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">
          {visible.length} terrain{visible.length > 1 ? "s" : ""}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Aucun terrain"
          description={
            admin
              ? "Aucun terrain ne correspond à la recherche."
              : "Aucun terrain ne vous est attribué pour le moment."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <TerrainCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {canCreate ? (
        <NouveauTerrainWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onCreated={async (terrain) => {
            await queryClient.invalidateQueries({
              queryKey: getGetRequisitionsQueryKey(),
            });
            toast.success("Terrain créé avec succès", {
              description: terrain.reference,
              action: {
                label: "Ouvrir",
                onClick: () => {
                  window.location.assign(`/requisitions/${terrain.id}`);
                },
              },
            });
          }}
        />
      ) : null}
    </>
  );
}
