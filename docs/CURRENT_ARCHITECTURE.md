# Architecture actuelle — NAALA FONCIER

Date : 2026-08-29

## Frontend

- Next.js App Router, React et TypeScript strict dans `frontend/src`.
- Les routes assemblent des écrans de `features/`; les primitives partagées vivent dans `components/` et les accès techniques dans `lib/`.
- TanStack Query gère les données serveur. Le client OpenAPI est généré par Orval dans `src/generated/api`.
- `auth-session.ts` est le core HTTP/auth unique : bearer token mémoire/local, credentials cookies, refresh single-flight et retry contrôlé. `fetcher.ts` et `binary.ts` s'appuient dessus.
- `AuthProvider` porte l'état de session; les gardes de layout protègent les routes et permissions.

## Backend

- NestJS modulaire, TypeScript strict, contrôleurs HTTP fins et services métier par module.
- Guards globaux : throttling, JWT puis permissions.
- Filtre d'exception API commun, validation DTO globale et logs Pino structurés avec secrets redacted.
- Prisma est centralisé par `PrismaService`; les accès terrain sont filtrés par `AccessScopeService`.

## Base de données

- PostgreSQL/Neon via Prisma 7 et adaptateur `pg`.
- Les migrations historiques sont immuables. Le client généré se trouve dans `backend/src/generated/prisma`.
- Entités principales : `User`, `Requisition`, `Document`, `TerrainEvent`, `LegalCase`, `Hearing`, `Opposition`, `ActionItem`, `Report`, `Notification`, `TerrainDraft`, `AIAnalysisRun`, `AIExtraction`.
- Les tables IA historiques (`AIAnalysisJob`, `AIAnalysisDocument`, `DocumentAnalysis`, `ExtractedFact`) restent en base en attente d'une migration destructive dédiée.

## Stockage

- `StorageService` définit le contrat; `CloudinaryStorageService` fournit les uploads signés, téléchargements authentifiés, vérifications et suppressions.
- Les métadonnées de stockage/version sont persistées dans `DocumentVersion` et `TerrainDraftDocument`.

## Intelligence artificielle

- Phase 2A : analyse de documents/brouillons via `DocumentAnalysisProvider` et GitHub Models lorsqu'il est configuré.
- Phase 2B : analyse de mise à jour d'un terrain, contexte officiel, déduplication et propositions soumises à validation humaine.
- Persistance active : `AIAnalysisRun` et `AIExtraction`. Aucun résultat fictif n'est produit sans fournisseur configuré.

## Authentification

- Login par email/mot de passe bcrypt; access token JWT court et refresh token opaque haché en base.
- Refresh token en cookie HTTP-only avec rotation atomique, familles de tokens et détection de rejeu.
- Deux profils applicatifs : `ADMIN` et `USER`; l'accès terrain d'un utilisateur dépend de ses affectations.

## Modules principaux

- Identité/accès et utilisateurs
- Réquisitions/terrains et dashboard
- Documents et stockage
- Événements/calendrier et snapshots de statut
- Contentieux : oppositions, affaires judiciaires et hearings
- Actions, notifications et rapports
- Brouillons terrain et analyse IA active
- Audit

## Routes frontend principales

- `/` : dashboard administrateur
- `/dashboard` : dashboard utilisateur
- `/requisitions` : portefeuille Terrains
- `/mes-terrains` : terrains affectés
- `/requisitions/[requisitionId]` : cockpit terrain
- `/calendrier` : calendrier `TerrainEvent`
- `/administration/*` : utilisateurs et affectations
- `/notifications`, `/profil`, `/login`, `/forbidden`

Les anciens chemins `/agenda`, `/mes-dossiers`, `/utilisateurs`, `/documents`, `/portefeuille` et plusieurs entrées historiques restent de simples redirections de compatibilité.
