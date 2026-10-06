"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--canvas)] p-4 sm:p-6">
      <span className="pointer-events-none absolute -left-40 -top-40 size-[420px] rounded-full bg-[var(--gold-100)]/70 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-48 -right-32 size-[460px] rounded-full bg-[var(--navy-800)]/8 blur-3xl" />
      <section className="relative grid w-full max-w-[920px] overflow-hidden rounded-[var(--radius-xl)] border border-white/70 bg-white shadow-[var(--shadow-md)] md:grid-cols-[1fr_1.05fr]">
        <div className="relative hidden overflow-hidden bg-[linear-gradient(145deg,var(--navy-950),var(--navy-800))] p-10 text-white md:flex md:flex-col md:justify-between">
          <span className="absolute -bottom-24 -right-24 size-64 rounded-full border border-white/10" />
          <span className="absolute -bottom-12 -right-12 size-40 rounded-full border border-[var(--accent)]/25" />
          <div>
            <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-white/10 bg-white/[0.06]">
              <Building2 className="size-5 text-[var(--accent)]" />
            </span>
            <p className="mt-5 text-[13px] font-semibold tracking-[0.12em] text-white">
              NAALA FONCIER
            </p>
            <p className="mt-2 text-[14px] text-white/55">
              Plateforme de gestion foncière
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            Accès sécurisé
          </div>
        </div>

        <div className="p-6 sm:p-9 md:p-11">
          <div className="md:hidden">
            <span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--navy-950)]">
              <Building2 className="size-5 text-[var(--accent)]" />
            </span>
            <p className="mt-4 text-[12px] font-semibold tracking-[0.12em] text-[var(--accent)]">
              NAALA FONCIER
            </p>
          </div>
          <p className="nf-eyebrow mt-7 md:mt-0">Espace sécurisé</p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[var(--navy-950)]">
            Connexion
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
            Accédez à votre espace de gestion foncière.
          </p>

        <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5" noValidate>
          <label className="nf-label">
            Adresse e-mail
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
              <input
                {...register("email")}
                type="email"
                placeholder="exemple@domaine.com"
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

          <div className="nf-label">
            <label htmlFor="password">Mot de passe</label>
            <div className="relative mt-2">
              <LockKeyhole className="absolute left-3 top-3 size-4 text-[var(--text-faint)]" />
              <input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Entrez votre mot de passe"
                autoComplete="current-password"
                className="nf-input nf-input--icon-left pr-11!"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-controls="password"
                className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[var(--radius-md)] text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.password && (
              <span className="mt-1 block text-xs text-[var(--critical)]">
                {errors.password.message}
              </span>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-[var(--critical)]">
              {formError}
            </p>
          )}

          <Button disabled={submitting} className="h-11 w-full" type="submit">
            {submitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        </div>
      </section>
    </main>
  );
}
