# Phase A - Stabilisation

Date d'exécution : 25 août 2026.

## Migration Phase 2B

- Migration contrôlée : `20260812140000_phase2b_terrain_update_analysis`.
- Le SQL est additif : enum/contexte d'analyse, statut `NO_CHANGE`, colonnes Phase 2B, index et clés étrangères. Aucune suppression de table ou de données.
- `pg_dump`/`pg_restore` ne sont pas disponibles sur la machine et aucune API de sauvegarde Neon n'est configurée. Une sauvegarde vérifiable n'a donc pas pu être créée depuis cet environnement.
- Mesure compensatoire exécutée avant déploiement : application complète du SQL dans une transaction Neon, validation du schéma, puis `ROLLBACK`.
- Déploiement exécuté avec `prisma migrate deploy`.
- `prisma migrate status` confirme 9 migrations et un schéma à jour.
- Smoke Prisma en lecture seule ajouté : `npm run maintenance:smoke:phase2b-schema`. Il lit `AIAnalysisRun.contextType` et passe sans `P2022`.

## Calendrier et événements

- La page globale `/calendrier` et l'onglet Calendrier d'un terrain utilisent désormais `TerrainEvent` via `/calendar/events` et `/calendar/upcoming`.
- Les prochaines échéances sont uniquement les événements `CONFIRMED`, planifiés et dont `scheduledAt >= now`.
- La date du jour n'est plus codée en dur.
- Les événements passés restent dans l'historique récent et ne remontent plus comme prochaines échéances.
- Le formulaire administrateur "Nouvel événement" crée un vrai `TerrainEvent` confirmé et invalide les requêtes calendrier.
- Les audiences créées sont reflétées dans `TerrainEvent`. Lors d'un report, l'ancienne échéance est conservée comme historique mais retirée des échéances actives, puis une nouvelle échéance est créée.
- Le dashboard lit également les prochains `TerrainEvent` confirmés et futurs.

## Statut terrain

- `RequisitionStatusSnapshot` est prioritaire pour le libellé courant, la date du dernier événement et la prochaine date.
- Les anciennes colonnes `Requisition` restent un fallback de compatibilité; aucune migration destructive de leur contenu n'a été faite.
- Le snapshot ignore explicitement les dates planifiées passées pour `nextScheduledEventAt`.

## Sécurité

- Les mutations Actions, Oppositions, Contentieux, Audiences et Rapports vérifient maintenant l'accès au terrain avant écriture.
- Un changement de `requisitionId` vérifie l'ancien et le nouveau périmètre.
- Les commentaires d'action et suppressions appliquent le même contrôle.
- Swagger et `/api/openapi.json` ne sont exposés que si `SWAGGER_ENABLED=true`; la valeur d'exemple est `false`.
- Le démarrage réel Nest a permis de corriger l'import manquant de `EventsModule` dans `AIAnalysisModule`.

## Frontend

- Les 8 erreurs et 59 avertissements ESLint initiaux ont été corrigés; le lint finit sans erreur ni avertissement.
- Les faux boutons de l'onglet judiciaire et l'invitation utilisateur simulée ont été retirés.
- La page Utilisateurs liste les comptes actifs et désactivés, affiche `Actif`/`Désactivé` et permet une activation/désactivation réelle.
- Les onglets du détail terrain sont dérivés de l'URL sans synchronisation d'état en cascade.
- Les visionneuses PDF, image et DOCX sont réinitialisées par document sans `setState` synchrone dans les effets.
- `.next` a été supprimé avant le build de production.

## Qualité et tests

- Dépendances lint backend ajoutées : ESLint 9, `@eslint/js`, `typescript-eslint`.
- Le client Prisma généré est exclu du lint; le code source et les tests maintenus restent analysés.
- Le runner Jest utilise le mode ESM nécessaire à Prisma 7.
- Tests ajoutés : accès USER non assigné (403), calendrier USER filtré/ADMIN global, filtre futur, snapshot sans date passée.
- Suite backend : 8 suites, 27 tests réussis.
- Typecheck frontend et backend : réussis.
- Lint frontend et backend : réussis.
- Build Next.js et build NestJS : réussis.
- Smoke responsive Edge : réussi à `390x844`, `768x1024` et `1366x768` sur dashboard, liste des terrains, calendrier, utilisateurs et détail terrain. Captures dans `frontend/artifacts/responsive-smoke/`.

## Points encore ouverts

- Configurer et tester une sauvegarde Neon vérifiable avant toute prochaine migration de production.
- Traiter séparément les vulnérabilités npm signalées (`12` backend, `8` frontend) après analyse de compatibilité; aucun `audit fix --force` n'a été exécuté.
- Expliciter `sslmode=verify-full` dans la chaîne PostgreSQL avant la prochaine version majeure de `pg` afin de conserver la vérification TLS actuelle.
- Les colonnes historiques de statut restent présentes comme fallback jusqu'à une future migration de données dédiée.
- Les connecteurs IA de production, les quotas IA et Mahakim restent volontairement hors périmètre de cette phase.
