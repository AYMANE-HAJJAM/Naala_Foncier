import { ApiError } from "./fetcher";

const STATUS_MESSAGES: Record<number, string> = {
  401: "Votre session a expiré. Veuillez vous reconnecter.",
  403: "Vous n’avez pas accès à ce terrain.",
  404: "Élément introuvable.",
  429: "Trop de tentatives. Réessayez dans une minute.",
  500: "Une erreur est survenue.",
  502: "Le service demandé est temporairement indisponible.",
  503: "Le service demandé est temporairement indisponible.",
};

export function uiErrorMessage(error: unknown, fallback = "Une erreur est survenue."): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 409 || error.status === 422) {
      return error.message || fallback;
    }
    return STATUS_MESSAGES[error.status] ?? error.message ?? fallback;
  }
  return fallback;
}
