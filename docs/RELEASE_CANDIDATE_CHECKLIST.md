# Release Candidate Checklist

- [x] 14 migrations à jour et rejouables sur une base neuve
- [x] Backend typecheck, lint, test et build verts
- [x] Frontend typecheck, lint et build verts
- [x] Playwright critique vert
- [x] Aucun P0 ouvert
- [x] Aucun P1 ouvert
- [x] Permissions USER affecté/non affecté validées
- [x] Aucune date passée dans `nextScheduledEventAt`
- [x] USER voit uniquement ses terrains affectés
- [x] USER voit uniquement les rapports publiés
- [x] Publication et affectation idempotentes
- [x] Calendrier global USER validé sur terrain affecté
- [x] Wizard réel et Cloudinary validés
- [x] AI fallback manuel validé
- [x] AI réel documenté `READY_BUT_PROVIDER_NOT_CONFIGURED`
- [x] Base principale sans fixture QA
- [x] R16605 reste non principal
- [x] Responsive cinq viewports validé
- [x] Fixtures DB et Cloudinary QA nettoyées
- [x] Secrets absents des logs et documents
- [x] Points de données ambigus documentés sans modification

Verdict: **RELEASE_CANDIDATE**.
