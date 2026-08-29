# Checklist de finalisation NAALA FONCIER

Cette checklist découle de l'audit du code et de Neon réalisé le 25 août 2026. Ne pas lancer une phase tant que ses prérequis ne sont pas validés. Ne jamais reset la base.

## Phase A - Corriger les blocages

### Build et qualité

- [ ] Reproduire le frontend depuis un workspace propre.
- [ ] Supprimer uniquement les artefacts générés `.next`, jamais le code source.
- [ ] Relancer `npm run typecheck` frontend.
- [ ] Relancer `npm run build` frontend.
- [ ] Corriger les 8 erreurs lint React frontend.
- [ ] Traiter ou accepter explicitement les 57 warnings frontend.
- [ ] Ajouter/rétablir la dépendance ESLint backend compatible avec `eslint.config.mjs`.
- [ ] Obtenir un lint backend vert.
- [ ] Conserver typecheck, tests et build backend verts.

### Calendrier P0

- [ ] Remplacer `useGetHearings` par l'API calendrier unifiée ou définir un agrégateur unique.
- [ ] Utiliser `/calendar/events` pour la vue mensuelle.
- [ ] Utiliser `/calendar/upcoming` pour « Prochaines échéances ».
- [ ] Supprimer le surlignage en dur `2026-07-16`.
- [ ] Filtrer upcoming par timestamp `>= now`, indépendamment du texte de statut.
- [ ] Classer séparément les dates passées à mettre à jour.
- [ ] Inclure audiences, moudawala, bornage, relances et deadlines.
- [ ] Vérifier ADMIN = tous terrains.
- [ ] Vérifier USER = terrains affectés uniquement.
- [ ] Ajouter un test garantissant qu'une date passée n'est jamais « prochaine ».

### Prisma / Neon

- [ ] Relire le SQL `20260812140000_phase2b_terrain_update_analysis`.
- [ ] Créer une sauvegarde/restauration vérifiable de Neon.
- [ ] Tester la migration sur une base de validation.
- [ ] Appliquer avec `prisma migrate deploy`, jamais avec reset.
- [ ] Vérifier 9/9 migrations appliquées.
- [ ] Vérifier que `AIAnalysisRun.contextType` existe.
- [ ] Exécuter une lecture Prisma `AIAnalysisRun` sans erreur P2022.
- [ ] Vérifier les index et contraintes Phase 2B.
- [ ] Documenter le rollback opérationnel.

## Phase B - Terminer les fonctionnalités partielles

### Auth, rôles et sécurité

- [ ] Tester login, refresh rotation, logout et utilisateur désactivé en intégration.
- [ ] Tester chaque permission ADMIN/USER.
- [ ] Ajouter tests IDOR avec terrain non affecté.
- [ ] Ajouter `assertCanAccessRequisition` à chaque mutation liée à un terrain.
- [ ] Vérifier upload USER sur terrain affecté.
- [ ] Refuser upload USER sur terrain non affecté.
- [ ] Vérifier document `INTERNE` invisible au USER.
- [ ] Faire respecter `SWAGGER_ENABLED` en production.
- [ ] Fixer explicitement le mode SSL PostgreSQL attendu.

### Utilisateurs et affectations

- [ ] Raccorder réellement le formulaire de création/invitation utilisateur.
- [ ] Afficher les utilisateurs actifs et désactivés.
- [ ] Permettre la réactivation d'un utilisateur désactivé.
- [ ] Valider le changement ADMIN/USER.
- [ ] Tester grant/revoke d'affectation.
- [ ] Rafraîchir toutes les listes après affectation.
- [ ] Auditer chaque changement d'utilisateur/affectation.

### Terrains et statut courant

- [ ] Choisir la source officielle du statut courant.
- [ ] Définir la relation Requisition fields / Snapshot / TerrainEvent.
- [ ] Recalculer les snapshots de façon déterministe.
- [ ] Empêcher une date passée dans `nextScheduledEventAt`.
- [ ] Réconcilier `importantDate` et `nextScheduledEventAt`.
- [ ] Tester les six terrains et R 16605 non principal.
- [ ] Vérifier que R 16605 ne devient jamais un septième terrain principal.

### Suivi judiciaire

