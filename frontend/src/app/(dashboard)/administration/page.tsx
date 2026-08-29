"use client";

import Link from "next/link";
import { FolderKanban, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page";

export default function AdministrationPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Utilisateurs et affectation des terrains."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/administration/utilisateurs"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--navy-700)]"
        >
          <Users className="size-5 text-[var(--navy-800)]" />
          <h2 className="mt-3 text-[16px] font-semibold text-[var(--navy-950)]">
            Utilisateurs
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Comptes ADMIN et USER de la plateforme.
          </p>
        </Link>
        <Link
          href="/administration/affectations"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--navy-700)]"
        >
          <FolderKanban className="size-5 text-[var(--navy-800)]" />
          <h2 className="mt-3 text-[16px] font-semibold text-[var(--navy-950)]">
            Affectation des terrains
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Choisir quels utilisateurs voient chaque terrain.
          </p>
        </Link>
      </div>
    </>
  );
}
