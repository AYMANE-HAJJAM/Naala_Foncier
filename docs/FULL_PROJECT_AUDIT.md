# Audit complet du projet NAALA FONCIER

Date de l'audit : 25 août 2026  
Périmètre : code du repository, configuration locale, migrations Prisma et lectures non destructives de la base Neon configurée.  
Méthode : inspection du code réel, exécution des tests/builds et requêtes de lecture. Aucune donnée, migration ou fonctionnalité n'a été modifiée.

## 1. Executive summary

### Verdict global

NAALA FONCIER est une plateforme fonctionnelle partielle, estimée à **environ 65 %** de sa cible décrite. Le socle principal existe réellement : authentification, rôles, filtrage par affectation, portefeuille des terrains, détail terrain, documents privés Cloudinary, wizard de création, événements, affaires judiciaires, oppositions, calendrier, notifications in-app, rapports structurés et audit log.

La plateforme ne peut toutefois pas être qualifiée de terminée :

- la base Neon n'est pas alignée avec le client Prisma : la migration `20260812140000_phase2b_terrain_update_analysis` n'est pas appliquée ; une lecture de `AIAnalysisRun.contextType` échoue réellement avec Prisma `P2022` ;
- l'AI est non opérationnelle dans l'environnement audité (`AI_PROVIDER` vide, aucun token GitHub Models, zéro `AIAnalysisRun`) ;
- plusieurs écrans globaux contiennent encore des actions simulées et du texte de démonstration ;
- le calendrier global repose sur `Hearing`, pas sur l'API unifiée `TerrainEvent`, contient une date surlignée en dur et peut placer un événement passé dans « Prochaines échéances » selon son statut ;
- aucun rapport actif n'est présent sur les six terrains dans Neon, malgré un modèle et des endpoints réels ; la « génération consolidée » frontend est simulée ;
- SMTP/email et Mahakim sont absents ;
- le build et le typecheck frontend échouent sur des types `.next/dev` invalides ; le lint frontend échoue avec 8 erreurs et 57 avertissements ; le lint backend ne démarre pas car `eslint` n'est pas installé dans le backend ;
- il n'existe aucun test frontend ni vrai test d'intégration/e2e du workflow complet.

### Ce qui est réellement exploitable

- Authentification JWT avec refresh token rotatif en cookie `httpOnly`, révocation et contrôle des utilisateurs actifs.
- Deux rôles actifs (`ADMIN`, `USER`) et permissions globales.
- Six terrains principaux correctement identifiés ; R 16605/31 reste non principal et relié à R 20612/31.
- Cloisonnement des lectures par `UserRequisitionAccess` pour les utilisateurs.
- Upload utilisateur/admin vers Cloudinary via signature serveur, URLs de lecture temporaires, preview PDF/image/DOCX et téléchargement.
- Wizard ADMIN transactionnel pour rattacher les documents du draft au terrain final.
- CRUD backend des domaines principaux, même si tous les écrans de gestion ne sont pas raccordés.
- Dashboards alimentés par la base, sans statistiques aléatoires.

### Limites de certitude

Les 23 tests backend passent, mais ils sont unitaires et largement centrés sur l'authentification et les helpers AI. Aucun parcours navigateur, aucune vraie requête GitHub Models, aucun upload Cloudinary de bout en bout et aucune confirmation Phase 2B sur Neon n'ont été validés. Les fonctionnalités concernées restent donc `UNTESTED`, `PARTIAL` ou `BROKEN` selon les preuves ci-dessous.

## 2. Architecture actuelle

### Vue d'ensemble

| Couche | Technologie | État observé |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript, TanStack Query, Orval | UI métier riche, mais pages historiques et actions simulées encore présentes |
| Backend | NestJS 11, TypeScript, guards globaux, Swagger | 17 modules importés dans `AppModule`, API réellement exposée sous `/api` |
| Données | PostgreSQL Neon, Prisma 7 | 9 migrations locales, 8 appliquées ; schéma/client en avance sur Neon |
| Stockage | Cloudinary privé/signé | Configuré localement ; métadonnées en base et URLs temporaires |
| AI | GitHub Models, Zod, PDF/DOCX/image | Code 2A/2B présent, environnement non configuré et base incompatible 2B |
| API client | OpenAPI Nest + Orval | Génération présente ; mélange d'appels Orval et de fetchers manuels Phase 1/2B |
| Tests | Jest backend | 5 suites, 23 tests ; aucun test frontend/e2e réel |

### Structure utile

- `backend/src/modules/` : modules métier NestJS.
- `backend/src/shared/` : auth, permissions, accès par terrain, Prisma, stockage et erreurs.
- `backend/prisma/schema.prisma` : 29 modèles et enums métier.
- `backend/prisma/migrations/` : historique SQL de juillet à août 2026.
- `backend/prisma/seed.ts` : rôles, permissions, sept réquisitions dont six principales, données de démonstration contrôlées.
- `backend/scripts/` : import des sources, assets, backfill Phase 1 et réparation de rapports.
- `frontend/src/app/` : routes Next.js.
- `frontend/src/features/` : dashboards, registres et vues terrain.
- `frontend/src/generated/api/` : client Orval généré.
- `frontend/src/lib/api/phase1.ts` : endpoints récents encore appelés manuellement.
- `docs/` : documentation historique ; utile comme contexte mais non utilisée comme preuve de complétion.

### Flux principal

`Next.js -> /api (rewrite localhost:3001) -> Nest guards globaux -> service métier -> Prisma/Neon -> Cloudinary ou GitHub Models selon le cas`.

## 3. Backend audit

Tous les modules listés ci-dessous sont réellement importés par `backend/src/app.module.ts:23` à `backend/src/app.module.ts:39`.

