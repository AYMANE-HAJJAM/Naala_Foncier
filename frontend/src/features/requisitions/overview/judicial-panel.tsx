import { CalendarClock, Scale } from "lucide-react";

type JudicialPanelProps = {
  reachedCourt: string;
  caseNumbers: string[];
  latestEvent: string | null;
  latestEventDate: string | null;
  result: string | null;
  nextDate: string | null;
  freshness: string;
};

export function JudicialPanel({
  reachedCourt,
  caseNumbers,
  latestEvent,
  latestEventDate,
  result,
  nextDate,
  freshness,
}: JudicialPanelProps) {
  return (
    <section className="h-full rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5">
      <div className="flex items-center gap-2">
        <Scale className="size-4 text-[var(--navy-800)]" aria-hidden />
        <h2 className="text-[17px] font-semibold text-[var(--navy-950)]">
          Situation judiciaire
        </h2>
      </div>

      <dl className="mt-4 space-y-3.5">
        <Row label="Atteint le tribunal" value={reachedCourt} />
        <Row
          label="N° de dossier"
          value={
            caseNumbers.length
              ? caseNumbers.join(" · ")
              : "Aucun numéro confirmé"
          }
        />
        <Row
          label="Dernier événement judiciaire"
          value={latestEvent ?? "Aucun événement judiciaire confirmé"}
          icon
        />
        <Row
          label="Dernière date connue"
          value={latestEventDate ?? "Non renseignée"}
        />
        <Row
          label="Résultat / statut"
          value={result ?? "À confirmer"}
        />
        <Row
          label="Prochaine date"
          value={nextDate ?? "Aucune date programmée"}
        />
        <Row label="Fraîcheur des données" value={freshness} />
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        {icon ? (
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        {label}
      </dt>
      <dd className="mt-1 text-[14px] font-semibold leading-5 text-[var(--navy-950)]">
        {value}
      </dd>
    </div>
  );
}
