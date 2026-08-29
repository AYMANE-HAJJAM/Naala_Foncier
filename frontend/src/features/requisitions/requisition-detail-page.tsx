"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  FilePlus2,
  Link2,
  MapPin,
  Ruler,
  UserRound,
} from "lucide-react";
import { useGetRequisition } from "@/generated/api/naala";
import type { Requisition } from "@/types/domain";
import { Breadcrumbs } from "@/components/shared/page";
import { IdentityStrip } from "@/components/shared/primitives";
import { Card, Skeleton, StatusBadge } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { DocumentUploadDialog, DocumentsTab, OppositionsTab } from "./requisition-tabs";
import { OverviewTab } from "./overview-tab";
import { HistoryTab } from "./history-tab";
import { JudicialTrackingTab } from "./judicial-tab";
import { ReportsTab } from "./reports-tab";
import { TerrainCalendarTab,
  TerrainTimelineTab,
} from "./terrain-timeline";
import { TerrainUpdateProposalsPanel } from "./terrain-update-proposals";
import { ApiError } from "@/lib/api/fetcher";
import { useAuth } from "@/providers/auth-provider";

const tabs = [
  "Vue d’ensemble",
  "Documents",
  "Oppositions",
  "Suivi judiciaire",
  "Calendrier",
  "Rapports",
  "Historique",
] as const;
const slugs = [
  "overview",
  "documents",
  "oppositions",
  "judiciaire",
  "calendrier",
  "rapports",
  "historique",
];

export function RequisitionDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = Math.max(0, slugs.indexOf(sp.get("tab") ?? "overview"));
  const [docOpen, setDocOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string | undefined>();
  const { user, isAdmin: admin } = useAuth();
  const canUpload = Boolean(user?.permissions.includes("document.upload"));
  const { data, isLoading, isError, error } = useGetRequisition(id);

  const openUpload = (categoryKey?: string) => {
    setUploadCategory(categoryKey);
    setDocOpen(true);
  };

  useEffect(() => {
    if (error instanceof ApiError && error.status === 403) {
      router.replace("/forbidden");
    }
  }, [error, router]);

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-24" />
        <Skeleton className="mt-4 h-[420px]" />
      </>
    );
  }

  if (error instanceof ApiError && error.status === 403) {
    return (
      <Card className="p-10 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-600" />
        <h1 className="mt-3 text-base font-semibold">Accès non autorisé</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Ce terrain n’est pas assigné à votre compte.
        </p>
      </Card>
    );
  }

  if (isError || !data?.data) {
    return (
      <Card className="p-10 text-center">
        <AlertTriangle className="mx-auto size-8 text-[var(--critical)]" />
        <h1 className="mt-3 text-base font-semibold">Réquisition introuvable</h1>
      </Card>
    );
  }

  const r = data.data as Requisition;
  const breadcrumbRoot = admin ? "Terrains" : "Mes terrains";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: breadcrumbRoot, href: admin ? "/requisitions" : "/mes-terrains" },
          { label: r.number },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--navy-950)] leading-tight">
            {r.number} — {r.property}
          </h1>
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">
            Dernière mise à jour le {formatDate(r.lastUpdate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge status={r.status || "Non renseigné"} />
          {canUpload && (
            <Button onClick={() => openUpload()}>
              <FilePlus2 className="size-4" />
              Ajouter un document
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <IdentityStrip
          cells={[
            {
              icon: MapPin,
              label: "Localisation",
              value: r.location || "Non renseigné",
            },
            {
              icon: Ruler,
              label: "Superficie",
              value: r.surface || "Non renseigné",
            },
            {
              icon: UserRound,
              label: "Acquéreur",
              value: r.buyer || "Non renseigné",
            },
            {
              icon: UserRound,
              label: "Vendeur",
              value: r.seller || "Non renseigné",
            },
            {
              icon: Link2,
              label: "Réquisition liée",
              value: r.linkedRequisition || "Aucune",
            },
          ]}
        />
      </div>

      {admin && (
        <div className="mb-6">
          <TerrainUpdateProposalsPanel requisitionId={r.id} />
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((x, i) => (
          <button
            key={x}
            onClick={() => router.replace(`?tab=${slugs[i]}`, { scroll: false })}
            className={cn(
              "shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors -mb-px",
              tab === i
                ? "border-[var(--navy-950)] text-[var(--navy-950)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {x}
          </button>
        ))}
      </div>

      {tab === 0 && <OverviewTab r={r} />}
      {tab === 1 && (
        <DocumentsTab r={r} onAdd={canUpload ? openUpload : undefined} />
      )}
      {tab === 2 && <OppositionsTab r={r} />}
      {tab === 3 && <JudicialTrackingTab r={r} />}
      {tab === 4 && <TerrainCalendarTab r={r} />}
      {tab === 5 && <ReportsTab r={r} />}
      {tab === 6 && (
        <div className="space-y-8">
          <TerrainTimelineTab r={r} />
          <HistoryTab r={r} />
        </div>
      )}

      {canUpload && (
        <DocumentUploadDialog
          r={r}
          open={docOpen}
          lockedCategory={uploadCategory}
          close={() => {
            setDocOpen(false);
            setUploadCategory(undefined);
          }}
        />
      )}
    </>
  );
}
