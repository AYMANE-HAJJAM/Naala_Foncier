"use client";

import { PageHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/core";
import {
  displayName,
  roleDisplayName,
} from "@/lib/api/auth-session";
import { useAuth } from "@/providers/auth-provider";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="Mon profil"
        subtitle="Informations de votre compte NAALA FONCIER."
      />
      <Card className="max-w-lg p-6">
        <dl className="space-y-5 text-sm">
          <div>
            <dt className="text-[12px] font-medium text-[var(--text-muted)]">
              Nom
            </dt>
            <dd className="mt-1 font-semibold text-[var(--text)]">
              {displayName(user)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium text-[var(--text-muted)]">
              E-mail
            </dt>
            <dd className="mt-1 text-[var(--text)]">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium text-[var(--text-muted)]">
              Rôle
            </dt>
            <dd className="mt-1 text-[var(--text)]">
              {roleDisplayName(user?.roles)}
            </dd>
          </div>
        </dl>
        <hr className="nf-divider my-6" />
        <p className="text-[12px] leading-5 text-[var(--text-muted)]">
          Vous consultez uniquement les terrains qui vous sont assignés. Vous
          pouvez y déposer des documents et télécharger les pièces partagées.
        </p>
      </Card>
    </>
  );
}