| Module | Responsabilité et endpoints principaux | Permissions / portée | État et problèmes |
|---|---|---|---|
| Identity/access | `/auth/login`, `/refresh`, `/logout`, `/me`; `/users`, `/roles`, `/permissions` | Login/refresh/logout publics ; utilisateurs et rôles sous `user.manage`/`role.manage` | Auth réelle. Liste utilisateurs filtre seulement les actifs, donc un utilisateur désactivé disparaît et n'est plus réactivable depuis la liste courante. UI création utilisateur incomplètement raccordée. |
| Requisitions | `/requisitions`, CRUD, `/requisitions/:id/access` | lecture `requisition.view`, mutations ADMIN via permissions ; lecture filtrée par affectation | Réel et utilisé. Soft delete. R 16605 exclu des principaux par presenter. |
| Terrain drafts | `/terrain-drafts`, upload sessions, documents, analyse, review, confirm, cancel | `requisition.create`, donc ADMIN dans le seed | Workflow réel et transaction de confirmation. Nettoyage Cloudinary best-effort hors transaction. Drafts abandonnés non expirés automatiquement. |
| Documents | `/documents`, `/requisitions/:id/documents`, upload sessions, versions, preview/download/content, validation | USER possède view+upload ; accès terrain vérifié, `INTERNE` masqué aux non-admin | Solide côté accès. Upload direct Cloudinary signé. Suppression logique + suppression objet best-effort. Pas de scanner antivirus ni test intégration upload. |
| Events/snapshot | `/requisitions/:id/events`, `/calendar/events`, `/calendar/upcoming`, CRUD events | lectures affectées ; mutations réservées ADMIN dans le service | API unifiée réelle. Snapshot recalculé après mutations. Le frontend calendrier global n'utilise pas cette API. |
| Legal cases | `/legal-cases`, `/requisitions/:id/legal-cases`, CRUD | USER lecture affectée ; ADMIN manage | Plusieurs affaires par terrain supportées. `caseNumber` est unique globalement. Statut dupliqué (`currentPhase`, `currentStage`, `currentStatus`) et non automatiquement dérivé des hearings/events. |
| Hearings | `/hearings`, `/agenda`, `/requisitions/:id/hearings`, CRUD | USER lecture affectée ; ADMIN manage | Réel. Double concept avec `TerrainEvent`; synchronisation miroir partielle et risque de divergence. |
| Oppositions | `/oppositions`, `/requisitions/:id/oppositions`, CRUD | USER lecture affectée ; ADMIN manage | Réel. Seed ne crée que 2 lignes détaillées alors que les compteurs agrégés annoncent jusqu'à 27 oppositions. |
| Calendar | endpoints dans Events + alias `/agenda` dans Hearings | filtrage affectation réel | Deux sources concurrentes. Le frontend global appelle Hearings uniquement. |
| Notifications | `/notifications`, read/read-all, compat `/alerts` | chaque requête est filtrée par `userId` | In-app réel. Déclencheurs réels uniquement autour des propositions AI 2B et confirmations. Aucun SMTP. |
| Reports | `/reports`, versions, submit, validate/reject, preview/download/content | USER view affecté ; ADMIN manage/validate | Modèle et cycle de validation réels. Pas de publication distincte. Pas de moteur PDF/AI de génération. Aucun rapport actif sur les six terrains Neon. |
| AI analysis legacy | `/ai-analysis`, compat `/analyses` | ADMIN launch/validate, lecture affectée | Ancien modèle `AIAnalysisJob`/`DocumentAnalysis`/`ExtractedFact` coexiste avec Phase 2A/2B. UI globale héritée. |
| AI Phase 2A/2B | draft analysis et `/requisitions/:id/documents/:documentId/analyze`, status, proposals, confirm/reject/conflict | upload autorise l'analyse ; propositions et confirmation ADMIN dans le service | Code substantiel, mais AI non configurée et migration 2B absente sur Neon. Workflow réel `BROKEN` dans l'environnement. |
| Dashboard | `/dashboard` | filtré par terrain, notifications utilisateur, audit seulement ADMIN | Données réelles. Agenda issu de Hearings, sans limite temporelle et tri ascendant depuis les plus anciennes dates. |
| Audit | `/audit-logs`, `/requisitions/:id/activity` | `audit.view` global ou lecture terrain | Réel mais couverture inégale : certaines mutations n'écrivent pas d'audit ou auditent seulement un sous-ensemble. |
| Actions | `/actions`, commentaires, routes terrain | USER view ; ADMIN manage | Réel mais pages principales redirigées ; écran global contient création simulée. |
| Storage | service Cloudinary | serveur uniquement | Signatures et secrets côté backend. Les URLs temporaires protègent téléchargement/preview. |
| Health/OpenAPI | `/api/health`, `/api/docs`, `/api/openapi.json` | health public ; OpenAPI passe par guard global sauf décoration contraire | Swagger est créé même si `SWAGGER_ENABLED` vaut false : la variable est déclarée mais non appliquée dans `main.ts`. |

### Contrôles d'accès et IDOR

Points positifs :

- `GlobalAuthGuard` protège tout sauf les routes `@Public`.
- `PermissionsGuard` impose toutes les permissions demandées.
- `AccessScopeService` produit un filtre des terrains affectés et bloque l'accès direct par identifiant.
- documents, rapports, événements, oppositions, affaires et hearings vérifient généralement la portée en lecture.

Risques :

- plusieurs services de mutation (`ActionsService`, certaines créations/updates de reports/legal cases/hearings) ne revérifient pas systématiquement la portée terrain dans la méthode de mutation. Avec le seed actuel, seul ADMIN possède les permissions de gestion, donc l'exploitation par USER est bloquée ; une future personnalisation de rôles pourrait introduire un IDOR. Il faut imposer la portée dans le service, pas seulement compter sur le rôle actuel.
- `NotificationsService.read` utilise une clé composite implicite `{id, userId}`. Cela compile avec le client actuel, mais doit être couvert par un test de non-divulgation.
- les secrets Cloudinary/GitHub/SMTP ne sont jamais envoyés au frontend. Aucun secret n'a été copié dans cet audit.

## 4. Frontend audit

### Routes réellement présentes

