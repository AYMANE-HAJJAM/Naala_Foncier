# Audit de nettoyage de l'authentification

## Perimetre audite

L'audit couvre le module `identity-access`, la strategie JWT, les guards globaux,
les cookies/CORS/env, le client HTTP Orval, les telechargements binaires, le shell,
les pages de login et les redirections par role.

## Architecture actuelle

### Backend

- `AuthController` expose login, refresh, logout et `/auth/me`.
- `AuthService` verifie bcrypt, emet un JWT d'acces et un JWT de refresh, stocke
  uniquement le hash SHA-256 du refresh et effectue une rotation par famille.
- Le refresh reste dans un cookie `httpOnly`; l'access token est retourne au client.
- `GlobalAuthGuard` protege toutes les routes sauf `@Public()`.
- `JwtStrategy` recharge l'utilisateur actif, ses roles et permissions a chaque
  requete protegee. Une desactivation prend donc effet meme avec un JWT non expire.
- `PermissionsGuard` applique les permissions metier cote serveur.
- CORS utilise une origine explicite et `credentials: true`.

### Frontend

- L'access token est encapsule dans `auth-session.ts` et persiste dans
  `sessionStorage`; le refresh token n'est jamais lu par JavaScript.
- `customFetcher` ajoute le bearer token, envoie les credentials, tente un refresh
  puis rejoue une fois la requete. `refreshAccessToken` possede deja une promesse
  single-flight.
- `binary.ts` duplique toutefois le retry/refresh/redirect du fetcher principal.
- `AppShell` initialise la session, appelle `/auth/me`, maintient une seconde copie
  locale du profil et execute une partie des redirections.
- Plusieurs pages interrogent imperativement le singleton non reactif
  `getCurrentSessionUser()` / `isAdminUser()` et font leurs propres redirections.
- React Query ne connait pas l'etat d'initialisation auth et conserve son cache
  jusqu'au logout explicite.

## Problemes reels et causes racines

1. **Deux sources de verite frontend.** Le singleton `auth-session.ts` et les etats
   locaux de `AppShell` divergent potentiellement. Il n'existe pas de statut
   reactif `loading | authenticated | unauthenticated` partage.
2. **Initialisation auth dans le shell.** Seules les routes du groupe dashboard
   initialisent la session. Le login ne sait pas qu'un cookie valide existe et les
   features ne peuvent pas attendre explicitement la fin de l'initialisation.
3. **Redirections dispersees.** `AppShell`, `/`, `/dashboard`, `/mes-terrains`, les
   details de terrain et le fetcher redirigent independamment. La liste
   `adminOnlyHrefs` ne protege pas `/` ni `/requisitions`, donc le routage USER est
   incomplet et contradictoire.
4. **HTTP auth duplique.** `binary.ts` reproduit l'injection du token, le refresh et
   le redirect deja presents dans `fetcher.ts`.
5. **Redirect global dans la couche HTTP.** Le fetcher mute directement
   `window.location`; il ne notifie pas une source d'etat centrale et peut provoquer
   plusieurs redirects simultanes.
6. **Cache inter-session.** Le cache est vide au logout depuis `AppShell`, mais le
   comportement n'est pas une responsabilite de session centrale. Un echec de
   refresh hors shell peut laisser des donnees sensibles en cache.
7. **Erreurs login insuffisamment distinguees.** Le backend retourne le meme code
   pour credentials invalides et utilisateur desactive, contrairement a l'UX
   demandee. Le frontend affiche directement tout message API.
8. **Cookie partiellement hardcode.** `maxAge` vaut toujours sept jours alors que
   `JWT_REFRESH_TTL` est configurable. SameSite/domain/secure ne sont pas valides
   et documentes comme options de deploiement.
9. **Logout partiel en cas de cookie invalide.** La suppression client est correcte,
   mais la configuration du clear cookie doit rester strictement identique a celle
   utilisee lors de sa creation.
10. **Tests auth incomplets.** Les tests actuels couvrent login valide, mauvais mot
    de passe et utilisateur inactif. Rotation, reutilisation, logout, guard actif,
    routage et single-flight ne sont pas couverts.
11. **Login trop charge.** L'ecran contient un panneau marketing et un etat
    `loading` duplique avec `login.isPending`; le message doit etre mappe par cas.
12. **Configuration seed incoherente (corrigee avant cet audit).** Le seed utilisait
    historiquement un email admin hardcode et le hash en base pouvait diverger de
    `INITIAL_ADMIN_PASSWORD`. Une commande ciblee de reset existe maintenant.

## Duplications et code legacy

- Retry auth duplique entre `fetcher.ts` et `binary.ts`.
- Helpers de role globaux non reactifs utilises dans le shell et les pages.
- Redirections historiques (`mes-dossiers`, `agenda`, `utilisateurs`) encore utiles
  comme compatibilite, mais elles ne doivent pas porter de logique auth.
- Helpers `phase1.ts` / `phase-b.ts` sont encore references; ils reposent deja sur
  `customFetcher` et ne constituent pas un second systeme auth.

## Risques

- Flash de contenu ou decision de role avant `/me`.
- USER accedant a une page admin puis etant rejete tardivement.
- Plusieurs composants reagissant au meme echec refresh par plusieurs redirects.
- Donnees ADMIN visibles apres changement de compte si le cache n'est pas purge
  depuis tous les chemins de fin de session.
- Cookie de refresh et JWT expirant a des moments differents si le TTL change.

## Plan de correction

1. Introduire un `AuthProvider` unique avec statut, user, login, logout et
   initialisation `/me`; brancher sa fin de session au cache React Query.
2. Garder le stockage access token actuel mais le rendre purement interne au client
   auth; exposer un evenement de session au lieu de rediriger depuis le fetcher.
3. Extraire un coeur HTTP partage par JSON et binaire, avec un seul refresh
   single-flight et un seul retry.
4. Ajouter des guards frontend declaratifs et une matrice de routes centralisee;
   retirer les redirections auth des pages et de `AppShell`.
5. Simplifier le login et mapper credentials, compte desactive, rate limit et panne.
6. Distinguer les erreurs backend sans reveler l'existence arbitraire d'un compte;
   aligner cookie et TTL via une configuration validee.
7. Completer les tests unitaires/integration/E2E auth, puis executer typecheck, lint,
   tests, builds, Playwright et Prisma migrate status.

