# Phase C - Bug log

| ID | Priorité | Module | Scénario | Expected | Actual | Status | Fix | Retest |
|---|---|---|---|---|---|---|---|---|
| C-001 | P1 | Prisma | Replay depuis une base vide | 13 migrations applicables | `isPrincipal` absent avant index | CORRIGÉ | Migration préalable idempotente | PASS, base QA neuve |
| C-002 | P1 | Prisma | Seed après replay | Schéma identique à Prisma | 16 champs et preview rapport absents | CORRIGÉ | Migration `phase_c_replay_alignment` | PASS, seed + migrate status |
| C-003 | P0 | QA/Data | Mutations isolées | Aucune fixture dans `neondb` | `search_path` insuffisant avec PrismaPg | CORRIGÉ | Base QA distincte, ports dédiés, garde database/schema, nettoyage ciblé | PASS, audits QA/main |
| C-004 | P2 | Backend | Exception non HTTP | Détail dans logs uniquement | Exception avalée sans log | CORRIGÉ | `ApiExceptionFilter` journalise côté serveur | PASS |
| C-005 | P2 | Seed | Seed oppositions | Aucune identité fictive | Libellé de démonstration réintroduit | CORRIGÉ | `opponentName = null`, `A_CONFIRMER` | PASS |
| C-006 | P2 | Wizard | Confirmation Cloudinary | Transaction complète | Un `500` intermittent initial | CORRIGÉ/RETESTÉ | Instrumentation backend; retests transactionnels verts | PASS 2 fois |
| C-007 | P2 | R20611 | Audit hearings | Histoire non ambiguë | Deux lignes au 22/07/2026 09:00 | OUVERT DATA | Revue humaine, aucune suppression | Documenté |
| C-008 | P3 | Oppositions | Sources | Source liée si connue | 2 lignes sans source | OUVERT DATA | Obtenir/valider la pièce source | Documenté |
| C-009 | P3 | Drafts | Cleanup | Décision contrôlée | 5 anciens drafts | OUVERT DATA | 4 candidats sans document, 1 à conserver/revoir | Dry-run PASS |
| C-010 | P3 | Infrastructure | Ancien essai QA | Aucun schéma inutilisé | Schéma technique QA obsolète dans `neondb` | OUVERT | Suppression DBA explicite ultérieure | Non bloquant |
| C-011 | P3 | PostgreSQL | Tests longs | Connexions stables | Warning de concurrence `pg` et un `ECONNRESET` transitoire | SURVEILLANCE | Retry limité aux GET idempotents; pas de masquage des statuts HTTP | Retest PASS |