- [ ] Définir la source unique des événements judiciaires.
- [ ] Synchroniser ou fusionner Hearing et TerrainEvent.
- [ ] Définir `currentPhase`, `currentStage` et `currentStatus`.
- [ ] Recalculer LegalCase depuis les événements confirmés si retenu.
- [ ] Gérer audience, report, moudawala, décision et appel.
- [ ] Clôturer/actualiser les hearings passés de juillet 2026.
- [ ] Vérifier plusieurs affaires sur R 20612/31.
- [ ] Vérifier les liens des cases 249/250 vers R 16605/31.

### Oppositions

- [ ] Décider si `oppositionCount` est dérivé ou manuel.
- [ ] Réconcilier les compteurs avec les lignes détaillées.
- [ ] Créer/importer les détails réels sans inventer d'identité.
- [ ] Rattacher les documents sources.
- [ ] Retirer les libellés et valeurs génériques de démonstration.
- [ ] Tester CRUD ADMIN et lecture USER.
- [ ] Tester création depuis proposition AI confirmée.

### Documents

- [ ] Tester upload Cloudinary ADMIN de bout en bout.
- [ ] Tester upload Cloudinary USER de bout en bout.
- [ ] Tester PDF texte, PDF scanné, image et DOCX.
- [ ] Tester preview et download avec URL expirée.
- [ ] Tester suppression DB + Cloudinary et reprise sur erreur.
- [ ] Valider le type réel du fichier côté serveur.
- [ ] Décider d'un contrôle antivirus/anti-malware.
- [ ] Consolider `ACTES` et `ACTES_PROPRIETE`.
- [ ] Consolider Document `RAPPORTS` et modèle `Report`.
- [ ] Ajouter un job d'expiration des UploadSession.
- [ ] Ajouter un job contrôlé de nettoyage des assets orphelins.

### Wizard nouveau terrain

- [ ] Tester ouverture modal et création du draft.
- [ ] Tester plusieurs catégories.
- [ ] Tester plusieurs documents par catégorie.
- [ ] Tester plusieurs catégories AUTRE distinctes.
- [ ] Tester renommage custom avec documents existants.
- [ ] Tester suppression d'un document draft.
- [ ] Tester retour Step 2 vers Step 1.
- [ ] Tester skip AI.
- [ ] Tester confirmation transactionnelle.
- [ ] Vérifier rattachement documents/versions/events/cases.
- [ ] Vérifier refresh de la liste et ouverture du nouveau terrain.
- [ ] Vérifier idempotence d'un double clic de confirmation.
- [ ] Définir expiration/reprise des drafts abandonnés.
- [ ] Examiner les 6 drafts actuellement présents avant tout nettoyage.

### Notifications

- [ ] Conserver liste/read/read-all filtrés par utilisateur.
- [ ] Notifier upload de document pertinent.
- [ ] Notifier création/report d'audience.
- [ ] Notifier nouvelle affectation.
- [ ] Notifier publication d'un rapport.
- [ ] Ajouter déduplication des notifications.
- [ ] Implémenter le scheduler NotificationReminder si requis.
- [ ] Définir si SMTP est obligatoire pour la V1.
- [ ] Si oui, implémenter transport, templates, retries et suivi email.

### Rapports

- [ ] Changer le statut par défaut de création vers BROUILLON si confirmé.
- [ ] Tester création manuelle.
- [ ] Tester versions.
- [ ] Tester soumission, validation et rejet.
- [ ] Définir un état/règle de publication USER.
- [ ] Rendre les rapports publiés visibles aux USER affectés.
- [ ] Tester preview/download DOCX et PDF.
- [ ] Créer/réparer les rapports actifs attendus des six terrains.
- [ ] Remplacer le bouton de génération simulée.
- [ ] Décider si génération PDF et AI sont dans la V1.

## Phase C - AI indispensable

### Configuration et provider

- [ ] Définir `AI_PROVIDER=github-models`.
- [ ] Définir `AI_MODEL=openai/gpt-4.1`.
- [ ] Fournir `GITHUB_MODELS_TOKEN` via secret manager.
- [ ] Vérifier `GITHUB_MODELS_BASE_URL`.
- [ ] Ne jamais exposer le token au frontend/logs.
- [ ] Ajouter smoke test provider sans donnée sensible.
- [ ] Ajouter backoff/retry borné pour 429/5xx.

### Phase 2A

