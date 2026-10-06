"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  Plus,
  Ruler,
  Search,
  Scale,
} from "lucide-react";
import {
  getGetRequisitionsQueryKey,
  useGetRequisitions,
} from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { PageHeader } from "@/components/shared/page";
import { EmptyState, Skeleton, StatusBadge } from "@/components/ui/core";
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
      className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-800)]/30"
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy-800),var(--accent))] opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="nf-eyebrow">{r.number}</p>
          <h3 className="mt-2 text-[18px] font-semibold leading-snug tracking-[-0.02em] text-[var(--navy-950)] line-clamp-2">
            {r.property}
          </h3>
        </div>
        <StatusBadge status={r.status || shortStatus(r)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-[var(--text-muted)]">
        <span className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2.5 py-2">
          <MapPin className="size-3.5 shrink-0 text-[var(--navy-700)]" />
          <span className="truncate">{r.location || "Non renseignée"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2.5 py-2">
          <Ruler className="size-3.5 shrink-0 text-[var(--navy-700)]" />
          <span className="truncate">{r.surface || "Non renseignée"}</span>
        </span>
      </div>

      <div className="mt-4 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          Situation actuelle
        </p>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--text)] line-clamp-2">
          {shortStatus(r)}
        </p>
        <p className="mt-2 text-[11px] text-[var(--text-muted)] line-clamp-1">
          Dernière information : {latest ?? "Non renseignée"}
        </p>
        {r.linkedRequisition ? (
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Lié à {r.linkedRequisition}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {r.nextScheduledEventAt ? formatDate(r.nextScheduledEventAt) : "Aucune date"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" /> {docCount}
          </span>
          {r.oppositionCount != null && r.oppositionCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Scale className="size-3.5" /> {r.oppositionCount}
            </span>
          ) : null}
        </div>
        <ArrowRight className="size-4 shrink-0 text-[var(--navy-800)] transition-transform group-hover:translate-x-1" />
      </div>

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
  const { isAdmin: admin, capabilities } = useAuth();
  const canCreate = capabilities.canCreateTerrain;
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-xs)]">
        <div className="relative min-w-[220px] max-w-md flex-1">
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                  router.push(`/requisitions/${terrain.id}`);
                },
              },
            });
          }}
        />
      ) : null}
    </>
  );
}
