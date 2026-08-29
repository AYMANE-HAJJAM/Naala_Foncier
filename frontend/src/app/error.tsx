"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <section className="max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--navy-950)]">
          Impossible d’afficher cette page
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Une erreur temporaire est survenue. Votre mot de passe et vos jetons ne
          sont jamais affiches ici.
        </p>
        <Button className="mt-6" onClick={reset}>
          Reessayer
        </Button>
      </section>
    </main>
  );
}