- [ ] Tester DOCX métier réel.
- [ ] Tester PDF texte réel.
- [ ] Tester PDF scanné réel.
- [ ] Tester image réelle.
- [ ] Vérifier `sourceDocumentId`, `sourcePage`, evidence et confidence.
- [ ] Vérifier synthèse cross-document.
- [ ] Vérifier conflits de surface/identité.
- [ ] Vérifier tribunal, oppositions, bornage et dates.
- [ ] Vérifier `pointsToClarify` maximum 5.
- [ ] Vérifier fingerprint, reuse et stale.
- [ ] Vérifier préremplissage Step 2 sans auto-confirmation.
- [ ] Tester le parcours complet jusqu'à création terrain.

### Phase 2B

- [ ] Tester analyse d'un nouveau document terrain existant.
- [ ] Vérifier comparaison avec contexte officiel.
- [ ] Vérifier NO_CHANGE.
- [ ] Vérifier déduplication case et hearing.
- [ ] Vérifier proposition de conflit identité.
- [ ] Vérifier confirm/reject ADMIN.
- [ ] Vérifier `KEEP_CURRENT`, `USE_PROPOSED`, `MANUAL_VALUE`.
- [ ] Tester transaction rollback sur erreur.
- [ ] Tester double confirmation idempotente.
- [ ] Vérifier création Event/CourtCase/Opposition.
- [ ] Vérifier mise à jour snapshot.
- [ ] Vérifier apparition correcte au calendrier unifié.
- [ ] Vérifier notification ADMIN puis USER.
- [ ] Ajouter une queue/job persistante ou justifier le fire-and-forget.

### Legacy AI / Mahakim

- [ ] Décider du sort de `AIAnalysisJob`/`DocumentAnalysis`/`ExtractedFact`.
- [ ] Migrer ou archiver les endpoints compat `/analyses`.
- [ ] Garder Mahakim hors scope tant qu'aucune API autorisée n'est disponible.
- [ ] Ne jamais scraper ou automatiser Mahakim sans validation juridique/technique.

## Phase D - Polish UX

- [ ] Retirer toutes les actions « simulée »/« démonstration » visibles.
- [ ] Supprimer ou archiver les routes redirigées après validation produit.
- [ ] Unifier « dossier », « réquisition » et « terrain ».
- [ ] Nettoyer imports/hooks/composants inutilisés.
- [ ] Valider sidebar et cloche sur mobile.
- [ ] Valider tableaux avec scroll sur 320/375/768 px.
- [ ] Valider wizard sur mobile/tablette/desktop.
- [ ] Valider preview PDF/image/DOCX sur les trois formats d'écran.
- [ ] Vérifier focus, clavier, labels et contrastes.
- [ ] Vérifier états loading/empty/error sur chaque page.
- [ ] Vérifier qu'aucun texte ne déborde ou ne se superpose.

## Phase E - QA global / recette

### Automatisation

- [ ] Tests unitaires des règles dates/statuts.
- [ ] Tests intégration Prisma sur base dédiée.
- [ ] Tests intégration Cloudinary dédié.
- [ ] Tests contract OpenAPI/Orval.
- [ ] Tests e2e ADMIN.
- [ ] Tests e2e USER affecté.
- [ ] Tests e2e USER non affecté/403.
- [ ] Tests e2e wizard avec et sans AI.
- [ ] Tests e2e Phase 2B.
- [ ] Tests responsive Playwright.

### Recette des données

- [ ] R 20657/31 vérifié.
- [ ] R 20629/31 vérifié.
- [ ] R 20696/31 vérifié.
- [ ] R 20611/31 vérifié.
- [ ] R 20612/31 vérifié.
- [ ] R 148026/31 vérifié.
- [ ] R 16605/31 non principal et lié à R 20612/31.
- [ ] Documents actifs et catégories vérifiés.
- [ ] Affaires judiciaires et dates vérifiées.
- [ ] Oppositions détaillées réconciliées.
- [ ] Rapports publiés vérifiés.
- [ ] Affectations USER vérifiées.

### Gate de livraison

- [ ] 9/9 migrations appliquées.
- [ ] Backend typecheck/test/lint/build verts.
- [ ] Frontend typecheck/lint/build verts.
- [ ] Aucun P0 ouvert.
- [ ] Aucun P1 ouvert.
- [ ] Aucun faux bouton ou donnée fictive non signalée.
- [ ] Aucun accès à un terrain non affecté.
- [ ] Aucune date passée présentée comme prochaine.
- [ ] Sauvegarde et rollback testés.
- [ ] Secrets gérés hors repository.
- [ ] Logs/monitoring/alerting configurés.
- [ ] Recette métier signée avant production.
