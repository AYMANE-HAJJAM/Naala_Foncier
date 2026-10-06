# Audit final avant Render — NAALA FONCIER

Audit du 6 octobre 2026 sur le working tree existant. Cette mission prépare Render ; elle ne déploie pas, ne modifie pas les données métier et n'ajoute pas de fonctionnalité.

Mise à jour après cet audit : [le nettoyage de l’admin principal](PRIMARY_ADMIN_CLEANUP.md) configure désormais un seul compte actif, désactive l’ancien admin, retire les comptes sans dépendances, remplace le seed par les rôles/permissions et ajoute la révocation immédiate des accès liée aux sessions. Ses résultats remplacent les constats initiaux ci-dessous concernant les comptes et le mot de passe.

## Périmètre et preuves

La racine, les fichiers cachés de configuration, les sources frontend/backend, schéma et migrations, scripts, tests, assets publics et les métadonnées des sources privées ont été inspectés. L'analyse TypeScript couvre les imports statiques, dynamiques et re-exports, puis les exports de composants et wrappers ont été recherchés globalement. Les entrées Next (page/layout/error) et Nest ne sont pas assimilées à du code mort parce qu'elles n'ont pas d'import explicite.

L'[inventaire technique](PRE_RENDER_INVENTORY.md) contient chaque route, les composants et consommateurs API associés, les 114 endpoints de controllers avec leur opération et source, tous les modules Nest avec leurs imports/services/controllers, chaque dépendance directe et chaque script. Les clients générés restent nécessaires : des hooks non consommés dans un client généré ne justifient pas une suppression manuelle ni la suppression des API.

Le dépôt était déjà modifié : nombreux fichiers métiers/UI modifiés, nouveaux helpers non suivis et 26 anciennes docs absentes. Ces changements ont été préservés. Les deltas métier/UI visibles dans `git diff` ne doivent pas être attribués intégralement à cette mission. Les anciennes suppressions de docs ne sont pas des nouvelles décisions de nettoyage ; leur historique Git est conservé.

## Suppressions confirmées

| Élément | Classe | Preuve et décision |
|---|---|---|
| `frontend/src/features/requisitions/overview/judicial-panel.tsx` | SAFE_DELETE | Aucune importation ni référence au fichier ou à JudicialPanel ; overview courant rend ses propres cartes |
| `frontend/src/features/requisitions/overview/points-to-clarify.tsx` | SAFE_DELETE | Aucune importation ni référence au composant PointsToClarify ; l'état de clarification actuel est géré ailleurs |
| `frontend/src/features/requisitions/overview/situation-panel.tsx` | SAFE_DELETE | Aucune importation ni référence au composant SituationPanel ; remplacé dans overview-tab |
| `backend/src/shared/pagination/pagination.dto.ts` et son dossier vide | SAFE_DELETE | PaginationQueryDto et paginated n'ont aucun consommateur ; pagination actuelle locale aux services |
| `backend/test/jest-e2e.json`, script backend `test:e2e` | SAFE_DELETE | Cherchait uniquement `.e2e-spec.ts`, fichier absent du dépôt ; aucun consommateur script/CI ; tous les tests AI existants restent exécutés par npm test |
| DefinitionList, CourtTimeline (`primitives.tsx`) | SAFE_DELETE | Exports seuls ; aucun import, JSX ou appel local/global |
| RiskBadge, Progress (`core.tsx`) | SAFE_DELETE | Exports seuls ; aucune référence JSX/import |
| TopographyTab, ActionDialog (`requisition-tabs.tsx`) | SAFE_DELETE | Aucun import/appel ; absents des sept onglets réellement rendus |
| toActionCategory, toActionPriority et leurs tables/types | SAFE_DELETE | Uniquement utilisés par ActionDialog supprimé ; aucun autre consommateur |
| Wrappers getUpcomingEvents, retryDocumentAnalysis, getRequisitionEvents, getCalendarEvents, getDocumentAnalysisStatus, getPendingAiProposalsCount (`phase1.ts`) | SAFE_DELETE | Aucun import nommé depuis phase1 ; les opérations utilisées passent par le client généré ou d'autres wrappers actifs |
| Wrapper updateLegalCase (`phase-b.ts`) | SAFE_DELETE | Aucun consommateur ; endpoint conservé pour son workflow métier |
| SMTP_* dans schéma env et exemple | SAFE_DELETE | Aucune lecture en dehors de la validation env ; aucun transport SMTP implémenté |
| safeErrorBody (client GitHub Models) | SAFE_DELETE | Suppression de la remontée de corps d'erreur provider, qui peut contenir du texte privé |
| @nestjs/testing, supertest, @types/supertest (backend), prettier (frontend) | UNUSED | Aucun import/test/script/config utilisateur ; les tests backend ne reposent pas sur Nest Testing ou supertest, aucun formatter Prettier configuré |

