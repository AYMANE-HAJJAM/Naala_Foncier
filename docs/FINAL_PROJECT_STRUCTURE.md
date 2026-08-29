# Structure finale du projet

Date : 2026-08-29

## Arborescence simplifiée

```text
Réquisition/
├── frontend/
│   ├── e2e/                 tests Playwright auth et métier
│   ├── scripts/             smoke tests locaux
│   ├── src/
│   │   ├── app/             routes et layouts Next.js
│   │   ├── components/      UI, shell, auth guards et viewers
│   │   ├── features/        domaines fonctionnels
│   │   ├── generated/api/   client Orval
│   │   ├── lib/             HTTP, auth, documents et utilitaires
│   │   ├── providers/       état de session applicatif
│   │   └── types/           modèles de présentation partagés
│   └── configurations Next/TS/ESLint/Orval/Playwright
├── backend/
│   ├── prisma/              schéma, seed et migrations
│   ├── scripts/             imports, maintenance, QA et réparation
│   ├── src/
│   │   ├── modules/         domaines NestJS
│   │   ├── shared/          accès, auth, config, DB, erreurs, permissions, stockage
│   │   └── generated/prisma client Prisma généré
│   └── test/                tests métier Phase 2A/2B
├── docs/                    documentation actuelle et historique
├── README.md
└── .gitignore
```

Les dossiers `node_modules` sont conservés localement dans frontend et backend mais ignorés par Git. Les builds/caches sont absents de l'état source final.

## Frontend

- App Router assemble les pages; aucune logique HTTP/auth concurrente ne vit dans les routes.
- Les features actives couvrent dashboard, terrains, calendrier, documents intégrés, judiciaire, oppositions, rapports, notifications et administration.
- Le détail terrain compose Overview, Documents, Oppositions, Suivi judiciaire, Calendrier, Rapports et Historique.
- `auth-session.ts` est le core HTTP/auth unique. Orval, les wrappers métier et le téléchargement binaire l'utilisent tous.

## Backend

- Modules : identity/access, requisitions, terrain drafts, documents, events, legal cases, hearings, oppositions, actions, reports, notifications, dashboard, audit et AI analysis.
- `shared` centralise Prisma, guards, permissions, portée d'accès, stockage Cloudinary, erreurs et validation de configuration.
- Les contrôleurs gèrent HTTP/DTO/permissions; les services portent les workflows et transactions.

## Auth

- Access token JWT, refresh token opaque haché, cookie HTTP-only et rotation atomique.
- Guards globaux JWT et permissions.
- Affectations terrain appliquées par `AccessScopeService` pour les utilisateurs non administrateurs.

## Base de données

- PostgreSQL/Neon via Prisma et adaptateur `pg`.
- 14 migrations historiques immuables.
- Entités principales : utilisateurs, terrains, documents, événements, affaires judiciaires, hearings, oppositions, actions, rapports, notifications, brouillons et analyses IA.

## Stockage

- Contrat `StorageService` et implémentation Cloudinary.
- Uploads signés, contenus authentifiés, métadonnées de versions et contrôle d'existence.

## Intelligence artificielle

- Phase 2A : préparation/analyse de documents et brouillons.
- Phase 2B : analyse de mise à jour d'un terrain et propositions validées humainement.
- Providers GitHub Models configurables; absence de provider = erreur explicite, jamais de résultat fictif.
- Persistance active : `AIAnalysisRun` et `AIExtraction`.
- Tables legacy conservées uniquement pour migration future : `AIAnalysisJob`, `AIAnalysisDocument`, `DocumentAnalysis`, `ExtractedFact`.
