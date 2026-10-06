# Nettoyage de l’administrateur principal

Opération effectuée le 6 octobre 2026 sur Neon, base principale `neondb`, schéma `public`. La base `naala_phase_c_qa` et ses comptes sont séparés ; aucun nettoyage n’y a été appliqué. Les tests Playwright y ont exécuté leurs opérations habituelles de recette.

Compte final : **naciri@archeritage.ma**, rôle unique **ADMIN**, actif. Ce compte n’existait pas : une identité a été créée via User / Role / UserRole. Sur une prochaine exécution, l’upsert conserve son identifiant. Bcrypt utilise le coût 12, identique à UsersService.

## Audit avant mutation

Aucune valeur de hash, jeton ou secret n’a été affichée. Le script inspecte toutes les relations métier et d’accès du modèle User, y compris les données historiques et soft-deleted. Les compteurs suivants sont un résumé de cet audit ; les autres relations étaient nulles sauf celles indiquées dans les notes.

| Identifiant | Email | Prénom / nom | Rôle | Actif | Affectations | Audit | Documents créés / versions | Rapports créés / validés | Événements terrain |
|---|---|---|---|---|---:|---:|---|---|---:|
| d298b419-a58f-454e-92d5-76f3e3f5ebeb | admin@naala-foncier.ma | Omar Alaoui | ADMIN | oui | 0 | 60 | 34 / 34 | 9 / 1 | 0 |
| 4417678c-25dc-44dd-9912-3279a8680163 | karim@naala-foncier.ma | Karim El Mansouri | aucun | non | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| ebd87d2b-840d-49a4-9734-6fe94c3d9370 | nadia@naala-foncier.ma | Nadia Benali | aucun | non | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| 921e23df-8d7b-43d0-ba69-7343129e1e12 | nasser@naala-foncier.ma | Nasser Bouazza | aucun | non | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| ac7c4cda-eee9-4c11-b731-840dd10269d2 | salma@naala-foncier.ma | Salma Idrissi | aucun | non | 0 | 0 | 0 / 0 | 0 / 0 | 0 |
| 1c157f52-8583-4e36-ac3b-06ae38a20519 | user@naala-foncier.ma | Utilisateur Démo | USER | oui | 6 | 13 | 0 / 0 | 0 / 0 | 0 |
| d87df664-1aff-49d2-b308-72ad69356dc9 | youssef@naala-foncier.ma | Youssef Amrani | aucun | non | 0 | 0 | 0 / 0 | 0 / 0 | 0 |

L’ancien admin était également auteur et dernier éditeur de sept terrains, créateur d’une audience, de six actions, de sept drafts et d’une extraction IA ; il avait trois notifications et avait accordé six accès. Karim est responsable de six actions. Le compte démo avait deux notifications. Ces trois identités sont conservées pour préserver ces relations ; les quatre autres comptes avaient zéro relation métier/historique.

## Décisions et bilan DB

La transaction sérialisable verrouille User, UserRole, RefreshToken et UserRequisitionAccess pendant la mutation. Les identités sans dépendances sont supprimées ; les identités historiques sont désactivées et privées de rôles. Aucun terrain, document, rapport, événement, extraction IA ou audit historique n’est supprimé. Un AuditLog `PRIMARY_ADMIN_SETUP` conserve le bilan sans secrets.

Le script vérifie aussi les foreign keys effectives dans pg_catalog avant une suppression : une référence métier non modélisée force la conservation inactive. La vérification en lecture seule de Neon trouve 32 foreign keys vers User, aucune table référente non modélisée ; les requêtes de présence paramétrées ont été validées.

| Mesure | Résultat |
|---|---:|
| Utilisateurs avant | 7 |
| Utilisateurs après | 4 |
| Utilisateurs actifs pouvant se connecter | 1 |
| Administrateurs actifs | 1 |
| Comptes supprimés sans dépendances | 4 |
| Identités historiques inactives conservées | 3 |
| Comptes nouvellement désactivés | 2 |
| Affectations retirées | 6 |
| Affectations restantes, principal compris | 0 |
| Anciennes sessions révoquées par le nettoyage | 26 |
| Sessions de premiers essais révoquées en complément | 2 |
| Sessions encore valides après recette | 0 |

Les quatre suppressions concernent Nadia, Nasser, Salma et Youssef. L’ancien admin, Karim et le compte démo sont inactifs, sans rôle ni affectation. ADMIN accède aux terrains globalement ; aucune affectation artificielle n’a été créée.

## Sessions et seed

Les refresh tokens sont marqués révoqués, conservant leur historique technique. Les accès portent désormais un `sessionId` et JwtStrategy vérifie en DB son propriétaire, sa révocation et son expiration avant de recharger les permissions. Les anciens JWT sans cette référence sont refusés. Révoquer une session invalide immédiatement son accès ; refresh invalide l’accès précédent et logout invalide l’accès courant. Cette protection nécessite d’exécuter la nouvelle version du backend sur chaque instance, notamment lors du déploiement Render.