Aucun module Nest, controller, endpoint ou migration n'est supprimé. Aucune source métier privée n'est supprimée. Les répertoires `node_modules` sont conservés ; seules les dépendances ciblées ont été réconciliées par npm install (pas de suppression du dossier, pas de npm ci réel sur le workspace).

## Racine / fichiers locaux / générés

| Élément | Classe | Décision |
|---|---|---|
| backend/, frontend/ | ACTIVE | Code produit, tests et scripts maintenus |
| docs/ et README.md | ACTIVE | Documentation actuelle réécrite, références et historique distingués |
| .gitignore | DEPLOYMENT_REQUIRED | Builds, résultats QA, secrets et données privées ignorés ; reports/artifacts généralisés aux sous-projets |
| .gitattributes | ACTIVE | Conservé : règles Git et fins de ligne, exception des formats générés |
| .git/ | LOCAL_ONLY | Métadonnées de travail, pas de nettoyage |
| .phase-c-qa.env | LOCAL_ONLY / TEST_ONLY | KEEP local, ignoré ; lu par Playwright, e2e/qa-env et trois scripts backend QA, généré par phase-c-qa-environment |
| backend/.env, frontend/.env.local | LOCAL_ONLY | Valeurs non affichées, fichiers non modifiés, non versionnés |
| node_modules/ | LOCAL_ONLY / DEPLOYMENT_REQUIRED | Présents localement, jamais livrés ; installation reproductible via lockfiles |
| src/generated Prisma et Orval | DEPLOYMENT_REQUIRED / GENERATED | Conservés : imports runtime actifs ; Prisma régénéré au build Render |
| .next, .next-e2e, dist, artifacts, test-results, playwright-report, caches *.tsbuildinfo | GENERATED | Supprimés après validation ; backend/.generated (cache npm, logs/certificat smoke et audits temporaires créés par cette mission) et six helpers temporaires racine aussi retirés ; clients source nécessaires conservés |
| frontend/public | SAFE_DELETE | Inventaire vide vérifié : aucun asset démo, logo, favicon ou image à supprimer ; dossier vide supprimé |

`frontend/UI_REDESIGN_PLAN.md` est déplacé vers `docs/historical/UI_REDESIGN_PLAN.md` (HISTORICAL), pas supprimé : garde la traçabilité du design. Aucun Blueprint : configuration manuelle simple documentée, aucune URL finale imposée ni offre Render choisie automatiquement.

## Routes, navigation et produit

25 pages explicites Next, plus `_not-found` fourni par le framework. Leur détail et graphe de composants/API figurent dans l'inventaire.

| Routes | Rôle et navigation | Classe |
|---|---|---|
| `/` | ADMIN, entrée Tableau de bord ; garde redirige USER vers son home | ACTIVE |
| `/dashboard` | USER, Tableau de bord ; contrôle de rôle dans les guards/layout | ACTIVE |
| `/requisitions`, `/requisitions/[requisitionId]` | ADMIN portfolio ; détail limité aux affectations pour USER ; menus, cartes et notifications | ACTIVE |
| `/mes-terrains` | USER, entrée Mes terrains | ACTIVE |
| `/calendrier` | ADMIN et USER, menu calendrier avec scope terrain | ACTIVE |
| `/administration`, `/administration/utilisateurs`, `/administration/affectations` | ADMIN, menu administration et cartes | ACTIVE |
| `/notifications`, `/profil` | Fonctions transversales ; cloche et menu utilisateur ; justifiées par notifications métier et identité | ACTIVE |
| `/login`, `/forbidden` | Authentification et refus d'accès explicites | ACTIVE |
| `/agenda`, `/mes-dossiers`, `/utilisateurs`, `/requisitions/nouveau` | Anciens liens vers calendrier, mes-terrains, administration/utilisateurs et modal de création | COMPATIBILITY_REDIRECT |
| `/actions`, `/analyses-ai`, `/contentieux`, `/oppositions`, `/parametres`, `/rapports` | Anciennes pages globales, désormais redirection légère vers `/` ; plus de section métier indépendante | COMPATIBILITY_REDIRECT |
| `/documents`, `/portefeuille` | Anciens liens vers `/requisitions` | COMPATIBILITY_REDIRECT |

