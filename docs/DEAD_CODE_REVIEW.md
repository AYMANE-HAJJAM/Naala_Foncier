# Revue du code mort

Date : 2026-08-29

## Deleted

- Outputs régénérables finaux : `.next`, `.next-e2e`, `artifacts`, `dist`, rapports de tests et caches TypeScript. Ils ne sont pas du code source et sont ignorés par Git.
- Ancienne UI globale Actions/Rapports/Paramètres et grand bloc IA commenté dans `operations.tsx`; le fichier ne contient plus que l'écran Utilisateurs réellement importé.
- Anciens onglets terrain `ActionsTab`, `StrategicReportTab` et `AiAnalysisTab`; `HistoryTab` a été conservé dans un fichier dédié.
- Contrôleurs backend IA legacy non enregistrés : `AIAnalysisController` et `AnalysesCompatibilityController`.
- `AIAnalysisService` legacy, absent des providers Nest, ainsi que son test isolé.
- Frontière Mahakim non utilisée `CourtStatusProvider` / `UnconfiguredCourtStatusProvider`.
- Doublon ancien `apply-presentation-summaries.mjs`; la variante TypeScript plus récente est conservée.
- Type frontend `AnalysisJob`, méthode privée `DocumentsService.sanitize`, variable de script et propriétés constructeur inutilisées.
- Dépendances directes sans import : `@radix-ui/react-dropdown-menu`, `@tanstack/react-table`, `recharts`, `uuid`.
- Ancien fichier `frontend/src/features/global/registries.tsx` et duplications auth déjà retirés lors de la stabilisation précédente.

## Kept

- Redirections `/agenda`, `/mes-dossiers`, `/utilisateurs`, `/documents`, `/portefeuille`, `/requisitions/nouveau` et anciennes entrées désactivées : coût faible, protection des favoris/liens externes.
- `phase1.ts` et `phase-b.ts` : wrappers métier actifs reposant sur le core HTTP unique.
- `Hearing` et ses endpoints : encore utilisés par le suivi judiciaire, les notifications et la projection `TerrainEvent`.
- `ACTES`, `ACTES_PROPRIETE` et `RAPPORTS` : nécessaires pour les anciennes données et contrats API.
- Nettoyage défensif de l'ancienne clé navigateur `naala-session`.

## Legacy DB

- `AIAnalysisJob`
- `AIAnalysisDocument`
- `DocumentAnalysis`
- `ExtractedFact`
- Enums et relations associés à cette ancienne pile IA

Plan futur : mesurer les lignes encore présentes, exporter/archiver si nécessaire, vérifier qu'aucun consommateur externe n'appelle les anciens endpoints, puis créer une nouvelle migration Prisma explicite. Ne jamais réécrire une migration appliquée.

## Unknown / needs human decision

- Aucun nouveau fichier source `UNKNOWN` n'a été supprimé pendant le cleanup final.
- Date de fin de support des anciennes routes/redirections et de la clé `naala-session`.
- Conservation longue durée des scripts ponctuels de présentation/réparation/import après archivage métier.
- Dépendances backend attendues indirectement par Nest/Pino (`@nestjs/platform-express`, `rxjs`, `pino-http`) : volontairement non retirées.
- Politique d'archivage des audits de phases; ils sont indexés dans `docs/README.md` plutôt que supprimés.
