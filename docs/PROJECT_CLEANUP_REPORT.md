# Rapport de nettoyage global

Date : 2026-08-29

## Résultat

- **6 fichiers supprimés** : 3 fichiers backend IA legacy, 1 doublon de script et 2 anciens fichiers d'onglets frontend.
- **0 dossier source supprimé**.
- **4 dépendances directes supprimées** : 3 frontend et 1 backend; npm a retiré 45 paquets transitifs devenus inutiles.
- Un fichier frontend monolithique de prototypes a été réduit à son seul écran actif, Utilisateurs.
- L'onglet Historique actif a été isolé dans `history-tab.tsx`; aucun comportement métier n'a été retiré.

## Code legacy supprimé

- Ancienne pile HTTP/UI `AIAnalysisJob` : écrans, service et contrôleurs non enregistrés.
- Prototypes globaux Actions, Rapports et Paramètres sans route active.
- Onglets terrain Actions/Rapport stratégique/ancienne analyse IA jamais importés.
- Provider futur Mahakim sans consommateur.
- Méthode, variable, propriétés et type TypeScript sans usage.
- Gros blocs de code commenté correspondant à l'ancienne UI IA.

## Duplication supprimée

- Variante JavaScript plus ancienne de `apply-presentation-summaries`; la version TypeScript est conservée.
- Packages UI/graphiques installés mais jamais importés.
- Anciennes surfaces IA frontend/backend concurrentes de `AIAnalysisRun` / `AIExtraction`.

## Conservé volontairement

- Migrations, seed, imports, backfills, scripts QA/réparation et documents historiques.
- Routes de redirection pour compatibilité des favoris et liens externes.
- Module `Hearing`, toujours utilisé par le judiciaire et les rappels.
- Wrappers `phase1.ts` / `phase-b.ts`, qui reposent sur le core HTTP unique.
- Catégories `ACTES`, `ACTES_PROPRIETE`, `RAPPORTS` et compatibilités de données.
- Dépendances runtime/peer Nest et Pino dont l'usage est indirect.

## Legacy DB restant

- `AIAnalysisJob`, `AIAnalysisDocument`, `DocumentAnalysis`, `ExtractedFact` et leurs enums/relations.
- Aucun drop, aucune réécriture de migration et aucune suppression de données n'ont été réalisés.

## Ajustements de vérification

- Playwright exécute auth avec un TTL court dédié et Phase C avec un TTL normal, évitant qu'un paramètre de test artificiel casse les workflows longs.
- La transaction existante de confirmation du wizard dispose d'un timeout explicite de 30 s pour ses écritures document/événement sur Neon.
- Les rapports/traces Playwright reproductibles sont ignorés par ESLint et Git.

## Risques évités

- Aucune suppression fondée uniquement sur l'âge d'un fichier.
- Aucun changement des données principales, de Cloudinary métier, de Neon principal ou des migrations appliquées.
- Aucun retrait des redirections sans métriques de trafic/favoris.
- Aucun nettoyage npm automatique destructif.
- Le dépôt ne dispose pas d'un historique Git exploitable (`.git` vide); les suppressions ont donc été volontairement conservatrices.

## Vérifications finales

- Backend : typecheck PASS; lint PASS; 12 suites / 39 tests PASS; build PASS.
- Frontend : typecheck PASS; lint PASS; build PASS (26 routes).
- Playwright auth : 7/7 PASS.
- Playwright Phase C : 3/3 PASS, dont workflows API, wizard Cloudinary et smoke UI responsive.
- Prisma : schéma valide; 14 migrations; base principale à jour.
- Smoke runtime : login ADMIN/USER, Terrains, Mes terrains, détail, Documents, Calendrier, Administration et logout couverts par Playwright.

## Décision restante

Planifier séparément la migration destructive de la base IA legacy après mesure et archivage des données.
