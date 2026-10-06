# Déploiement Render — NAALA FONCIER

Configuration vérifiée le 6 octobre 2026. Deux Web Services Node, Neon externe, Cloudinary et GitHub Models facultatif. Pas de Docker, de disque persistant ni de nouveau service.

## 1. Préparer Git et les services

Relire et committer les changements existants et ceux de cet audit, y compris `backend/src/shared/storage/` (anciennement ignoré à tort). Les secrets locaux, sources `private-import`, `node_modules`, builds et résultats QA sont ignorés. Ne pas envoyer le dossier de travail comme archive publique.

Avant publication, lire les réserves dans [l'audit final](PRE_RENDER_FINAL_AUDIT.md), notamment le mot de passe administrateur encore utilisé qui correspond à une ancienne fixture Git et les avis npm résiduels. Changer ce mot de passe avant exposition publique. Les avis critiques ont été corrigés ; le scan du contenu actuel ne trouve plus de secret, mais il n'efface pas l'historique.

Utiliser Node 24 (`engines.node` dans les deux packages). Installation au build avec les dépendances de développement : Nest CLI, TypeScript et outils CSS sont nécessaires. Les commandes ci-dessous sont pour le shell Linux Render.

## 2. Backend

Créer un **Web Service**, runtime **Node**, lié au dépôt et à la branche à déployer.

| Champ | Valeur |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run prisma:generate && npm run build` |
| Pre-Deploy Command (service payant) | `npm run prisma:migrate:deploy` |
| Start Command | `npm start` (exécute `node dist/main.js`) |
| Health Check Path | `/api/health` |

Render fournit `PORT`. Nest écoute sur `0.0.0.0`, et utilise `PORT` avant le port local `API_PORT`. Swagger est désactivé par défaut. Health est public ; sa réponse 200 indique que le processus a démarré après connexion Prisma, mais ne teste pas continuellement Cloudinary/IA/DB.

Sur une offre sans pre-deploy, utiliser **Start Command** `npm run prisma:migrate:deploy && npm start`. Ne pas exécuter la migration dans le build : un échec de compilation ne doit pas déclencher des changements de base. Conserver une seule instance pendant ce premier déploiement. Ne jamais utiliser `migrate reset`, `db push`, ni un seed automatique en production. Les migrations sont additives/historiques ; inspecter toute nouvelle migration avant livraison. Les anciens schémas IA restent conservés.

Le pre-deploy est disponible sur les services Web payants et s'exécute avant le démarrage du nouveau build, sur une instance séparée. [Documentation Render](https://render.com/docs/deploys).

## 3. Variables backend

Les noms sont ceux du code, sans alias `FRONTEND_URL`, `BACKEND_PUBLIC_URL` ni variables inventées.

| Variable | Configuration / nécessité |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Secret obligatoire ; URL Neon runtime, généralement pooled ; voir SSL ci-dessous |
| `DIRECT_URL` | Secret recommandé pour Prisma CLI/migrations ; URL Neon directe ; sinon DATABASE_URL est utilisée |
| `WEB_ORIGIN` | Origine HTTPS exacte du frontend, sans chemin ni slash final ; obligatoire en production |
| `JWT_ACCESS_SECRET` | Secret distinct, aléatoire, au moins 32 caractères |
| `JWT_REFRESH_SECRET` | Autre secret aléatoire, au moins 32 caractères |
| `JWT_ACCESS_TTL` | Optionnel, défaut `15m` |
| `JWT_REFRESH_TTL` | Optionnel, défaut `7d` |
| `AUTH_COOKIE_SECURE` | `true` ; la production impose secure même si false |
| `AUTH_COOKIE_SAME_SITE` | `lax` avec le proxy `/api` |
| `AUTH_COOKIE_DOMAIN` | Laisser vide : cookie host-only sur le domaine frontend |
| `CLOUDINARY_CLOUD_NAME` | Obligatoire pour les documents |
| `CLOUDINARY_API_KEY` | Obligatoire pour les documents |
| `CLOUDINARY_API_SECRET` | Secret obligatoire pour les documents |
| `CLOUDINARY_UPLOAD_FOLDER` | Optionnel, défaut `naala-foncier` |
| `SIGNED_URL_EXPIRATION_SECONDS` | Optionnel, défaut `900` |
| `MAX_UPLOAD_SIZE_BYTES` | Optionnel, défaut `26214400` |
| `SWAGGER_ENABLED` | `false` ; activer explicitement seulement si nécessaire |
| `AI_PROVIDER` | Vide pour manuel ; `github-models` pour IA |
| `AI_MODEL` | Optionnel, défaut `openai/gpt-4.1` |
| `GITHUB_MODELS_TOKEN` | Secret backend uniquement ; absent = saisie/validation manuelle |
| `GITHUB_MODELS_BASE_URL` | Optionnel, défaut `https://models.github.ai/inference` |
| `EXPECTED_DATABASE_NAME` | Optionnel ; garde de sécurité vérifiée au démarrage |
| `EXPECTED_DATABASE_SCHEMA` | Optionnel ; garde de sécurité vérifiée au démarrage |
| `PORT` | Fourni par Render ; ne pas fixer manuellement |
| `API_PORT` | Seulement fallback local `3001`, inutile sur Render |

Le seed crée uniquement les rôles et permissions. `PRIMARY_ADMIN_EMAIL` et `PRIMARY_ADMIN_PASSWORD` sont lus exclusivement par `npm run admin:setup`, jamais au démarrage de l'API. Cette commande configure le seul admin actif, nettoie les autres comptes et révoque toutes les sessions : ne pas l'automatiser au déploiement. Voir [le bilan et la rotation](PRIMARY_ADMIN_CLEANUP.md). Les variables SMTP ne sont pas requises : aucun transport mail n'existe dans le code ; les notifications restent en application.

Ne pas ajouter de variable `NEXT_PUBLIC_*` pour un secret. Saisir les secrets dans Render Dashboard. Laisser les valeurs locales intactes.

## 4. Neon / SSL / migrations

Prisma 7 utilise `@prisma/adapter-pg` et `pg` au runtime, tandis que la CLI lit `DIRECT_URL || DATABASE_URL` dans `prisma.config.ts`.

Avec le driver `pg-connection-string` installé, `sslmode=require`, `prefer` et `verify-ca` utilisent aujourd'hui la vérification complète mais déclenchent un avertissement de changement futur. Pour **DATABASE_URL runtime**, configurer explicitement `sslmode=verify-full` sur l'URL Neon de production après vérification de connexion. Cela garde les garanties actuelles ; ne pas ajouter `uselibpqcompat=true` ni `rejectUnauthorized=false`. Ne pas réécrire aveuglément les fichiers env locaux. Pour **DIRECT_URL**, conserver l'URL Neon TLS compatible avec la CLI Prisma (habituellement `sslmode=require`) et vérifier `prisma migrate status` avant `migrate deploy`. Le driver ne doit pas recevoir une configuration `ssl` contradictoire avec les paramètres SSL de l'URL. [Documentation node-postgres](https://node-postgres.com/features/ssl).

Avant livraison : `npx prisma validate` et `npx prisma migrate status`. Les 14 migrations existantes ne sont ni supprimées ni modifiées. Aucun `seed`, import ou backfill n'est nécessaire au démarrage normal sur la base existante.

## 5. Frontend

Après le premier déploiement backend, copier son origine HTTPS publique. Créer le deuxième **Web Service**, runtime **Node**.

| Champ | Valeur |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` (exécute `next start`, respecte PORT) |
| Health Check Path | `/login` |

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | Origine HTTPS publique backend, sans `/api` ni slash final ; nécessaire au build et au start |
| `PORT` | Fourni par Render |

Laisser `NEXT_PUBLIC_API_BASE_URL` absent ou vide. Il est refusé s'il est renseigné : une seule architecture de transport, le rewrite Next `/api/:path*` vers `${API_INTERNAL_URL}/api/:path*`. Ne pas définir `NEXT_DIST_DIR` en production ; cette variable sert uniquement au build QA séparé. Toute modification du backend cible exige un **rebuild/redeploy frontend**, car les rewrites sont enregistrés au build. Un localhost explicitement renseigné est permis uniquement pour un test local production ; aucun localhost implicite en production.

La police `Source Sans 3` est téléchargée au build via `next/font/google`, puis servie depuis les assets Next. Le build nécessite donc un accès réseau à Google Fonts.

## 6. Ordre de configuration et auth

1. Créer le backend avec une origine HTTPS provisoire pour `WEB_ORIGIN` si le nom frontend n'est pas encore connu. Elle est une valeur de configuration, jamais une URL codée en dur.
2. Déployer le backend et vérifier `GET /api/health` = 200.
3. Créer le frontend ; saisir `API_INTERNAL_URL` avec l'origine backend réelle ; build puis start.
4. Récupérer l'origine frontend réelle.
5. Mettre `WEB_ORIGIN` à cette origine exacte dans le backend et redéployer le backend.
6. Vérifier login ADMIN, login USER, restauration par refresh après reload, expiration access token, logout, autorisations et documents depuis le navigateur frontend.

Le navigateur utilise **le même domaine frontend** pour `/api/auth/*`. Next relaie `Set-Cookie` ; sans `Domain`, le navigateur rattache `naala_refresh` au frontend. Cookie `httpOnly`, `Secure` en production, `SameSite=lax`, `Path=/api/auth`. Ne pas utiliser `Domain=backend.onrender.com` et ne pas passer à `SameSite=none` pour contourner deux domaines : le proxy résout déjà ce problème. L'access token existant est envoyé comme Bearer ; les requêtes utilisent `credentials: include`, et le refresh tourne/révoque sa famille de tokens.

CORS backend : origine unique `WEB_ORIGIN`, credentials activés, aucun wildcard. Une origine étrangère ne reçoit pas l'autorisation CORS ; CORS n'est pas un pare-feu et ne bloque pas les outils serveur. Le proxy le plus proche est approuvé en production (`trust proxy=1`) pour l'IP/rate limiting. Vérifier sur Render la chaîne `X-Forwarded-For`, en particulier avec le proxy Next : ne pas augmenter les hops sans connaître la topologie. [Règles Express](https://expressjs.com/en/guide/behind-proxies/).

## 7. Stockage, IA et opérations

Cloudinary conserve les fichiers authentifiés ; l'API fournit des uploads signés et du contenu après contrôle d'accès. Tester upload, preview PDF/DOCX et téléchargement. Aucun dossier `private-import` ni stockage disque local ne participe au runtime. Les sources privées et manifests restent locaux pour les imports ponctuels. Les extractions IA utilisent des buffers en mémoire, sans fichiers persistants.

GitHub Models est appelé depuis Nest uniquement. `AIAnalysisRun`, `AIExtraction`, Phase 2A/2B et validation humaine sont conservés. Sans token, la création/revue manuelle reste disponible. Pas de Mahakim fictif ni de nouveau rapport IA. Les erreurs HTTP du provider n'exposent plus son corps ; les erreurs inattendues ne journalisent plus les messages SQL/documents bruts.

Le throttling reste en mémoire (120/min global, 5/min login production) : chaque instance a son propre compteur. La rotation refresh peut écrire des données d'authentification ; les smoke tests ne doivent pas être dirigés vers des comptes métier pour créer des fixtures. Les analyses IA lancées en arrière-plan ne constituent pas une file durable : éviter redéploiements pendant une analyse et vérifier/reprendre les runs interrompus avec les procédures existantes.

Configuration manuelle choisie : les deux services et leurs quelques champs sont documentés ici ; pas de `render.yaml` imposant une offre payante ou des URLs inconnues.