| Route | Rôle | APIs / composant | État réel |
|---|---|---|---|
| `/login` | Public | `useLogin` | Fonctionnel dans le code ; session access token en `sessionStorage`, refresh en cookie. |
| `/` | ADMIN | `DashboardPage`, `/dashboard`, `/users` | Données réelles ; redirige USER. |
| `/dashboard` | USER | `UserDashboardPage`, `/dashboard`, `/reports` | Données réelles et filtrées backend ; rapports vides actuellement. |
| `/requisitions` | ADMIN | `PortfolioPage`, `/requisitions` | Liste, filtres, ouverture détail et modal Nouveau terrain. |
| `/requisitions/nouveau` | ADMIN | page de redirection/entrée vers le portefeuille/wizard | Chemin historique ; le vrai flux est modal depuis `/requisitions`. |
| `/requisitions/:id` | ADMIN/USER affecté | détail + endpoints terrain | Vue centrale réelle. Upload USER autorisé selon permission. |
| `/mes-terrains` | USER | `MesDossiersPage`, `/requisitions` | Réel ; nom interne historique « dossiers ». |
| `/calendrier` | ADMIN/USER | `AgendaPage`, `/hearings`, `/requisitions` | Partiel et incohérent avec l'API TerrainEvent. |
| `/notifications` | ADMIN surtout, cloche pour tous | `/alerts`, read/read-all | Réel. L'accès de navigation complet diffère selon le rôle, mais la cloche fonctionne. |
| `/administration` | ADMIN | liens utilisateurs/affectations | Réel. |
| `/administration/utilisateurs` | ADMIN | `UsersPage`, `/users` | Liste réelle ; invitation/création affichée mais pas raccordée au mutation hook. |
| `/administration/affectations` | ADMIN | `/requisitions/:id/access` via fetch manuel | Grant/revoke réels et rafraîchissement local. |
| `/rapports` | non exposée dans nav principale | `ReportsPage`, `/reports` | Registre réel, bouton génération consolidée simulé. |
| `/oppositions` | non exposée dans nav principale | `/oppositions` | Données backend, mais détails et libellés explicitement de démonstration. |
| `/actions` | tous | redirect `/` | Ancienne route morte ; composant Actions existe mais non relié. |
| `/analyses-ai` | tous | redirect `/` | Ancienne route morte ; composant existe mais non relié. |
| `/contentieux` | tous | redirect `/` | Composant registre existe mais route volontairement neutralisée. |
| `/documents` | tous | redirect `/requisitions` | Registre Documents existe mais route neutralisée. |
| `/agenda` | tous | redirect `/calendrier` | Alias historique. |
| `/mes-dossiers` | USER | redirect `/mes-terrains` | Alias historique. |
| `/utilisateurs` | historique | page Users séparée | Duplication avec `/administration/utilisateurs`. |
| `/profil`, `/parametres`, `/forbidden` | selon contexte | local/session ou composants historiques | Profil accessible USER ; paramètres contiennent du texte de démonstration. |

### Détail terrain

Le composant `RequisitionDetailPage` expose réellement les onglets Vue d'ensemble, Documents, Oppositions, Suivi judiciaire, Calendrier/chronologie, Rapports, Historique et analyse/mises à jour AI selon les composants importés.

- **Vue d'ensemble** : données réelles, édition ADMIN, preview/téléchargement de documents et rapports.
- **Documents** : liste réelle par catégories, catégories custom, upload ADMIN/USER, preview et téléchargement. Suppression/édition restent conditionnées par permissions.
- **Oppositions** : données réelles du backend, CRUD backend disponible ; l'UI de détail ne couvre pas nécessairement toutes les mutations.
- **Suivi judiciaire** : affaires et audiences réelles ; création/édition par ADMIN dans `JudicialTab`.
- **Calendrier/historique** : `TerrainTimeline` appelle TerrainEvent et autorise création ADMIN ; coexistence avec hearings.
- **Rapports** : lecture/preview/download réels ; aucune génération réelle.
- **Historique** : audit terrain réel mais limité aux logs dont `entityType=Requisition`, donc les logs Document/Event associés ne sont pas agrégés.
- **AI updates** : composant Phase 2B relié, mais inutilisable sur Neon avant migration/configuration.

### UX et responsive observables

