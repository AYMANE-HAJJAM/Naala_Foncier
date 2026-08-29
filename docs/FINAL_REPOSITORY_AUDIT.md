# Audit final du repository

Date : 2026-08-29

## Méthode

- Inventaire des sources, routes, modules, scripts, tests, configurations et sorties générées.
- Recherche globale des références, TODO/FIXME, traces frontend, accès `process.env` et motifs de secrets hors fichiers env.
- Vérification des deux `node_modules` : présents, nécessaires au fonctionnement local et exclus de toute suppression.
- Le dossier `.git` est vide et n'est pas un dépôt valide au début de cette mission.

## ACTIVE

- `frontend/src/app`, `features`, `components`, `lib`, `providers` et `types`.
- `frontend/e2e`, `frontend/scripts`, configurations Next.js, Orval, Playwright, TypeScript et ESLint.
- `backend/src/modules`, `backend/src/shared`, tests unitaires/métier et scripts opérationnels.
- `backend/prisma/schema.prisma`, seed et 14 migrations historiques.
- Client Orval et client Prisma générés : requis par les builds; ils restent dans les sources générées.
- Documentation courante et historique indexée dans `docs/README.md`.
- `frontend/node_modules` et `backend/node_modules` : dépendances installées, non assimilées à du code mort.

## SAFE_DELETE

- Aucun nouveau fichier source entier n'est démontré comme inutilisé après le cleanup global précédent.
- Aucun TODO/FIXME actif ou obsolète n'a été trouvé dans les sources/tests/scripts inspectés.
- Aucun `console.log` / `console.debug` de production frontend n'a été trouvé.

## GENERATED

État avant purge finale :

| Chemin | Fichiers | Taille approximative | Décision |
| --- | ---: | ---: | --- |
| `frontend/.next` | 2 408 | 1,19 Go | Supprimer |
| `frontend/.next-e2e` | 955 | 458 Mo | Supprimer |
| `frontend/artifacts` | 39 | 3,64 Mo | Supprimer |
| `frontend/tsconfig.tsbuildinfo` | 1 | cache TypeScript | Supprimer |
| `backend/dist` | 409 | 6,38 Mo | Supprimer |
| `playwright-report`, `test-results`, `coverage` | absents au relevé | régénérables | Garder ignorés et supprimer s'ils réapparaissent |

Les dossiers sont recréés pendant la validation, puis supprimés une seconde fois afin de laisser un workspace source propre.

## LEGACY_KEEP

- Routes Next.js de compatibilité (`/agenda`, `/mes-dossiers`, `/utilisateurs`, `/documents`, `/portefeuille`, etc.).
- `Hearing` et ses endpoints, encore utilisés par le judiciaire et les rappels.
- Wrappers métier `phase1.ts` et `phase-b.ts`, tous deux basés sur le core HTTP/auth commun.
- Catégories historiques `ACTES`, `ACTES_PROPRIETE` et `RAPPORTS`.
- Scripts one-shot de reprise, import, réparation, backfill et QA.
- Documents de phases historiques, utiles pour la traçabilité.

## DATA_OR_MIGRATION

- Toutes les migrations Prisma, le seed et les scripts d'import/backfill.
- Les sources métier privées ne sont pas présentes dans cet instantané; si elles sont restaurées, `private-import` reste explicitement protégé et ignoré.
- Fichiers `.env` locaux conservés sans affichage ni modification de secret.

## UNKNOWN

- Date de retrait des routes historiques et compatibilités navigateur.
- Date d'archivage des scripts one-shot après décision humaine.
- Dépendances backend peer/runtime sans import direct (`@nestjs/platform-express`, `rxjs`, `pino-http`) : conservées.

## Architecture frontend

- `app/` contient uniquement routes et layouts.
- `features/` sépare dashboard, calendrier, opérations globales et parcours terrain.
- `components/` contient l'UI générique, le shell et les viewers de documents.
- `lib/` porte le core auth/HTTP unique, les wrappers métier et utilitaires.
- `generated/` est réservé au client Orval.
- Les gros composants terrain restent cohésifs; une réorganisation massive créerait plus de risque que de valeur dans cette mission.

## Architecture backend

- Modules NestJS par domaine sous `src/modules`.
- Sécurité, accès, base, stockage, erreurs et configuration sous `src/shared`.
- Contrôleurs centrés HTTP; logique applicative dans les services; intégrations Cloudinary/GitHub Models dans leurs providers.
- Les services volumineux (`terrain-drafts`, documents, IA) orchestrent des workflows cohérents et ne justifient pas un découpage artificiel supplémentaire.

## IA et legacy DB

- Stack active : `AIAnalysisRun`, `AIExtraction`, providers document/terrain, GitHub Models et validations humaines Phase 2A/2B.
- Aucun code actif ne dépend de `AIAnalysisJob`, `AIAnalysisDocument`, `DocumentAnalysis` ou `ExtractedFact`.
- Ces tables restent en base jusqu'à une migration destructive dédiée; aucune migration existante n'est modifiée.

## Configuration et secrets

- La configuration runtime est validée dans `shared/config/environment.ts`; les accès directs restants concernent principalement les scripts autonomes, Prisma et deux besoins de bootstrap.
- Aucun motif de secret en clair n'a été trouvé dans les fichiers source trackables inspectés.
- `.env`, `.env.local`, `.env*.local` et `.phase-c-qa.env` doivent rester ignorés; `.env.example` doit rester versionnable.