Le seed ne crée ni utilisateur ni donnée métier de démonstration : uniquement ADMIN, USER et leurs permissions, dans une transaction. Aucun mot de passe ou fallback n’y subsiste. L’ancien script `auth:reset-admin` est remplacé par `admin:setup`. Les imports recherchent un ADMIN actif plutôt qu’un ancien email ; le script de résumés ne réaffecte plus le compte démo. L’exemple de mot de passe Swagger a été retiré.

Le frontend n’a plus de référence à l’ancien compte dans ses sources, fixtures ou scripts. Playwright lit l’environnement QA séparé ; le smoke responsive utilise aussi les credentials QA. Le stockage de session contient le jeton, sans identité ou mot de passe fixé dans le code.

## Configuration et rotation

Le nouveau secret a été généré aléatoirement et conservé uniquement dans `backend/.env`, ignoré par Git. Sa valeur n’a été communiquée ni dans le terminal ni dans ce document. Les anciennes variables INITIAL_ADMIN ont été retirées de ce fichier local après la recette. Pour une rotation :

1. Choisir un nouveau secret dans le gestionnaire de secrets : au moins 16 caractères et au plus 72 octets UTF-8. Ne pas utiliser de valeur ayant été publiée ou partagée hors du gestionnaire.
2. Fournir PRIMARY_ADMIN_EMAIL et PRIMARY_ADMIN_PASSWORD à l’environnement local sécurisé ou à la commande opérateur. Éviter l’historique shell, les captures et les logs ; ne pas modifier le code ou `.env.example` avec une valeur réelle.
3. Depuis `backend`, exécuter `npm run admin:setup -- --dry-run` pour revoir le périmètre, puis `npm run admin:setup`. Attention : la commande maintient **un seul compte actif**, désactive/nettoie les autres et révoque toutes les sessions. Elle refuse une base QA/test.
4. Vérifier le login, les pages ADMIN, le refresh et le logout avec la nouvelle version de l’API. Le script est répétable, préserve l’id du principal existant et ne se lance jamais automatiquement au démarrage ou dans une migration.
5. Conserver le secret dans le gestionnaire ; supprimer la variable de mot de passe de l’environnement runtime si elle n’est plus nécessaire à l’opération. La connexion normale consulte le hash en DB, pas PRIMARY_ADMIN_PASSWORD.

## Validation

| Contrôle | Résultat |
|---|---|
| Backend typecheck / lint / tests / build | PASS ; 15 suites, 59 tests |
| Lint additionnel des scripts modifiés et du seed | PASS |
| Frontend typecheck / lint / build | PASS ; Next 16.3.8, 26 routes ; build relancé avec accès réseau aux polices Google |
| Prisma validate / migrate status | PASS ; 14 migrations, schéma à jour ; aucune migration appliquée |
| Playwright auth en QA isolée | 7/7 PASS, dont restauration cookie, permissions, refresh simultané, logout et compte désactivé |
| Login principal sur Neon principal | PASS, rôle ADMIN unique |
| Dashboard / Terrains / Calendrier / Administration | PASS UI et API, frontend compilé servi par next start ; dashboard ADMIN redirigé normalement vers `/` |
| Refresh / logout sur Neon principal | PASS ; accès précédent puis accès déconnecté refusés 401 |
| Ancien admin | FAIL attendu : 401 ACCOUNT_DISABLED avec son ancien secret local |
| Ancien compte démo | FAIL attendu : 401 INVALID_CREDENTIALS avec le secret essayé ; inactivité confirmée indépendamment en DB |
| Contrôle DB final | 4 comptes, 1 actif, 1 ADMIN actif, 0 affectation, 0 session valide ; tous les tokens antérieurs au nettoyage révoqués |
| Scan des fichiers versionnés et non ignorés | 404 fichiers vérifiés, zéro occurrence des valeurs secrètes locales main/QA |

Le smoke principal emploie un backend local en mode développement et un frontend compilé en production ; il ne remplace pas la recette HTTPS sur Render. Aucun secret n’est écrit dans les tests versionnés.

## Avant Render

La préparation des comptes est terminée. **Prêt pour Render sans réserve : NO.** Restent la revue des avis npm résiduels documentés dans PRE_RENDER_FINAL_AUDIT, la revue et le commit des changements (dont les sources storage), la configuration des services/secrets/URLs et la recette HTTPS sur Render. Le blocage lié à l’ancien mot de passe admin est levé par sa désactivation et le nouveau compte. Transférer le secret principal dans le gestionnaire et le remplacer avant production s’il a été partagé hors de celui-ci. Ne pas relancer les imports ni le setup automatiquement pour déployer.
