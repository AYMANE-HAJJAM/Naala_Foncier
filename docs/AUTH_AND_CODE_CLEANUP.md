# Stabilisation authentification et nettoyage cible

## 1. Root causes login

- Le hash admin en base ne correspondait plus a `INITIAL_ADMIN_PASSWORD`; le seed
  utilisait aussi historiquement un email admin hardcode.
- Les echecs repetes ont ensuite declenche le throttling login, ce qui masquait la
  correction du mot de passe par des reponses 429 temporaires.
- Le frontend possedait deux etats auth: un singleton non reactif et plusieurs etats
  locaux dans `AppShell` et les pages.
- Les decisions de role et les redirections etaient dispersees et parfois prises
  avant la fin de `/auth/me`.
- Le flux auth etait duplique dans les fetchers JSON et binaire.
- Le cookie refresh avait une expiration hardcodee differente du TTL JWT configurable.

## 2. Architecture avant

- `AppShell` restaurait le token, rafraichissait, appelait `/me`, copiait le profil
  dans plusieurs `useState` et redirigeait.
- Les pages `/`, `/dashboard` et `/mes-terrains` lisaient un singleton et ajoutaient
  leurs propres redirections.
- Le fetcher JSON et le fetcher binaire implementaient chacun injection bearer,
  refresh, retry, clear session et redirection navigateur.
- React Query n'etait pas relie au cycle de vie central de la session.

## 3. Architecture apres

- `AuthProvider` est l'unique source reactive: `loading`, `authenticated`,
  `unauthenticated`, utilisateur, role et permissions.
- Le stockage de l'access token reste encapsule dans `auth-session.ts`; aucun profil
  concurrent n'y est conserve.
- `fetchWithAuth` est le coeur HTTP unique utilise par JSON et binaire.
- Le refresh est single-flight; les requetes concurrentes attendent la meme promesse,
  puis rejouent une fois.
- Un evenement unique d'invalidation termine la session; le provider vide alors le
  cache React Query et les donnees utilisateur.
- `RequireAuth` attend la fin de l'initialisation et `RequireRouteAccess` applique la
  matrice ADMIN/USER avant de rendre les pages.
- `/auth/me` et la reponse refresh fournissent le profil serveur fiable; aucun role
  n'est decode depuis le JWT cote frontend.

## 4. Fichiers supprimes

- `frontend/src/features/global/registries.tsx`: quatre anciens ecrans globaux sans
  aucun import ni route active.
- Logique supprimee sans fichier: initialisation auth locale de `AppShell`, helpers
  de role globaux non reactifs et implementation refresh dupliquee de `binary.ts`.

## 5. Fichiers refactores ou ajoutes

- Frontend: provider auth, guards, login, shell, fetcher JSON/binaire, providers
  React Query, routes de dashboard, composants dependant du role, error boundary,
  configuration Playwright et suite `e2e/auth.spec.ts`.
- Backend: service/controller auth, service cookie, validation env, TTL partage,
  strategie JWT, redaction logs, tests auth/cookie/guard et contrat OpenAPI.
- Maintenance: commande `auth:reset-admin`; seed aligne sur `INITIAL_ADMIN_EMAIL`.

## 6. Refresh flow

1. La requete recoit un access token encapsule.
2. Sur 401 hors login/refresh/logout, elle rejoint la promesse refresh courante ou
   en cree une seule.
3. Le cookie `httpOnly` est envoye avec `credentials: include`.
4. Le backend verifie le hash, l'expiration, l'utilisateur actif et revendique
   atomiquement le token avant rotation.
5. Le nouveau token est stocke, le profil provider est actualise et chaque requete
   initiale est rejouee une fois.
6. En cas d'echec, token, profil et cache sont purges une fois; le guard redirige.

## 7. Role routing

- ADMIN: `/`, `/requisitions`, `/calendrier`, `/administration`.
- USER: `/dashboard`, `/mes-terrains`, `/calendrier`.
- Un USER sur une route ADMIN arrive sur `/forbidden`.
- Un ADMIN ouvrant une route reservee USER revient a `/`.
- Les details `/requisitions/:id` restent accessibles aux USER assignes; le backend
  reste l'autorite et renvoie 403 pour un terrain non assigne.

## 8. Securite

- Bcrypt reste utilise; aucun mot de passe ou token n'est journalise.
- Authorization, Cookie, body password et `Set-Cookie` sont redactes des logs HTTP.
- Le refresh reste en cookie `httpOnly`, `Secure` est force en production et le
  scope utilise pour clear/set est identique.
- La duree cookie derive de `JWT_REFRESH_TTL`.
- La rotation, la detection de reutilisation, la revocation au logout et le refus
  d'un utilisateur desactive sont actifs.
- Le login production reste limite a 5/minute; le developpement autorise 30/minute.
- JWT secrets requis (minimum 32 caracteres) et TTL au format `15m`, `2h`, `7d`.

### Configuration production attendue

- `WEB_ORIGIN=https://frontend.example`: origine frontend exacte; jamais `*` avec
  credentials.
- `API_INTERNAL_URL=https://api-internal.example` pour le proxy Next, ou
  `NEXT_PUBLIC_API_BASE_URL=https://api.example` si le navigateur appelle l'API.
- `AUTH_COOKIE_SECURE=true` (egalement force par `NODE_ENV=production`).
- `AUTH_COOKIE_SAME_SITE=lax` en deploiement same-site; `none` uniquement pour un
  vrai deploiement cross-site HTTPS.
- `AUTH_COOKIE_DOMAIN=` recommande pour un cookie host-only; renseigner un domaine
  partage uniquement si l'architecture l'exige.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` et
  `JWT_REFRESH_TTL` doivent etre fournis sans jamais etre loggues.

## 9. Tests et gates

- Backend typecheck: PASS.
- Backend lint: PASS.
- Backend tests: 12 suites, 40 tests PASS.
- Backend build: PASS.
- Frontend typecheck: PASS.
- Frontend lint: PASS.
- Frontend build: PASS, 26 routes generees.
- Playwright auth: 7 tests PASS (ADMIN, USER, non authentifie, credentials invalides,
  compte desactive, single-flight refresh, purge cache logout).
- Prisma validate: PASS.
- Prisma migrate status: 14 migrations, schema a jour.

## 10. Problemes encore ouverts

- L'access token reste dans `sessionStorage` par choix de stabilite; une migration
  cookie-only n'est pas incluse dans cette phase.
- Le throttling Nest est en memoire; un deploiement multi-instance necessitera un
  stockage partage.
- Les wrappers `phase1.ts` et `phase-b.ts` restent necessaires aux fonctions non
  encore couvertes par Orval, mais utilisent desormais le meme coeur HTTP.
- Le driver PostgreSQL emet un avertissement de future semantique SSL; il ne bloque
  pas l'auth mais devra etre traite lors de la prochaine mise a niveau dependances.