Aucune page DEAD confirmée. Les redirections protègent les anciens favoris et ne rendent pas d'ancienne UI. Menus ADMIN = Tableau de bord/Terrains/Calendrier/Administration ; USER = Tableau de bord/Mes terrains/Calendrier. Terrain = Vue d'ensemble/Documents/Oppositions/Suivi judiciaire/Calendrier/Rapports/Historique. Propositions IA gardées dans les workflows documents/création, sous permissions ADMIN ; aucun dashboard IA global ni Mahakim ajouté.

## Modules et endpoints conservés

Les services/controllers/imports exacts sont détaillés par module dans l'inventaire. Chaque endpoint garde son contrôle d'accès existant ; une absence de consommateur frontend n'est pas une preuve de mort.

| Modules | Classe | Usage réel |
|---|---|---|
| IdentityAccess, Authentication, Access | ACTIVE | Login/refresh/logout, utilisateurs/rôles, permissions et affectations |
| Requisitions, Dashboard | ACTIVE | Terrain central, portfolios, dashboard par rôle |
| Documents, Storage | ACTIVE | Uploads signés, versions, aperçu et contenu Cloudinary |
| Events | ACTIVE | TerrainEvent, snapshot, calendrier et changement de dates |
| Oppositions, LegalCases, Hearings | ACTIVE | Oppositions, affaires et audiences ; suivi judiciaire |
| Reports | ACTIVE | Versions, revue, validation/publication et documents de rapport |
| Notifications, Audit | ACTIVE | Notifications in-app, rappels, journal et activité terrain |
| TerrainDrafts, AIAnalysis | ACTIVE | Création manuelle/assistée, Phase 2A/2B, propositions et confirmation humaine |
| Actions | LEGACY_KEEP | ActionItem encore interrogé par DashboardService ; CRUD/commentaires opérateur et données historiques conservés, malgré retrait du modal orphelin |
| Database, AppModule, HealthController | DEPLOYMENT_REQUIRED / ACTIVE | Composition Nest, DB et health opérationnel |
| AlertsCompatibilityController | LEGACY_KEEP | `/api/alerts` encore consommé par cloche/page notifications et hooks générés ; alias léger |

Les endpoints sans import nommé (CRUD, versions, repair/cleanup, téléchargement, santé, actions/commentaires) restent disponibles pour les workflows métier et opérateurs. Aucun endpoint de test public ajouté. Swagger optionnel ajoute uniquement ses routes docs quand activé.

## IA / Mahakim / stockage

AIAnalysisRun, AIExtraction, DocumentAnalysisProvider, GitHubModelsDocumentAnalysisProvider, phases 2A/2B restent actifs. Les tables AIAnalysisJob/AIAnalysisDocument/DocumentAnalysis/ExtractedFact sont LEGACY_KEEP : schéma et migrations historiques, aucun nouveau controller/service/UI pour ces anciens modèles.

Aucun prototype/provider Mahakim dans les sources inspectées ; aucune intégration inventée. Cloudinary est le seul stockage runtime. Les trois fichiers source storage étaient ignorés par `backend/.gitignore` (`storage/` matchait aussi `src/shared/storage`) : règle remplacée par `/storage/`, fichiers maintenant visibles à Git. Ils doivent être commités pour qu'un clone puisse compiler.

Le preparer IA travaille en mémoire ; pas de stockage persistant de fichiers temporaires. Les jobs IA restent lancés dans le processus : ce n'est pas une file durable ; une interruption de déploiement peut demander reprise/cleanup existant.

## Scripts / imports privés

Tous les scripts sont classés dans l'inventaire : QA ACTIVE, maintenance OPERATIONAL_KEEP, imports/backfill/réparations ONE_TIME_KEEP. Ils ont des usages opérateur ou sont appelés par package.json/d'autres scripts. Aucun script d'import/repair/cleanup n'a été lancé automatiquement dans cette mission. Le seed ne sert pas au runtime normal et ne doit pas être relancé automatiquement sur la base existante.

Réserve opérateur : `repair-reports.mjs` et `write-final-import-status.mjs` importent des chemins `.js` sous `src/`, alors que les sources sont `.ts`. Leur valeur de réparation/traçabilité justifie leur conservation, mais un lancement direct par `node` sur un clone peut échouer sans résolution TS. Les exécuter avec le runner existant `npx tsx scripts/<nom>.mjs` après revue et vérification de la base cible, ou adapter leurs imports au build avant toute utilisation. Ils ne participent ni au build Render ni au runtime normal. Leur exécution et leurs écritures ne sont pas validées par cet audit.

