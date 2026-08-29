# NAALA FONCIER

Application interne de gestion et de suivi d'un portefeuille foncier : terrains, documents, événements, contentieux, rapports, notifications et analyses assistées par IA avec validation humaine.

## Architecture

- **Frontend** : Next.js 16, React, TypeScript strict, TanStack Query et client OpenAPI généré par Orval.
- **Backend** : NestJS 11, TypeScript strict, guards JWT/permissions, Prisma et PostgreSQL.
- **Stockage** : Cloudinary avec uploads signés et contenus authentifiés.
- **IA** : GitHub Models configurable, `AIAnalysisRun` / `AIExtraction`, sans résultat fictif lorsque le provider est absent.

La cartographie détaillée se trouve dans [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md).

## Prérequis

- Node.js 24 ou version compatible avec les `package-lock.json`
- npm
- PostgreSQL/Neon accessible
- Compte Cloudinary pour les uploads réels
- Token GitHub Models uniquement si l'analyse IA doit être activée

## Installation

```powershell
cd backend
Copy-Item .env.example .env
npm install

cd ..\frontend
Copy-Item .env.example .env.local
npm install
```

Renseigner les variables locales à partir des exemples. Ne jamais versionner `.env`, `.env.local` ou `.phase-c-qa.env`.

## Base de données

Depuis `backend/` :

```powershell
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

En développement, `npm run prisma:migrate` crée une nouvelle migration. Ne jamais réécrire une migration déjà appliquée.

## Lancement local

Dans deux terminaux :

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Par défaut, le frontend répond sur `http://localhost:3000` et le backend sur `http://localhost:3001`.

## Validation

Backend :

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Frontend :

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Les tests Playwright utilisent la base QA isolée décrite dans `.phase-c-qa.env`. Sa création contrôlée se fait avec `npm run qa:phase-c:setup` depuis `backend/`.

## Structure

```text
Réquisition/
├── backend/     API NestJS, Prisma, tests et scripts opérationnels
├── frontend/    application Next.js, client Orval et tests Playwright
├── docs/        architecture, guides, audits et historique
├── README.md
└── .gitignore
```

Les dossiers `node_modules` restent présents localement mais sont ignorés par Git. Les sorties `.next`, `.next-e2e`, `dist`, rapports de tests et caches TypeScript sont entièrement régénérables.
