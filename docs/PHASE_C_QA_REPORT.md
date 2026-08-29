# Phase C - Rapport de recette

Date: 2026-08-26

## 1. Environnement

- Base principale: `neondb/public`, utilisée uniquement pour les lectures métier et les migrations idempotentes.
- Base de recette: `naala_phase_c_qa/public`, base PostgreSQL distincte.
- Garde runtime: le backend QA refuse de démarrer si `current_database()` ou `current_schema()` ne correspond pas à la cible attendue.
- Ports QA: frontend `3100`, backend `3101`.
- Cloudinary: namespace dédié `naala-foncier/qa-phase-c`.
- Secrets QA: `.phase-c-qa.env`, ignoré par le dépôt et jamais affiché par les tests.

## 2. Données de test

- Comptes dédiés: `ADMIN_QA`, `USER_ASSIGNED_QA`, `USER_UNASSIGNED_QA`.
- Terrain initial: `TEST-QA-001`.
- Terrains wizard: références uniques `TEST-QA-WIZ-*`.
- Fixtures supprimées après recette; comptes et base QA conservés pour une prochaine exécution.

## 3. Scénarios testés

- Authentification ADMIN/USER, refresh, logout et invalidation du refresh.
- USER affecté/non affecté, IDOR terrain/documents/events/affaires/oppositions/rapports.
- Mutations ADMIN et refus des mutations USER.
- Deux affaires sur un terrain, audience future, report, historique et prochaine date.
- Calendrier affecté, exclusion de l’ancienne audience reportée.
- Oppositions totale/partielle et distinction des lignes détaillées.
- Rapport brouillon, version, validation, publication idempotente et visibilité USER.
- Notification de publication et déduplication.
- Affectation idempotente et révocation immédiate.
- Wizard réel: PDF/PNG/DOCX, catégories multiples, custom category, renommage, suppression, réajout, skip AI, confirmation idempotente, documents, snapshot et audit.
- Cloudinary réel: upload, URL preview, URL download et lecture HTTP signée; refus USER non affecté.
- UI: dashboard, terrains, calendrier, rapports, notifications, administration, wizard et onglets terrain.
- Responsive: `390x844`, `768x1024`, `1024x768`, `1366x768`, `1920x1080`, sans overflow global sur les routes testées.
- Accessibilité de base: labels de login, rôles dialog, focus/escape du wizard et boutons nommés.

## 4. Résultats

- Playwright complet: **3 tests passés, 0 échoué**, 4 min 06 s.
- Retest wizard enrichi AI/Cloudinary: **1 passé, 0 échoué**, 1 min 06 s.
- Backend Jest: **9 suites, 30 tests passés**.
- Contrôles DB QA et principale: zéro orphelin, doublon d’affectation, doublon de notification, doublon exact d’événement, snapshot passé ou rapport publié sans contenu.

## 5. Bugs trouvés et corrigés

- Historique de migrations non rejouable (`isPrincipal` absent): migration préalable ajoutée.
- Drift entre migrations et schéma Prisma: migration d’alignement additive de 16 champs et de la preview rapport.
- Isolation par `search_path` insuffisante avec PrismaPg: remplacée par une base QA distincte et un garde runtime.
- Fixtures QA créées dans `neondb` lors du diagnostic initial: supprimées transactionnellement; audit post-nettoyage conforme.
- Le seed pouvait recréer une identité d’opposition de démonstration: remplacée par une identité absente et `A_CONFIRMER`.
- Exceptions backend non HTTP non journalisées: log serveur ajouté, réponse frontend inchangée et non technique.

## 6. Bugs ouverts

- R20611: deux hearings au même horaire, mais types/rattachements différents; décision métier requise avant suppression.
- Deux oppositions métier sans `sourceDocumentId`; aucune source ne doit être inventée.
- Cinq anciens drafts attendent une décision ADMIN; aucune suppression automatique.
- Ancien schéma technique `naala_phase_c_qa` dans `neondb` à retirer ultérieurement après approbation explicite. Il n’est plus utilisé.
- Avertissement `pg` sur une concurrence de requêtes à surveiller avant passage à pg 9; aucun échec fonctionnel final.

## 7. Sécurité

- USER affecté: lecture terrain/documents/rapports publiés et URLs signées autorisée.
- USER non affecté: `403` sur terrain, documents, événements, affaires, oppositions, rapports et preview.
- USER: refus `403` sur affaires, oppositions, rapports, événements, analyse/review AI et affectations.
- ADMIN: mutations critiques autorisées et auditées.
- Aucun secret n’apparaît dans les rapports ou sorties de test conservées.

## 8. AI

- Aucun `GITHUB_MODELS_TOKEN`; aucun appel GitHub Models payant n’a été lancé.
- Phase 2A: `AI_PROVIDER_NOT_CONFIGURED` stocké sans crash, puis fallback manuel/skip AI validé E2E.
- Phase 2B: retry USER refusé, retry ADMIN stocké en `FAILED` avec `AI_PROVIDER_NOT_CONFIGURED`, message USER propre validé E2E.
- Confirm/reject/conflits/NO_CHANGE: couverts par les tests backend à fixtures et le smoke schéma Phase 2B.
- Statut: `READY_BUT_PROVIDER_NOT_CONFIGURED`.

## 9. Responsive et UX

- Cinq viewports testés sur les principales routes de travail.
- Wizard ouvert/fermé au clavier; aucune donnée de démonstration injectée pour remplir les états vides.
- Messages d’erreur API restent humains; détails techniques uniquement dans les logs backend.

## 10. Cohérence DB

- Base principale après recette: exactement six terrains principaux plus R16605 non principal.
- `R 16605/31.isPrincipal = false`.
- Zéro fixture `TEST-QA-*` et zéro compte `@naala.test` dans `neondb` après nettoyage.
- 14 migrations appliquées et statut Prisma à jour.

## 11. Recommandation

**RELEASE_CANDIDATE**. Aucun P0 ou P1 n’est ouvert. Les points restants relèvent d’une validation humaine des données et d’un nettoyage technique non bloquant.
