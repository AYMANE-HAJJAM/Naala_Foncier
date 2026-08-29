# Phase B — Functional completion

Date de clôture technique : 25 août 2026.

## 1. Suivi judiciaire

- `LegalCase` reste la source de l'affaire ; plusieurs affaires par terrain sont supportées.
- `TerrainEvent` confirmé est la source de l'historique et des échéances.
- `Hearing` reste une compatibilité : une audience créée y produit un événement miroir, mais l'UI terrain lit `TerrainEvent`.
- `currentStage` est le statut structuré affiché par l'UI. `currentPhase` reste un libellé métier historique ; `currentStatus` est un complément libre facultatif.
- L'ADMIN peut créer une affaire, ajouter transmission, audience, audience tenue, délibération, décision, appel, clôture ou autre événement judiciaire, et reporter une audience.
- Le report désactive uniquement l'ancienne échéance future et crée un nouvel événement. L'historique n'est pas supprimé.
- Le USER dispose d'une vue en lecture seule et uniquement sur ses terrains affectés.

## 2. Snapshot et événements

- `StatusSnapshotService.refreshFromEvents` est la fonction centrale de projection.
- Le dernier événement est un événement confirmé dont `occurredAt` n'est pas futur.
- La prochaine échéance est l'événement confirmé, planifié, actif et strictement futur le plus proche.
- La projection judiciaire synthétise toutes les affaires actives du terrain.
- La création depuis le wizard recalcule le snapshot dans la transaction Prisma.
- Les snapshots des six terrains principaux et de `R 16605/31` ont été recalculés le 25 août 2026.

## 3. Oppositions

- Règle : `oppositionCount` est le nombre officiel connu ; les lignes `Opposition` sont uniquement les détails disponibles.
- L'UI affiche séparément le nombre connu et le nombre détaillé.
- Les champs inconnus restent nuls ; aucun opposant, statut, risque, stratégie ou document n'est fabriqué.
- `sourceDocumentId` est facultatif et sélectionnable par l'ADMIN.
- L'ADMIN dispose d'un CRUD réel avec suppression logique ; le USER est en lecture seule.
- Le libellé de démonstration trouvé sur `R 20696/31` a été remplacé par une identité vide avec statut `A_CONFIRMER`.

## 4. Rapports

- Cycle : `BROUILLON -> A_VALIDER -> VALIDE -> PUBLIE`, avec `REJETE` comme retour éditable.
- Un rapport neuf est toujours `BROUILLON`.
- Un rapport doit avoir une version ou un document avant soumission.
- L'ADMIN peut créer, ajouter une version manuelle, soumettre, valider, rejeter et publier.
- La publication est transactionnelle et idempotente, avec auteur, date, audit et notifications.
- Le USER ne peut lister, ouvrir, prévisualiser ou télécharger que les rapports `PUBLIE` de ses terrains affectés.
- Un `Document` de catégorie `RAPPORTS` n'est jamais converti automatiquement en `Report`.

## 5. Notifications

- `Notification.dedupeKey` fournit l'idempotence logique.
- Triggers couverts : proposition AI à revoir, affectation terrain, audience/échéance, report, décision/date bornage, document important et rapport publié.
- Les créations utilisent `skipDuplicates` avec une clé type + destinataire + entité.
- Aucun SMTP n'est requis pour cette phase.

## 6. Utilisateurs et affectations

- Liste actifs/désactivés, activation, désactivation, création réelle et changement ADMIN/USER sont raccordés.
- La création utilise un mot de passe temporaire saisi par l'ADMIN ; aucun faux envoi d'invitation n'est affiché.
- Affectation et retrait sont réels. Une affectation répétée retourne l'affectation existante sans audit ni notification en double.
- Le filtrage des terrains et les contrôles 403 reposent sur `AccessScopeService` et les permissions backend.

## 7. Wizard et nettoyage

- Le flux existant conserve catégories multiples, fichiers multiples, catégorie personnalisée renommable, suppression, retour d'étape, skip AI, revue et confirmation.
- La confirmation du draft est idempotente et la création terrain/documents/événements/snapshot est transactionnelle.
- Le mapping `ACTES_PROPRIETE -> ACTES` est appliqué à l'entrée et l'UI affiche « Actes » ; les anciennes lignes restent lisibles.
- `maintenance:cleanup:expired` fonctionne en dry-run par défaut et exige `--execute` pour supprimer.
- Seuls les drafts non confirmés anciens et les UploadSession `CREATED/UPLOADED` expirées sont ciblés. Les assets Cloudinary sont supprimés en best effort avec logs.
- Dry-run du 25 août : 5 drafts de plus de 7 jours, 0 UploadSession expirée ; aucune suppression exécutée.

## 8. Data checks

- Script reproductible : `npm run maintenance:audit:phase-b-data`.
- Sept références trouvées sur sept ; aucune prochaine date passée dans les snapshots.
- `R 16605/31` est non principal et relié à `R 20612/31`.
- Aucun rattachement de document, d'affaire ou d'opposition n'a été inventé.
- Détails dans `docs/PHASE_B_DATA_QUALITY.md`.

## 9. Préparation AI 2A / 2B

- Architecture active : `AIAnalysisRun + AIExtraction` pour wizard et mise à jour d'un terrain existant.
- Configuration locale contrôlée : `AI_PROVIDER` absent et `GITHUB_MODELS_TOKEN` absent.
- Le provider non configuré renvoie `AI_PROVIDER_NOT_CONFIGURED` sans crash ; le fallback manuel reste disponible.
- Les tests couvrent préparation document, provider non configuré, création de run, stockage des propositions, confirmation/rejet et transaction de confirmation.
- Aucun appel GitHub Models payant n'a été déclenché.

## 10. Legacy AI

- `AIAnalysisJob`, `DocumentAnalysis` et `ExtractedFact` sont legacy.
- Leurs contrôleurs `/ai-analysis`, `/analyses` et l'ancienne UI ne sont plus exposés.
- Les tables et fichiers de compatibilité sont conservés pour une migration/retrait ultérieur sans perte d'historique.

## 11. Audit et historique

- Sont audités : terrain, document, affectation, affaire/événement judiciaire, opposition, rapport et propositions AI.
- L'historique terrain agrège les entités liées par identifiants et par `metadata.requisitionId`.
- Le USER reçoit une projection sans metadata technique ; l'ADMIN conserve les détails audit.

## 12. Tests et gates

- Backend : typecheck, lint, 9 suites / 30 tests et build verts.
- Frontend : typecheck, lint et build verts.
- Responsive Playwright : PASS sur 390x844, 768x1024 et 1366x768 pour écrans globaux, administration, terrain et cinq onglets métier.
- Prisma : 12 migrations appliquées et schéma aligné.

## Points restant à traiter

- Le scénario wizard avec upload puis confirmation n'a pas été exécuté contre la base partagée : il créerait une donnée métier artificielle. Le chemin backend est couvert et le contrôle UI non destructif est documenté.
- Les scénarios E2E de mutation ADMIN/USER nécessitent une base de test isolée avant création/suppression de fixtures.
- Les 5 drafts expirables restent présents après le dry-run ; une décision ADMIN est requise avant `--execute`.
- Les liens source de deux oppositions détaillées restent absents et doivent être validés humainement.
- L'infrastructure de tests composants frontend reste légère ; la couverture actuelle repose sur typecheck/build et smoke Playwright.

