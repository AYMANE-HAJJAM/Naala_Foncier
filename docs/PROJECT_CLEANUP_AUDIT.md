# Audit de nettoyage global

Date : 2026-08-29

## Méthode et garde-fous

- Inventaire réalisé avec `rg --files`, recherche des imports/références, inspection des routes Next.js, des modules NestJS et des scripts déclarés.
- Vérification complémentaire avec TypeScript en mode `noUnusedLocals` / `noUnusedParameters`.
- Le dossier `.git` présent à la racine est vide : il ne fournit ni historique, ni diff, ni restauration. Les suppressions sont donc limitées aux éléments dont l'absence d'usage est démontrée.
- Aucun `.env`, asset Cloudinary, donnée Neon, schéma appliqué ou migration historique n'est modifié.

## SAFE_DELETE

| Élément | Preuve | Action prévue |
| --- | --- | --- |
| Bloc `AnalysesPage` dans `frontend/src/features/global/operations.tsx` | Bloc intégralement commenté, route `/analyses-ai` désactivée par redirection, aucun import | Supprimer le code commenté |
| `GlobalActionsPage`, `ReportsPage`, `SettingsPage` dans `operations.tsx` | Aucun import; routes correspondantes redirigent; seul `UsersPage` est consommé | Retirer ces exports et leurs imports devenus morts |
| Anciens onglets `ActionsTab`, `StrategicReportTab`, `AiAnalysisTab` | Aucun import; les onglets métier actuels sont `requisition-tabs.tsx`, `reports-tab.tsx`, le suivi judiciaire et les propositions IA | Supprimer; extraire le seul `HistoryTab` actif |
| `AnalysisJob` dans `frontend/src/types/domain.ts` | Aucun consommateur hors ancienne UI commentée | Supprimer le type |
| `backend/src/modules/ai-analysis/ai-analysis.controller.ts` | Contrôleur absent de `AIAnalysisModule.controllers`; aucun import actif | Supprimer |
| `backend/src/modules/ai-analysis/analyses-compatibility.controller.ts` | Contrôleur absent de `AIAnalysisModule.controllers`; aucun import actif | Supprimer |
| `backend/src/modules/ai-analysis/ai-analysis.service.ts` | Provider absent de `AIAnalysisModule.providers`; utilisé seulement par les deux contrôleurs inactifs et un test legacy | Supprimer avec le test legacy associé |
| `backend/scripts/apply-presentation-summaries.mjs` | Doublon plus ancien de la variante TypeScript, non déclaré dans `package.json`, non appelé par un script | Supprimer; conserver la variante `.ts` comme script historique |
| `@radix-ui/react-dropdown-menu` | Zéro import dans le frontend hors manifests npm | Désinstaller |
| `@tanstack/react-table` | Zéro import dans le frontend hors manifests npm | Désinstaller |
| `recharts` | Zéro import dans le frontend hors manifests npm | Désinstaller |
| `DocumentsService.sanitize` et import `node:path` associé | Méthode privée sans appel | Supprimer |
| Variables/propriétés TypeScript signalées inutilisées | `hints`, propriétés constructeur `config` non lues | Simplifier sans modifier le comportement |
| `CourtStatusProvider` / `UnconfiguredCourtStatusProvider` | Aucun consommateur; provider futur Mahakim qui rejette systématiquement et fonctionnalité explicitement hors périmètre | Supprimer |
| Package backend `uuid` | Zéro import applicatif; UUID Prisma est une fonction du schéma et le runtime utilise `node:crypto.randomUUID` | Désinstaller |

## LEGACY_KEEP_TEMPORARILY

- Routes `/agenda`, `/mes-dossiers`, `/utilisateurs`, `/documents`, `/portefeuille`, `/requisitions/nouveau` : redirections de compatibilité à faible coût. `/agenda` est encore lié depuis le dashboard.
- Routes `/actions`, `/analyses-ai`, `/contentieux`, `/oppositions`, `/parametres`, `/rapports` : entrées historiques désactivées par redirection; conservation prudente pour les favoris externes.
- Endpoints `Hearing` et module `HearingsModule` : encore actifs pour le suivi judiciaire, les rappels et la projection vers `TerrainEvent`.
- Tables Prisma `AIAnalysisJob`, `AIAnalysisDocument`, `DocumentAnalysis`, `ExtractedFact` : stack applicative legacy, mais conservation des données et du schéma jusqu'à une migration destructive contrôlée.
- Nettoyage navigateur de l'ancienne clé `naala-session` : compatibilité de session existante.
- `phase1.ts` et `phase-b.ts` : noms historiques mais wrappers métier encore importés; ils utilisent le core HTTP/auth unique.

