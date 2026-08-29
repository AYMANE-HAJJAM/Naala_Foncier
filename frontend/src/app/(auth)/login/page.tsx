"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/fetcher";
import { homeForUser, useAuth } from "@/providers/auth-provider";

const schema = z.object({
  email: z.string().min(1, "Adresse e-mail requise").email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormValues = z.infer<typeof schema>;

function loginError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "Impossible de se connecter pour le moment.";
  }
  if (error.code === "ACCOUNT_DISABLED") {
    return "Votre compte est desactive. Contactez l'administrateur.";
  }
  if (error.status === 401 || error.code === "INVALID_CREDENTIALS") {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (error.status === 429) {
    return "Trop de tentatives. Reessayez dans une minute.";
  }
  return "Impossible de se connecter pour le moment.";
}

export default function LoginPage() {
  const router = useRouter();
  const { status, user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(homeForUser(user));
  }, [status, user, router]);

  const submit = async (values: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (error) {
      setFormError(loginError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)]">
        <p className="text-sm font-semibold tracking-[0.12em] text-[var(--navy-950)]">
          NAALA FONCIER
        </p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <section className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-7 shadow-sm md:p-9">
        <p className="text-[13px] font-semibold tracking-[0.12em] text-[var(--accent)]">
          NAALA FONCIER
        </p>
        <h1 className="mt-7 text-[28px] font-semibold tracking-tight text-[var(--navy-950)]">
          Connexion
        </h1>

        <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-5" noValidate>
          <label className="nf-label">
            Adresse e-mail
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                autoFocus
                className="nf-input nf-input--icon-left"
              />
            </div>
            {errors.email && (
              <span className="mt-1 block text-xs text-[var(--critical)]">
                {errors.email.message}
              </span>
            )}
          </label>

          <label className="nf-label">
            Mot de passe
            <div className="relative mt-2">
              <LockKeyhole className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                className="nf-input nf-input--icon-left"
              />
            </div>
            {errors.password && (
              <span className="mt-1 block text-xs text-[var(--critical)]">
                {errors.password.message}
              </span>
            )}
          </label>

          {formError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-[var(--critical)]">
              {formError}
            </p>
          )}

          <Button disabled={submitting} className="h-11 w-full" type="submit">
            {submitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </section>
    </main>
  );
}
