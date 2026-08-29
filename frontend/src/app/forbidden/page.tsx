"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/core";
import { homeForUser, useAuth } from "@/providers/auth-provider";

export default function ForbiddenPage() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <Card className="max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-[var(--warning)]" />
        <h1 className="mt-4 text-xl font-semibold text-[var(--navy-950)]">
          Accès non autorisé
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Vous n’avez pas l’autorisation d’accéder à cette ressource. Les
          comptes Utilisateur sont limités aux terrains qui leur sont assignés.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => router.back()}>
            Retour
          </Button>
          <Button asChild>
            <Link href={user ? homeForUser(user) : "/login"}>Accueil</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
