"use client";

import Link from "next/link";
import { ArrowUpRight, FolderKanban, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page";

export default function AdministrationPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Utilisateurs et affectation des terrains."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/administration/utilisateurs"
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
        >
          <span className="nf-icon-box">
            <Users className="size-5 text-[var(--navy-800)]" />
          </span>
          <ArrowUpRight className="absolute right-5 top-5 size-4 text-[var(--text-faint)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--navy-800)]" />
          <h2 className="mt-5 text-[17px] font-semibold text-[var(--navy-950)]">
            Utilisateurs
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Comptes ADMIN et USER de la plateforme.
          </p>
        </Link>
        <Link
          href="/administration/affectations"
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
        >
          <span className="nf-icon-box">
            <FolderKanban className="size-5 text-[var(--navy-800)]" />
          </span>
          <ArrowUpRight className="absolute right-5 top-5 size-4 text-[var(--text-faint)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--navy-800)]" />
          <h2 className="mt-5 text-[17px] font-semibold text-[var(--navy-950)]">
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