`terrain-summaries.ts` est LEGACY_KEEP / ONE_TIME_KEEP malgré absence du graphe runtime : utilisé par seed, phase1-backfill, apply-presentation-summaries et write-final-import-status. Il contient des faits de référence, pas un ancien prototype à supprimer.

Private-import : trois documents sources (2 PPTX, 1 DOCX), 48 images extraites, manifests, overrides et reviews restent locaux et ignorés. Les extractions `.md/.raw.json`, assets et manifests sont GENERATED mais servent aux imports/revue ; conservés. Les overrides manuels ne sont pas assimilés à du jetable. `_pptx1-media-probe.txt` est UNKNOWN : aucune preuve suffisante qu'il n'a plus de valeur de référence ; conservé. Aucun contenu source n'est exposé ni nécessaire au runtime.

## Configuration et sécurité

- `PORT` Render prime sur API_PORT ; écoute 0.0.0.0 ; arrêt Prisma via hooks Nest.
- WEB_ORIGIN production doit être une origine HTTPS exacte, sans localhost implicite, path ou slash final. CORS credentials actif, origine unique.
- API_INTERNAL_URL requis au build/start production ; rewrite unique `/api` ; NEXT_PUBLIC_API_BASE_URL non vide refusé. URL backend serveur uniquement, pas de token IA frontend.
- Cookie refresh httpOnly, Secure production, SameSite=lax, host-only, Path=/api/auth ; rotation et suppression conservées. Le proxy Next évite les cookies cross-site sur deux domaines Render.
- Trust proxy limité au plus proche (`1`) ; valider la chaîne Render/Next réelle pour les IP. Limites en mémoire par instance, sans Redis ajouté.
- Swagger OFF par défaut et valeur booléenne validée ; activation explicite seulement.
- Erreurs provider sans corps libre ; erreurs inattendues sans messages SQL/texte de documents bruts dans les logs. Codes, IDs de run, méthode et chemin restent exploitables.
- INITIAL_ADMIN_PASSWORD n'est plus obligatoire au runtime ; secrets de seed/reset utilisés uniquement dans ces opérations explicites.
- SSL runtime recommandé `sslmode=verify-full` pour le driver pg actuel ; DIRECT_URL CLI Neon TLS conservée. Pas de réécriture automatique des env ; connexion QA verify-full testée.

Les migrations production passent par `prisma migrate deploy` en pre-deploy (offre payante) ou dans start avant npm start. Aucun reset/db push, aucune migration supprimée/réécrite. [Guide complet](RENDER_DEPLOYMENT.md).

## Secrets

Scan du contenu actuel versionné/non ignoré : patterns clés privées/GitHub tokens/URLs DB credentialées et comparaison exacte avec secrets locaux. Aucun secret restant détecté après correction. Les env secrets sont ignorés ; seules les valeurs d'exemple vides sont suivies. Ce scan n'est pas une garantie cryptographique ni un audit complet de l'historique Git.

L’audit initial avait confirmé qu’un mot de passe de fixture historique correspondait au compte admin local. La fixture a été remplacée par randomBytes. L’opération ultérieure autorisée de nettoyage a désactivé cet ancien compte et configuré un nouvel admin avec un secret aléatoire ; ce blocage est levé. L’ancien script de reset est retiré. Utiliser exclusivement la procédure `npm run admin:setup` et les variables PRIMARY_ADMIN décrites dans [le livrable de nettoyage](PRIMARY_ADMIN_CLEANUP.md).

## Dépendances et avis npm

Tous les packages directs restants ont une preuve d'import, d'utilisation framework/CLI, de type ou de peer nécessaire. TypeScript/ESLint/Orval/CSS/types frontend sont DEV_ONLY et déplacés dans devDependencies ; Prisma CLI backend est DEV_ONLY aussi, mais doit être installé pour build/pre-deploy. Builds Render incluent donc `--include=dev`.

Mises à jour ciblées, sans audit fix --force : Next/eslint-config-next 16.3.8, dépendances compatibles vulnérables et pdf-to-img 7 (Node 24 compatible, PDF.js corrigé ~6.2.108). Le rendu PDF réel fait l'objet d'une régression dédiée. Les APIs métier et l'architecture restent inchangées. [Avis Next Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36), [avis Next ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [avis PDF.js](https://github.com/advisories/GHSA-hq66-cqwq-w95j).