- `AppShell` possède sidebar responsive, overlay mobile, navigation par rôle et cloche notifications.
- Les tableaux globaux imposent souvent des largeurs minimales (jusqu'à `1300px`) : utilisables par scroll horizontal, mais non validés par test mobile.
- Aucun test Playwright/Cypress ni capture multi-viewport n'existe ; mobile reste `UNTESTED`.
- Le lint signale plusieurs mises à jour synchrones de state dans des effects, notamment preview PDF/DOCX, détail terrain, édition overview et propositions AI.

## 5. Data model audit

| Modèle | Rôle / relations | Usage réel | Dette ou duplication |
|---|---|---|---|
| `User`, `Role`, `Permission`, jointures | identité, RBAC, tokens, affectations | Très utilisé | Deux rôles actifs mais création de rôles custom possible ; sécurité future doit rester portée terrain. |
| `Requisition` | agrégat Terrain | Central | Beaucoup de champs dénormalisés (`latestKnownEvent`, `importantDate`, `eventLabel`, snapshot) et hérités V1. Risque de divergence. |
| `UserRequisitionAccess` | affectation USER-terrain | Utilisé pour toutes les lectures critiques | Correct. |
| `RequisitionRelation` | liens entre terrains | Utilisé pour R 20612 -> R 16605 | Relation directionnelle unique alors que le libellé est réciproque. |
| `Document` / `DocumentVersion` | métadonnées et versions Cloudinary | Très utilisé | `ACTES` et `ACTES_PROPRIETE` coexistent ; `RAPPORTS` recoupe `Report`. |
| `DocumentRequest` | pièces manquantes | Seedé, peu raccordé UI | Modèle réel mais workflow faible/non exposé. |
| `UploadSession` | upload terrain existant | Code actif ; 0 ligne Neon au moment de l'audit | Sessions expirées non nettoyées par job observé. |
| `TerrainDraft` / `TerrainDraftDocument` | wizard | 6 drafts, 1 document draft en Neon | Pas de TTL automatique ; risque d'assets orphelins si navigateur abandonné. |
| `TerrainEvent` | timeline officielle et calendrier unifié | Actif sur les six terrains | Duplique partiellement Hearing et champs Requisition. |
| `RequisitionStatusSnapshot` | statut courant dérivé | Présent pour les sept références | `currentStage` est `String?` au lieu de l'enum et combine encore des champs hérités. |
| `LegalCase` | affaire judiciaire | 5 affaires actives | Trois champs de statut, dates également dans Hearing/Event/Requisition. Mahakim fields inutilisés. |
| `Hearing` | audience/échéance | 4 lignes actives auditées | Pas de modèle `CourtEvent` distinct ; fait office d'événement judiciaire historique. |
| `Opposition` / `OppositionDocument` | oppositions détaillées et sources | 2 lignes détaillées | Compteur `Requisition.oppositionCount` déconnecté du nombre de lignes. Sources nulles sur les deux lignes Neon. |
| `Notification` / `NotificationReminder` | in-app et rappels | 5 notifications ; rappels non démontrés | Reminder/email sans worker ni SMTP. |
| `Report` / `ReportVersion` | rapports métier versionnés | Code actif, 0 rapport actif sur les six | `status` par défaut `VALIDE`, surprenant pour une création manuelle ; document source/preview double le stockage documentaire. |
| `AIAnalysisJob` / `AIAnalysisDocument` / `DocumentAnalysis` / `ExtractedFact` | ancienne chaîne AI | API compat et ancien écran | Redondant avec `AIAnalysisRun`/`AIExtraction`; migration/consolidation à décider. |
| `AIAnalysisRun` / `AIExtraction` | Phase 2A/2B | 0 run ; 1 extraction de review wizard | Schéma local incompatible avec Neon avant migration 2B. |
| `ActionItem` / `ActionComment` | tâches | Backend réel, UI principale non reliée | Hors parcours V1 final actuel. |
| `AuditLog` | traçabilité | 32 logs en Neon | Pas de relation polymorphe ; historique terrain ne remonte pas toutes les entités liées. |

## 6. Documents

### Fonctionnel dans le code

- upload ADMIN et USER si `document.upload` et accès au terrain ;
- taille maximale configurable (25 MiB par défaut) et whitelist frontend d'extensions ;
- session d'upload signée côté serveur, envoi direct vers Cloudinary ;
- stockage de `publicId`, `assetId`, resource type, format, version et métadonnées ;
- URLs preview/download signées et temporaires (900 secondes par défaut) ;
- endpoint de contenu authentifié pour preview DOCX ;
- preview PDF via `react-pdf`, images et DOCX via `docx-preview` ;
- versions documentaires, validation, demande de copie plus lisible, soft-delete ;
- masquage des documents `INTERNE` pour les non-admin ;
- catégories standards et `AUTRE + customCategoryName` ;
- rattachement draft -> document final sans duplication physique Cloudinary.

### Problèmes

- l'enum contient `ACTES` et l'ancien `ACTES_PROPRIETE`; le wizard convertit seulement au moment de la confirmation, tandis que des documents importés Neon restent `ACTES_PROPRIETE` ;
- `RAPPORTS` existe comme catégorie Document et comme modèle Report ;
- aucune analyse antivirus/anti-malware et aucune validation serveur explicite du contenu réel par magic bytes observée ;
- suppression Cloudinary best-effort : une panne laisse un asset orphelin ;
- aucun job d'expiration/nettoyage des `UploadSession` ou drafts abandonnés ;
- aucune preuve e2e d'upload, preview ou téléchargement avec un vrai compte USER ;
- les erreurs lint se concentrent dans les viewers PDF/DOCX, donc leur stabilité UI reste à valider.

## 7. Terrain creation

### Flux vérifié

`Terrains -> bouton Nouveau terrain -> modal -> création TerrainDraft -> catégories multiples -> documents multiples -> AUTRE/custom -> analyse facultative ou skip -> vérification -> confirmation transactionnelle -> création Requisition/Documents/Versions/Events/Cases -> snapshot -> callback/refetch`.

Preuves principales : `frontend/src/features/requisitions/nouveau-terrain-wizard.tsx:637`, `:695`, `:746`; transaction backend `backend/src/modules/terrain-drafts/terrain-drafts.service.ts:473`.

### État

- Le flux n'est pas simulé : les appels API, le polling et la transaction existent.
- Le bouton de création rafraîchit la liste via le callback du portefeuille.
- Plusieurs catégories et fichiers sont supportés ; les noms custom sont normalisés et renommables.
- L'AI peut être ignorée et la saisie manuelle reste possible.

### Risques

- L'environnement AI audité force de fait le mode manuel.
- Les drafts restent en base si la modal/navigateur est abandonné sans `cancel`.
- Le nettoyage Cloudinary lors du cancel est best-effort et non transactionnel.
- La transaction DB ne peut pas englober Cloudinary ; une panne après upload mais avant confirmation laisse un draft/asset.
- Le code crée toujours un événement initial `GENERAL_UPDATE` daté de maintenant, ce qui peut masquer la vraie première situation dans la timeline.
- La création de cases/oppositions à partir de l'AI n'a pas de test d'intégration DB.

## 8. AI

### Phase 2A

| Capacité | Statut | Preuve / réserve |
|---|---|---|
| Provider abstraction | IMPLEMENTED | `DocumentAnalysisProvider` et provider GitHub Models |
| Configuration attendue | PARTIAL | Schéma env correct ; `.env` auditée a `AI_PROVIDER` vide et aucun token |
| Client GitHub Models | IMPLEMENTED | timeout, erreurs HTTP, mapping 429, JSON fenced |
| Zod | IMPLEMENTED | schémas facts et synthèse, `safeParse` |
| Retry | PARTIAL | un retry correctif sur JSON invalide ; pas de backoff automatique après 429 |
| Fingerprint/cache/reuse | IMPLEMENTED | fingerprint stable par documents + catégorie custom, statut stale |
| DOCX | IMPLEMENTED/UNTESTED | Mammoth, test seulement du chemin d'échec minimal |
| PDF texte | IMPLEMENTED/UNTESTED | pdfjs, aucun vrai PDF métier testé |
| PDF scanné | IMPLEMENTED/UNTESTED | rendu pages PNG via `pdf-to-img`, pas d'e2e |
| Images/multimodal | IMPLEMENTED/UNTESTED | data URLs envoyées au provider ; test avec faux bytes uniquement |
| Synthèse multi-documents | IMPLEMENTED/UNTESTED | extraction par doc puis synthèse, jamais exécutée dans Neon auditée |
| Conflits/sources/confiance | IMPLEMENTED | Zod et UI de choix ; sourceDocumentId/sourcePage/evidence |
| Tribunal/oppositions/bornage/dates | IMPLEMENTED/UNTESTED | structures et prompt présents ; pas de validation réelle provider |
| Préremplissage Step 2 | IMPLEMENTED/UNTESTED | mapping wizard réel |

Verdict Phase 2A : **PARTIAL**. Le code est avancé, mais aucune exécution réelle n'est prouvée, le provider est non configuré et le décalage de schéma peut faire échouer les accès `AIAnalysisRun`.

### Phase 2B

Le code couvre réellement : analyse d'un nouveau document d'un terrain existant, contexte officiel, déduplication, propositions, conflits, review ADMIN, confirm/reject, transaction de confirmation, création Event/CourtCase/Opposition, refresh snapshot et notifications affectées/admin.

Cependant :

- la migration Phase 2B n'est pas appliquée ; `AIAnalysisRun.contextType` manque réellement en base ;
- aucune exécution Phase 2B n'existe dans Neon ;
- `AI_PROVIDER` est vide ;
- seuls les helpers Zod/déduplication ont des tests ; la transaction de confirmation n'est pas testée ;
- la confirmation crée surtout `TerrainEvent`; elle ne crée pas systématiquement une ligne `Hearing`, alors que le calendrier global lit Hearings ;
- aucune stratégie de retry/backoff asynchrone ni queue persistante ; le service lance le traitement en fire-and-forget dans le processus API ;
- idempotence partielle : confirmation répétée est gérée et certains cas/audiences sont dédupliqués, mais pas toutes les propositions/oppositions.

Verdict Phase 2B : **BROKEN** dans l'environnement actuel, **PARTIAL** au niveau du code.

### Ancienne AI

`AIAnalysisJob`, `DocumentAnalysis`, `ExtractedFact`, `/analyses` et un écran global coexistent. `CourtStatusProvider` lève explicitement « non configuré » : Mahakim est une frontière vide, pas une intégration.

## 9. Court

- Plusieurs affaires par terrain : oui (`R 20612/31` en possède 2).
- Numéro, tribunal, phase, stage, résultat, prochaine date : modèles et CRUD présents.
- Audience, report, moudawala, jugement, appel : enum Hearing présent.
- Historique : Hearing et TerrainEvent, mais deux sources non unifiées.
- Timeline : événements terrain affichables.
- Calendrier : Hearing alimente l'écran global ; TerrainEvent alimente l'API calendrier plus correcte.
- Statut actuel : incohérent structurellement. `LegalCase.currentPhase`, `currentStage`, `currentStatus`, `Requisition.mainStatus`, snapshot, Hearing et TerrainEvent peuvent diverger.
- Neon : les cinq affaires ont `currentStage=A_CONFIRMER`; aucune `nextEventAt`; plusieurs hearings de juillet 2026 sont passés au jour de l'audit mais restent `SUIVI_REQUIS`/`A_CONFIRMER`.

## 10. Oppositions

- Modèle riche, CRUD backend et lecture USER affectée : présents.
- Modification ADMIN : présente côté API.
- Types/stratégie/risque/source document : présents.
- AI 2A/2B : extraction et création sur confirmation présentes.
- Neon : seulement deux oppositions détaillées, sans `sourceDocumentId`, alors que les compteurs agrégés indiquent 7, 10, 16, 22 ou 27 selon terrain.
- UI registre : affiche volontairement « opposant (démo) », « détail de démonstration » et sources génériques. Le registre ne peut pas être considéré final.

## 11. Calendar

### Backend correct

- `/calendar/events` filtre les terrains affectés, la période et les événements confirmés.
- `/calendar/upcoming` exige `scheduledAt >= now`, donc ne présente pas une date passée comme prochaine.
- les utilisateurs ne voient que leurs terrains ; ADMIN voit tout.

### Frontend problématique

- `/calendrier` appelle `useGetHearings`, pas les endpoints `calendar/events/upcoming` ; bornages et événements TerrainEvent sans Hearing peuvent manquer ;
- le mois et une liste existent ;
- un jour est surligné en dur (`2026-07-16`) ;
- la variable `upcoming`, correctement filtrée par date, est calculée puis jamais utilisée ;
- la section « Prochaines échéances » utilise `!status.includes("retard")` sans filtrer la date. Un hearing passé `SUIVI_REQUIS` peut y apparaître ;
- le bouton ADMIN « Nouvel événement » n'ouvre aucun formulaire et affiche seulement une information.

Verdict : **BROKEN** pour la promesse « jamais une date passée comme prochaine échéance ».

## 12. Notifications

### Fonctionnel

- modèle, liste par utilisateur, cloche topbar, unread count, read, read-all et liens terrain ;
- notifications ADMIN quand Phase 2B produit des propositions ;
- notifications USER affectés après confirmation d'une mise à jour AI.

### Partiel

- seulement quelques déclencheurs AI ; pas de déclencheurs génériques pour document upload, audience, échéance, affectation ou rapport ;
- doublons possibles si une analyse est relancée et recrée des propositions ;
- modèle `NotificationReminder` présent sans ordonnanceur/worker.

### Absent

- SMTP réel, bibliothèque d'envoi, templates, file d'attente, retries et suivi `emailSentAt`.

## 13. Reports

- `Report` et `ReportVersion` sont réellement utilisés par services/controllers.
- création manuelle, versions, soumission, validation/rejet, lecture USER affectée, preview/download sont implémentés.
- il n'existe pas d'état « publié » distinct ; USER voit les rapports qui passent le filtre du service, sans cycle de publication explicite.
- aucun générateur PDF ni AI report generation n'existe.
- le bouton frontend « rapport consolidé » est explicitement une démonstration.
- Neon : 0 rapport actif sur les six terrains au moment de l'audit ; les documents DOCX de rapport importés existent comme `Document`, pas comme `Report` actif.
- `Report.status` a pour défaut `VALIDE`, incohérent avec un workflow de création puis validation.

Verdict : **PARTIAL**.

## 14. Administration

- utilisateurs : endpoints créer/lire/modifier/activer/désactiver et rôles présents ;
- affectations : UI et API grant/revoke réelles ;
- permissions : garde backend réelle ;
- sécurité : pages admin masquées/redirigées côté frontend et protégées par permissions backend ;
- lacune : `UsersService.list()` ne renvoie que `isActive=true`, donc les comptes désactivés disparaissent de l'écran ;
- lacune : formulaire « Envoyer l'invitation » frontend n'appelle pas le backend ;
- rôles custom backend possibles mais l'UI cible seulement ADMIN/USER, et le seed retire les anciens rôles.

## 15. Security

### Bonnes pratiques présentes

- JWT access court, refresh cookie `httpOnly`, `secure` en production, `sameSite=lax`, rotation et détection de réutilisation ;
- mots de passe bcrypt coût 12 ;
- Helmet, CORS à origine unique, throttling global et login renforcé ;
- validation DTO globale avec whitelist + rejet des champs inconnus ;
- guards auth/permissions globaux ;
- accès terrain centralisé ;
- secrets uniquement backend et logs HTTP avec authorization/cookie redacted ;
- Cloudinary signé, lecture via URLs temporaires ; endpoints content avec `private, no-store`.

### Risques P1/P2

- access token dans `sessionStorage` : acceptable face à la persistance, mais exposé à une XSS ; CSP Helmet/default et revue XSS restent importantes ;
- logout est public et n'a pas de protection CSRF explicite ; l'impact principal est la déconnexion ;
- `SWAGGER_ENABLED` est ignoré : documentation potentiellement exposée en production ;
- mutations métier administratives ne vérifient pas toujours la portée terrain dans le service ;
- fichiers non inspectés par type réel/antivirus ;
- absence de tests IDOR systématiques ;
- URL Cloudinary signée limitée dans le temps, mais la protection exacte dépend du delivery type et de la configuration Cloudinary, non testée e2e ;
- avertissement driver PostgreSQL : anticiper le futur changement de sémantique SSL en fixant explicitement `sslmode=verify-full`.

## 16. API / OpenAPI / Orval

- Swagger et `/api/openapi.json` sont générés au démarrage.
- `operationId` est présent sur l'essentiel des routes et le client Orval généré est utilisé largement.
- Orval cible `http://localhost:3001/api/openapi.json` et produit React Query.
- `phase1.ts` et `reports.ts` maintiennent des appels manuels pour terrain drafts, accès, Phase 2B et URLs report ; ils contournent le typage généré et augmentent le risque de dérive DTO/client.
- les types générés incluent les DTO Phase 1/2B, mais le fichier manuel reste utilisé : génération et consommation ne sont pas totalement alignées.
- routes mortes/compat : `/analyses`, `/alerts`, `/agenda`, et plusieurs redirects frontend.
- `SWAGGER_ENABLED` n'est pas respecté.

## 17. Tests/build

### Tests recensés

| Type | Résultat | Couverture |
|---|---|---|
| Unitaires backend | 5 suites, 23 tests, tous passés | Auth, hashing refresh, config AI, fingerprint, Zod, preparer DOCX/image minimal, client 429/JSON, helpers dédup 2B |
| Intégration backend | Aucun confirmé | Aucun vrai PostgreSQL/Neon, Cloudinary ou GitHub Models |
| E2E backend | Config présente, aucun test e2e réel | `test:e2e` n'apporte pas de parcours applicatif |
| Frontend | Aucun | Aucun composant, hook ou page testé |
| Navigateur | Aucun | Aucun Playwright/Cypress |

### Commandes exécutées

| Commande | Résultat |
|---|---|
| Backend `npm run typecheck` | PASS |
| Backend `npm test` | PASS, 23/23 |
| Backend `npm run build` | PASS |
| Backend `npm run lint` | FAIL : exécutable `eslint` absent des dépendances backend |
| Frontend `npm run typecheck` | FAIL : `.next/dev/types/routes.d.ts` et `validator.ts` invalides |
| Frontend `npm run lint` | FAIL : 8 erreurs, 57 warnings |
| Frontend `npm run build` | FAIL après compilation, même type généré invalide (`'/blog/[slug]'>`) |
| Prisma `migrate status` | FAIL/statut non à jour : 1 migration non appliquée |

Le build frontend compile le code applicatif puis échoue sur un artefact `.next/dev` manifestement pollué par une route exemple `/blog/[slug]`. Aucun nettoyage n'a été effectué conformément à la consigne.

Fonctionnalités critiques sans test : permissions/IDOR, wizard complet, transaction de confirmation, upload/download/preview, calendars, reports, notifications, AI réelle 2A/2B, responsive et toutes les routes frontend.

## 18. Dead code / technical debt

- routes redirectées : `/actions`, `/analyses-ai`, `/contentieux`, `/documents`, `/agenda`, `/mes-dossiers` ;
- composants globaux `ActionsPage`, `AnalysesPage`, `ContentieuxPage`, `DocumentsPage` présents mais non reliés aux routes finales ;
- imports/hooks inutilisés nombreux dans `requisition-tabs.tsx` et `requisition-advanced-tabs.tsx` ;
- anciens concepts « dossier » dans composants/types/labels vs « terrain » dans l'UI finale ;
- deux stacks AI : legacy jobs/facts et Phase 2A/2B runs/extractions ;
- deux calendriers : Hearing et TerrainEvent ;
- deux statuts de terrain : champs dénormalisés Requisition et snapshot ;
- trois statuts de LegalCase ;
- deux catégories actes (`ACTES`, `ACTES_PROPRIETE`) ;
- rapports à la fois documents `RAPPORTS` et entités `Report` ;
- API Orval et fetchers manuels en parallèle ;
- dates de démonstration et date `2026-07-16` en dur dans le calendrier ;
- textes/actions simulés dans registres globaux, rapport, actions, contentieux et paramètres ;
- `SWAGGER_ENABLED` et configuration SMTP déclarés mais non consommés ;
- Mahakim fields/provider présents mais provider volontairement non configuré ;
- six TerrainDraft en base dont un seul contient encore un document : dette de nettoyage à traiter sans suppression aveugle.

## 19. Feature status matrix

Statuts autorisés : `DONE`, `PARTIAL`, `NOT_IMPLEMENTED`, `BROKEN`, `UNTESTED`.

| Fonctionnalité | Statut | Preuve / code concerné | Problème restant | Priorité |
|---|---|---|---|---|
| Auth | DONE | auth controller/service, guards globaux ; tests auth passés | Pas d'e2e navigateur | P2 |
| Roles | PARTIAL | Role/Permission/UserRole, seed ADMIN/USER | UI rôles limitée, rôles custom non testés | P2 |
| Terrains | DONE | requisitions module + portfolio ; 6 principaux Neon | Tests intégration absents | P2 |
| Nouveau terrain | UNTESTED | wizard + transaction `terrain-drafts.service.ts:473` | Aucun e2e ; drafts orphelins possibles | P1 |
| Documents | UNTESTED | documents module, Cloudinary, viewers | Aucun upload/preview réel testé ; lint viewers | P1 |
| Custom categories | PARTIAL | migrations 111800/111810, wizard et upload existant | Taxonomie ACTES dupliquée ; pas d'e2e | P2 |
| Assignments | DONE | `UserRequisitionAccess`, UI grant/revoke, filtres | Aucun test IDOR automatisé | P1 |
| Terrain overview | PARTIAL | overview réel et éditable | champs dénormalisés/snapshot peuvent diverger | P1 |
| Events/timeline | PARTIAL | TerrainEvent CRUD/timeline | divergence avec Hearing et audit incomplet | P1 |
| Current status snapshot | PARTIAL | refresh/ensure snapshot ; 7 snapshots Neon | stage String, dépend de plusieurs sources | P1 |
| Court tracking | PARTIAL | LegalCase/Hearing CRUD ; 5 cases Neon | statuts dupliqués, événements/calendrier non unifiés | P1 |
| Oppositions | PARTIAL | modèle/CRUD/AI | 2 détails pour compteurs beaucoup plus élevés ; UI démo | P1 |
| Calendar | BROKEN | backend upcoming correct ; frontend `AgendaPage` | dates passées possibles dans « prochaines », hardcode, mauvaise source | P0 |
| Notifications | PARTIAL | modèle, cloche, read, triggers AI | SMTP et triggers métier manquants | P1 |
| Reports | PARTIAL | modèle, versions, validation, download | 0 actif sur six terrains ; génération/publication absentes | P1 |
| AI Phase 2A | BROKEN | code provider/preparer/Zod/cache | provider vide + schéma DB/client incompatible ; aucun run | P1 |
| AI Phase 2B | BROKEN | services analyse/proposals/confirm | migration non appliquée ; aucun run/e2e | P1 |
| Dashboard ADMIN | PARTIAL | `/dashboard` réel | agenda ancien, calcul statut par labels, build frontend cassé | P1 |
| Dashboard USER | PARTIAL | dashboard filtré réel | rapports vides, pas d'e2e permissions | P1 |
| Audit log | PARTIAL | 32 logs Neon, endpoints | couverture inégale, historique terrain incomplet | P2 |
| Mobile/responsive | UNTESTED | classes responsive et shell mobile | aucune recette multi-viewport | P2 |
| Mahakim | NOT_IMPLEMENTED | provider lève « non configuré » | aucune API, sync, auth ou job | P3 |

## 20. Issues P0 / P1 / P2 / P3

### P0 - bloque un usage critique

1. **Calendrier mensonger sur les prochaines échéances** : le frontend peut afficher une date passée dans « Prochaines échéances » si son statut ne contient pas « retard ». Au 25 août 2026, plusieurs hearings de juillet sont encore `SUIVI_REQUIS`/`A_CONFIRMER`.
2. **Frontend non livrable en production** : `typecheck` et `build` échouent sur les types `.next/dev` invalides. La cause immédiate semble être un artefact généré pollué, mais le pipeline reste rouge.

### P1 - important avant validation finale

1. Aligner Neon et Prisma en évaluant puis appliquant la migration 2B via procédure contrôlée ; sauvegarde et vérification préalable, jamais de reset.
2. Rendre Phase 2A/2B cohérente avec l'environnement : provider/token, smoke test réel, confirmation transactionnelle et calendrier/notification.
3. Unifier la source calendrier entre TerrainEvent et Hearing, et définir la règle de statut passé/futur.
4. Ajouter des tests e2e auth/USER affecté/non affecté/documents/wizard.
5. Éliminer les actions simulées des parcours visibles ou les remplacer par fonctions réelles.
6. Raccorder complètement utilisateurs/invitations/réactivation.
7. Réconcilier compteurs d'oppositions et lignes détaillées/sources.
8. Finaliser le workflow rapports, publication USER et actifs réels.
9. Corriger les 8 erreurs lint frontend et rendre le lint backend exécutable.
10. Vérifier toutes les mutations métier avec `assertCanAccessRequisition`, indépendamment des rôles du seed.

### P2 - amélioration importante

1. Consolider les modèles AI legacy vs Phase 2A/2B.
2. Consolider ACTES/ACTES_PROPRIETE et Document RAPPORTS/Report.
3. Mettre en place cleanup drafts/upload sessions/assets orphelins.
4. Étendre AuditLog aux entités liées et afficher une timeline d'activité agrégée.
5. Respecter `SWAGGER_ENABLED` et durcir la configuration production/SSL.
6. Tester responsive, viewers, gros fichiers et erreurs réseau.
7. Dédupliquer routes/pages/composants historiques.

### P3 - polish/non bloquant

1. Mahakim, si l'accès officiel à une API est disponible et juridiquement autorisé.
2. SMTP/templates avancés après stabilisation des notifications in-app.
3. Nettoyage des imports, labels « dossier » historiques et textes de démonstration non visibles.

## 21. Recommended completion roadmap

### PHASE A - Corriger les blocages

Tâches exactes :

1. Reproduire le build frontend dans un environnement propre, retirer uniquement les artefacts `.next` générés, relancer typecheck/build et corriger toute erreur applicative restante.
2. Corriger le calendrier pour consommer `/calendar/events` et `/calendar/upcoming`, supprimer la date en dur et séparer strictement passé/futur par timestamp.
3. Auditer le SQL Phase 2B, sauvegarder Neon, appliquer la migration en environnement de validation, exécuter `prisma migrate status` et un smoke test de lecture `AIAnalysisRun`.
4. Ajouter `eslint` au backend selon la config existante et rendre les deux lints verts.

Dépendances : accès à Neon de validation et procédure de sauvegarde ; aucune dépendance AI pour les deux premiers points.

Critères de validation : builds/typechecks/lints verts ; aucune date passée dans upcoming ; 9/9 migrations appliquées ; lecture/écriture contrôlée `AIAnalysisRun` sans P2022.

### PHASE B - Terminer les fonctionnalités partielles

Tâches exactes :

1. Unifier Hearing/TerrainEvent et recalculer snapshot/LegalCase de façon déterministe.
2. Finaliser utilisateurs : création réelle, désactivés visibles, réactivation, validation des rôles.
3. Réconcilier oppositions agrégées et détaillées, rattacher les sources.
4. Finaliser rapports : création/version/validation/publication, rapports actifs pour les six terrains, download USER.
5. Étendre notifications aux uploads, audiences, affectations et rapports.
6. Ajouter contrôle de portée dans toutes les mutations métier.

Dépendances : Phase A et règles produit sur le statut officiel, la publication et les oppositions.

Critères : un seul statut courant explicable ; CRUD admin réel ; USER ne voit que données publiées et affectées ; aucune action simulée dans les parcours retenus.

### PHASE C - Fonctionnalités manquantes indispensables

Tâches exactes :

1. Configurer GitHub Models en environnement de validation, tester DOCX/PDF texte/PDF scanné/image réels.
2. Tester Phase 2A de bout en bout jusqu'au préremplissage et à la création.
3. Tester Phase 2B de bout en bout jusqu'à confirmation, event/case/opposition, snapshot, calendrier et notifications.
4. Implémenter un ordonnanceur de reminders ; ajouter email seulement si requis pour la V1.
5. Décider explicitement si Mahakim est hors V1 ou fournir les prérequis d'intégration.

Dépendances : migration Phase 2B, jeux de documents de test anonymisés et token GitHub Models.

Critères : traces de runs réels, sources/pages/confiance vérifiables, idempotence, erreurs 429 propres, aucune donnée officielle modifiée sans validation ADMIN.

### PHASE D - Polish UX

Tâches exactes :

1. Corriger lint React effects et états des viewers.
2. Supprimer/archiver les routes et composants morts après décision produit.
3. Uniformiser vocabulaire terrain, catégories et statuts.
4. Vérifier mobile/tablette/desktop, tableaux, modales et previews.

Dépendances : parcours stabilisés des phases B/C.

Critères : zéro texte/action de démonstration visible, responsive validé, navigation par rôle cohérente, aucune console error.

### PHASE E - QA global / recette

Tâches exactes :

1. Tests unitaires complémentaires, intégration PostgreSQL/Cloudinary et e2e navigateur.
2. Matrice ADMIN/USER/non affecté sur chaque endpoint et écran.
3. Recette des six terrains, documents, cas, oppositions, rapports et dates.
4. Test restauration/sauvegarde, observabilité, rate limits et erreurs externes.
5. Validation de sécurité, accessibilité et performance sans pentest agressif.

Dépendances : phases A à D terminées.

Critères : CI verte, recette signée, données attendues confirmées, aucun P0/P1 ouvert et procédure de déploiement/rollback documentée.

## 22. État des six terrains sur Neon

Lecture effectuée sans mutation le 25 août 2026.

| Référence | Principal | Documents actifs | Events | Cases | Hearings | Oppositions détaillées | Rapports actifs | Affectations USER | Observations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| R 20657/31 | Oui | 4 | 1 | 0 | 0 | 0 | 0 | 1 | compteur opposition 22, aucun détail |
| R 20629/31 | Oui | 4 | 1 | 1 | 0 | 0 | 0 | 1 | case 2025/1403/237, aucune prochaine date |
| R 20696/31 | Oui | 4 | 2 | 1 | 1 | 1 | 0 | 1 | compteur 27 ; moudawala du 08/07/2026 passée |
| R 20611/31 | Oui | 4 | 3 | 1 | 2 | 0 | 0 | 1 | deux hearings au même jour ; tous passés |
| R 20612/31 | Oui | 6 | 2 | 2 | 1 | 1 | 0 | 1 | deux cases liées à R 16605 ; compteur 16 |
| R 148026/31 | Oui | 6 | 1 | 0 | 0 | 0 | 0 | 1 | bornage bloqué, aucune prochaine date |
| R 16605/31 | Non | 0 actif | 0 | 0 | 0 | 0 | 0 | 0 | correctement lié ; identité minimale. Un document soft-deleted explique le compteur brut de 1. |

Identités et surfaces correspondent au seed actuel. Les six terrains ont un snapshot, mais toutes les `nextScheduledEventAt` étaient nulles lors de la lecture. Les documents actifs sont Cloudinary et partagés. Aucun rapport `Report` actif n'est rattaché aux six, même si un document de rapport DOCX est rattaché à R 148026/31.

## 23. Migrations

Ordre local :

1. `20260716180000_initial_schema`
2. `20260724140000_user_requisition_access`
3. `20260724170000_v1_refocus`
4. `20260724190000_cloudinary_document_metadata`
5. `20260811150000_phase1_foundation`
6. `20260811180000_document_custom_category_name`
7. `20260811181000_upload_session_custom_category`
8. `20260811190000_phase2a_ai_analysis_run`
9. `20260812140000_phase2b_terrain_update_analysis` **non appliquée sur Neon**

Les migrations ajoutent surtout tables/colonnes/index. Aucun reset n'a été lancé. `v1_refocus` supprime puis recrée quatre contraintes de clés étrangères avec de nouvelles règles de suppression ; Phase 2B rend `AIAnalysisRun.draftId` nullable (`DROP NOT NULL`) et ajoute les relations terrain/document/run. Aucune suppression de table ou de données n'a été trouvée, mais les changements de contraintes justifient une validation préalable. La migration Phase 1 est structurante ; les migrations custom category sont petites ; Phase 2A crée les runs ; Phase 2B élargit le contexte aux terrains existants. Le danger immédiat est l'incompatibilité client/base déjà observée. Avant application : sauvegarde, lecture du SQL, environnement de validation et smoke tests.

## Conclusion

Le meilleur prochain point de départ n'est pas une nouvelle fonctionnalité. Il faut d'abord rendre le socle livrable : **corriger le build frontend et le calendrier, puis aligner prudemment Neon avec la migration Phase 2B**. Ensuite seulement, valider les workflows documents/wizard/AI par de vrais tests de bout en bout.