## ACTIVE

- Frontend : App Router, `AuthProvider`, gardes de routes, `AppShell`, dashboards ADMIN/USER, portefeuille, détail terrain, calendrier, documents, rapports, contentieux embarqué, administration et notifications.
- Core HTTP : `auth-session.ts` → `fetcher.ts` / `binary.ts`; Orval utilise `customFetcher`.
- Backend : identity/access, requisitions, dashboard, documents, oppositions, legal cases, hearings, actions, notifications, reports, events, terrain drafts, audit, storage et analyse IA Phase 2A/2B.
- IA active : `AIAnalysisRun`, `AIExtraction`, `DocumentAnalysisProvider`, fournisseurs GitHub Models, analyse des brouillons et propositions de mise à jour terrain.
- `ACTES` / `ACTES_PROPRIETE` et catégorie `RAPPORTS` : toujours présents dans les contrats/données et mappés explicitement; le modèle `Report` reste distinct.

## GENERATED

- `frontend/src/generated/api/**` : client Orval, à régénérer depuis OpenAPI plutôt qu'à modifier manuellement.
- `backend/src/generated/prisma/**` : client Prisma généré, à ne pas éditer manuellement.
- `.next*`, `dist`, caches TypeScript et `node_modules` : artefacts locaux exclus de l'audit de code source.

## DATA_OR_MIGRATION

- `backend/prisma/migrations/**`, `schema.prisma` et `seed.ts`.
- Scripts d'import/extraction/manifeste, backfills Phase 1, QA Phase C, réparation de rapports et nettoyage opérationnel : certains sont ponctuels mais portent des règles de reprise et doivent rester disponibles.
- Les sources documentaires privées ne sont pas présentes dans cet instantané; aucune donnée source n'est supprimée.

## UNKNOWN

- Dépendances backend sans import direct mais attendues par l'écosystème Nest (`@nestjs/platform-express`, `rxjs`, `pino-http`) : conservées, car l'usage peut être indirect/peer/runtime.
- Documents historiques dans `docs/` : conservés comme traces de décisions; un index distinguera l'actuel de l'historique.

## Routes Next.js

### ACTIVE

- `/`, `/dashboard`, `/login`, `/forbidden`
- `/requisitions`, `/requisitions/[requisitionId]`, `/mes-terrains`
- `/calendrier`, `/notifications`, `/profil`
- `/administration`, `/administration/utilisateurs`, `/administration/affectations`

### COMPATIBILITY_REDIRECT

- `/agenda` → `/calendrier`
- `/mes-dossiers` → `/mes-terrains`
- `/utilisateurs` → `/administration/utilisateurs`
- `/documents`, `/portefeuille` → `/requisitions`
- `/requisitions/nouveau` → `/requisitions?nouveau=1`
- `/actions`, `/analyses-ai`, `/contentieux`, `/oppositions`, `/parametres`, `/rapports` → `/`

### DEAD

- Aucune route supprimable sans connaissance des favoris/liens externes. Les implémentations UI historiques derrière les routes désactivées sont toutefois `SAFE_DELETE` lorsqu'elles n'ont aucun import.

## Dépendances frontend

- **USED** : React/Next, React Query, React Hook Form/Zod, Radix Dialog/Slot/Tooltip, Sonner, Lucide, date-fns, `react-pdf`, `docx-preview`, Tailwind et utilitaires CSS.
- **UNUSED** : `@radix-ui/react-dropdown-menu`, `@tanstack/react-table`, `recharts`.
- **DEV_ONLY** : TypeScript, ESLint, Orval, Playwright, Prettier et types.
- **UNKNOWN** : aucune autre dépendance frontend.

## Scripts backend

- **ACTIVE_OPERATIONAL** : génération OpenAPI, imports `import-source-documents.ts` / `import-document-assets.ts`, nettoyage des travaux expirés, reset du mot de passe admin, audits/refresh Phase B.
- **ONE_TIME_BUT_KEEP** : extraction/manifestes, `phase1-backfill.ts`, scripts QA Phase C, réparations de rapports, présentations et statuts finaux.
- **OBSOLETE** : doublon `apply-presentation-summaries.mjs` uniquement.
- **UNKNOWN** : aucun script supplémentaire supprimé.

## Fichiers volumineux

- Les écrans `requisition-tabs.tsx`, `nouveau-terrain-wizard.tsx`, `calendar-workspace.tsx` et certains services IA sont volumineux mais cohésifs et actifs. Aucun découpage mécanique n'est justifié dans ce nettoyage sans changement fonctionnel.