Résultat complet final npm audit :

- Frontend : **5 high**, 0 moderate, 0 critical ; chaîne ESLint `@next/eslint-plugin-next`, `eslint-config-next`, `braces`, `fast-glob`, `micromatch`, outils DEV_ONLY. npm suggère un downgrade incompatible vers eslint-config-next 14 ; non appliqué.
- Backend : **6 high, 23 moderate, 0 critical**. High dans Prisma CLI (`prisma`, `@prisma/config`, `@prisma/dev`, `deepmerge-ts`, `find-my-way`, `mysql2`) ; le runtime utilise adapter-pg/PostgreSQL, pas Prisma dev server ni MySQL. Moderate dans chaîne Jest/js-yaml, Prisma/valibot, Swagger, mammoth/argparse/sprintf-js. Ne pas affirmer que toutes ces chaînes sont exploitables via une requête métier ; ne pas affirmer non plus que l'audit npm est entièrement vert. Les rétrogradations Prisma 6, Jest 25, mammoth 0.x proposées automatiquement seraient incompatibles.

Les avis critiques initiaux Next/proxy-addr et les PDF.js vulnérables sont corrigés. Les avis résiduels doivent être revus/traités selon versions upstream et exposition réelle avant un feu vert de sécurité sans réserve.

## Validations

Les validations finales et le nettoyage des outputs sont terminés. Les premiers essais ont rencontré les restrictions réseau du sandbox, un plantage Turbopack Windows et des redémarrages du watcher backend pendant l'audit. Le contournement Webpack a ensuite rencontré une incompatibilité PDF.js à l'import du viewer ([incident upstream documenté](https://github.com/mozilla/pdf.js/issues/20478)). Configuration QA finale : commande npm selon OS, backend compilé/start sans watcher et moteur Next par défaut (Turbopack 16.3.8), suites successives avec un seul writer pour .next-e2e. Ces incidents ne doivent pas être rapportés comme des tests métier réussis.

| Vérification | Résultat final |
|---|---|
| Backend typecheck / lint / test / build | Tous code 0 ; 15 suites, 54 tests passés, dont rendu PDF réel |
| Frontend typecheck / lint / build | Tous code 0 ; lint final sans warning ; build Next 16.3.8, 26 entrées générées dont route dynamique |
| Prisma validate / migrate status | Schéma valide ; 14 migrations ; Neon public à jour ; aucune migration appliquée par cette mission |
| Playwright auth / Phase C et responsive | Auth : 7/7 passés ; Phase C : 3/3 passés (2 parcours API, 1 UI/responsive), code 0 ; UI finale sous Turbopack 16.3.8 |
| Smoke HTTPS production | Code 0 ; backend/frontend start production, PORT, health 200, Neon verify-full, Swagger OFF, CORS, login ADMIN/USER, cookie HTTPS host-only, refresh/rotation/logout, refus ADMIN au USER ; détail terrain, module documents et suivi judiciaire chargés sans exception navigateur ; aucun service Render réellement déployé |
| npm ci simulation | Backend et frontend code 0 avec --dry-run --ignore-scripts --include=dev ; aucun dossier node_modules supprimé |
| git diff --check | Code de sortie 0 ; avertissements CRLF/LF, pas d'erreur whitespace |
| Scan secrets actuels | 0 pattern et 0 valeur secrète locale après correction fixture |

## Structure finale et deployability

```text
Naala Foncier/
├── backend/
├── frontend/
├── docs/
│   ├── README.md
│   ├── RENDER_DEPLOYMENT.md
│   ├── RENDER_DEPLOYMENT_CHECKLIST.md
│   ├── PRE_RENDER_FINAL_AUDIT.md
│   ├── PRE_RENDER_INVENTORY.md
│   └── historical/UI_REDESIGN_PLAN.md
├── .gitattributes
├── .gitignore
└── README.md
```

Local uniquement : .git, .phase-c-qa.env, env, node_modules et private-import. La configuration technique Render est préparée ; **feu vert publication sans réserve : NO** tant que les avis npm résiduels ne sont pas traités/revus et le commit final n'est pas relu. Le nettoyage de l’ancien admin est effectué ; voir PRIMARY_ADMIN_CLEANUP.md pour les validations actualisées. Les URLs, secrets, services et recette Render réelle restent à configurer selon la checklist. Aucun déploiement ni commit forcé réalisé.
