# NAALA FONCIER

Application interne de gestion foncière : terrains, documents, oppositions, suivi judiciaire, calendrier, rapports, historique et notifications. Les analyses IA produisent des propositions soumises à validation humaine.

## Architecture

- Next.js / React / TypeScript, TanStack Query et client Orval.
- NestJS / Prisma 7 / PostgreSQL Neon, JWT et permissions par terrain.
- Cloudinary pour les documents authentifiés et uploads signés.
- GitHub Models depuis le backend uniquement, facultatif ; saisie manuelle sans token.
- Le frontend relaie `/api/*` vers Nest : une seule architecture API et un cookie refresh sur le domaine frontend.

ADMIN : Tableau de bord, Terrains, Calendrier, Administration. USER : Tableau de bord, Mes terrains, Calendrier. Les notifications et le profil sont des fonctions transversales. Les anciennes routes redirigent vers les écrans actuels.

## Développement

Node.js 24 et npm. Dans chaque dossier, copier `.env.example` vers l'env local et renseigner les secrets sans les versionner.

```powershell
cd backend
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run prisma:generate

cd ../frontend
Copy-Item .env.example .env.local
npm.cmd ci
```

Pour une nouvelle base seulement, inspecter les migrations puis `npm run prisma:migrate:deploy` depuis backend. Le seed contient des données initiales métier : le lancer explicitement seulement si nécessaire, jamais automatiquement sur la base existante.

Dans deux terminaux, `npm run dev` depuis backend et frontend. Ports locaux : API 3001, frontend 3000. `API_INTERNAL_URL=http://localhost:3001` sert au proxy local. Swagger est OFF par défaut ; mettre `SWAGGER_ENABLED=true` localement pour `npm run generate:api`.

## Validation

Backend : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npx prisma validate`, `npx prisma migrate status`.

Frontend : `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e:auth`, `npm run test:e2e:phase-c`. Renseigner API_INTERNAL_URL explicitement pour le build de production. Exécuter les deux suites Playwright successivement : elles partagent `.next-e2e` et la base QA isolée. `npm run qa:phase-c:setup` backend crée cette base et les identifiants locaux selon les garde-fous du script ; ne pas lancer la création ou le nettoyage sur des données métier. `.phase-c-qa.env` reste local et ignoré, car Playwright et les scripts QA le lisent directement.

## Déploiement Render

Deux Web Services Node 24, sans Docker ni disque persistant.

1. **Backend**, root `backend` : build `npm ci --include=dev && npm run prisma:generate && npm run build`, pre-deploy `npm run prisma:migrate:deploy`, start `npm start`, health `/api/health`.
2. **Frontend**, root `frontend` : build `npm ci --include=dev && npm run build`, start `npm start`. `PORT` est fourni par Render aux deux services.
3. **Env** : secrets JWT, `DATABASE_URL`, `DIRECT_URL`, Cloudinary côté backend ; `WEB_ORIGIN` = origine HTTPS frontend ; `API_INTERNAL_URL` = origine HTTPS backend côté frontend. Laisser `NEXT_PUBLIC_API_BASE_URL` vide.
4. **Neon** : URL runtime adaptée à pg, URL directe pour CLI ; TLS vérifié. Déploiement uniquement avec `migrate deploy`, jamais reset/db push.
5. **Cloudinary** : cloud name/key/secret ; fichiers authentifiés ; vérifier upload et preview.
6. **Migrations** : pre-deploy sur offre payante ; sans cette option, start `npm run prisma:migrate:deploy && npm start`.
7. **Health** : vérifier 200 après démarrage puis la recette navigateur ; Swagger OFF.
8. **CORS** : uniquement WEB_ORIGIN avec credentials ; jamais wildcard.
9. **Cookies** : refresh httpOnly, Secure production, SameSite=lax, sans Domain, Path=/api/auth, transport via proxy Next.
10. **IA** : facultative ; token backend seulement ; fallback manuel conservé.

Les étapes et toutes les variables sont dans [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md). Vérifier [la checklist](docs/RENDER_DEPLOYMENT_CHECKLIST.md) et [l'audit final](docs/PRE_RENDER_FINAL_AUDIT.md) avant de publier.

## Structure

```text
Naala Foncier/
├── backend/      API, schéma, migrations, tests et scripts opérateur
├── frontend/     Next.js, composants et tests Playwright
├── docs/         CURRENT, REFERENCE et historique
├── .gitattributes
├── .gitignore
└── README.md
```

Localement : `.git/`, `.phase-c-qa.env`, `node_modules/`, env et sources privées restent présents mais ne sont pas livrés. Les builds, caches et résultats de test sont recréables et ignorés.
