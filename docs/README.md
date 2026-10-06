# Documentation NAALA FONCIER

## CURRENT

- [Admin principal](PRIMARY_ADMIN_CLEANUP.md) : nettoyage Neon, validation auth et rotation sans secrets.
- [Déploiement Render](RENDER_DEPLOYMENT.md) : commandes, variables exactes, migrations, SSL et auth.
- [Checklist de livraison](RENDER_DEPLOYMENT_CHECKLIST.md) : vérifications locales et après déploiement.
- [Audit final](PRE_RENDER_FINAL_AUDIT.md) : décisions, preuves, validations et limites.
- [Inventaire technique](PRE_RENDER_INVENTORY.md) : routes, modules, endpoints, consommateurs, dépendances et scripts.

## REFERENCE

- `backend/prisma/schema.prisma` et les migrations : source de vérité du schéma.
- `backend/.env.example`, `frontend/.env.example` : configuration locale sans secret.
- `backend/README.md`, `frontend/README.md` : points d'entrée pour développement et QA.
- Les reviews et manifests sous `backend/private-import/` : référence privée locale des imports métier, non versionnée ni nécessaire au runtime.

## HISTORICAL

- [Plan UI antérieur](historical/UI_REDESIGN_PLAN.md) : décisions de design précédentes, sans instruction pour cette mission.
- Les 26 anciennes docs `docs/*.md` étaient déjà supprimées dans le working tree au début de cette mission. Ces suppressions préexistantes n'ont pas été réattribuées à cet audit ni annulées automatiquement. Leur historique reste disponible dans Git ; pour relire une pièce : `git show HEAD:docs/PHASE_2A_AI_ANALYSIS.md` (adapter le chemin).

Les nouveaux documents sont complémentaires : le guide est prescriptif, la checklist sert à la recette et l'audit consigne les preuves. Ne pas utiliser une ancienne doc comme état actuel sans vérification dans le code.
