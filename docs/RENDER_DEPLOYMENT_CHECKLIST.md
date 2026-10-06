# Checklist Render

Les coches signifient une vérification réellement faite, pas une promesse. Consulter le rapport d'audit pour les résultats locaux.

- [ ] Git relu, changements existants et nouveaux commités, working tree propre.
- [ ] Aucun secret dans le commit ; `.env`, `.phase-c-qa.env`, sources privées ignorés.
- [x] Comptes Neon nettoyés et nouveau mot de passe principal aléatoire configuré localement ; ancien admin désactivé. Voir PRIMARY_ADMIN_CLEANUP.md.
- [ ] Secret principal transféré au gestionnaire de secrets ; rotation avant production si nécessaire, sans valeur dans Git ou les logs.
- [ ] Les trois sources `backend/src/shared/storage/` sont incluses dans le commit.
- [ ] Avis npm résiduels backend/frontend revus ; corrections upstream suivies ; pas de downgrade incompatible forcé.
- [ ] Backend typecheck, lint, tests et build passent.
- [ ] Frontend typecheck, lint et build passent avec API_INTERNAL_URL de production.
- [ ] Auth et Phase C/smoke Playwright passent sur la base QA isolée.
- [ ] Prisma validate et migrate status passent ; migration inspectée, jamais reset/db push.
- [ ] Neon accessible depuis Render ; URLs runtime/directe et TLS vérifiés.
- [ ] Cloudinary configuré et dossier d'upload confirmé.
- [ ] Backend déployé avec migrations avant start et PORT Render.
- [ ] `/api/health` retourne 200 ; Swagger OFF.
- [ ] Frontend déployé, rewrite `/api` vers la bonne URL backend.
- [ ] WEB_ORIGIN égale l'origine HTTPS exacte frontend ; CORS n'autorise aucune origine étrangère.
- [ ] Proxy/IP/rate limiting vérifiés sur la chaîne Render/Next réelle.
- [ ] Cookie refresh httpOnly, Secure, SameSite=lax, sans Domain, Path=/api/auth.
- [ ] Login du seul ADMIN principal et refus des anciens comptes ; ADMIN/USER testés uniquement en QA isolée.
- [ ] Refresh après reload et expiration, sans boucle ; logout efface le cookie.
- [ ] Liste terrains et terrain affecté visibles selon rôle.
- [ ] Upload / aperçu PDF et DOCX / téléchargement Cloudinary vérifiés.
- [ ] Calendrier et prochaines dates fonctionnels.
- [ ] IA facultative : sans token, fallback manuel ; avec token, proposition et confirmation ADMIN.
- [ ] Aucun token, cookie, mot de passe, contenu de document ou URL DB dans les logs.
- [ ] Imports ponctuels non relancés et aucune source privée exposée.
