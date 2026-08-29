# Phase B — Data quality

Audit en lecture effectué le 25 août 2026 avec `maintenance:audit:phase-b-data`. Sept références attendues, sept trouvées. Les valeurs ci-dessous sont celles de la base ; aucune identité ou relation n'a été déduite.

## R 20657/31

- Identité : `LROUIA LKBIRA`, Naala, 39 ha 59 a 50 ca, vendeur Bahri Ibrahim, acquéreur Nasser Bouazza.
- Judiciaire : aucune affaire ; un événement de transmission au tribunal ; aucune prochaine date.
- Oppositions : 22 connues, 0 détaillée.
- Documents : 4, catégories ANCFCC et ACTES_PROPRIETE (affichées « Actes »).
- Rapports liés au terrain : aucun. Le rapport stratégique portefeuille visible pour l'ADMIN est un rapport de portée portefeuille.
- Point humain : une transmission existe sans numéro d'affaire confirmé.

## R 20629/31

- Identité : `ENRALA 2`, Naala, 27 ha 87 a 30 ca, vendeur Boufim Rachid, acquéreur Nasser Bouazza.
- Judiciaire : affaire `2025/1403/237`, tribunal de première instance de Guelmim, phase Instruction, stage `A_CONFIRMER` ; aucune prochaine date.
- Oppositions : 7 connues, 0 détaillée.
- Documents : 4, dont un certificat d'oppositions ; aucun Report lié.
- Point humain : l'orthographe `ENRALA 2` est conservée faute de source autorisant une correction.

## R 20696/31

- Identité : `FEM ENTEL`, Naala, 48 ha 61 a 0 ca, vendeur Izlalne, acquéreur Nasser Bouazza.
- Judiciaire : affaire `2024/1403/79`, phase « Délibéré — résultat à confirmer », stage `A_CONFIRMER` ; audience passée du 8 juillet 2026 ; aucune prochaine date.
- Oppositions : 27 connues, 1 détaillée, type partielle.
- Correction technique : le nom explicitement marqué « identité de démonstration » a été supprimé ; l'identité est maintenant vide / `A_CONFIRMER`.
- Source : la ligne détaillée n'a pas de `sourceDocumentId`, bien que deux documents d'oppositions existent. Aucun lien automatique n'a été créé.
- Rapports liés : aucun.

## R 20611/31

- Identité : `ENAALA`, Enaala, 26 ha 85 a 53 ca, vendeur El Kachout, acquéreur Nasser Bouazza.
- Judiciaire : affaire `2025/1403/238`, phase « Audience à clarifier », stage `A_CONFIRMER` ; aucune prochaine date.
- Historique : deux lignes Hearing au 22 juillet 2026 avec statuts distincts et trois TerrainEvent le même jour.
- Oppositions : 10 connues, 0 détaillée.
- Documents : 4 ; aucun Report lié.
- Anomalie à valider : les deux hearings peuvent représenter un doublon technique ou deux suivis métier. Ils ne sont pas supprimés sans preuve.

## R 20612/31

- Identité : `ENAALA 1`, Enaala, 25 ha 30 a 0 ca, vendeur Boufim Rachid, acquéreur Nasser Bouazza.
- Relation : lien sortant `RECIPROQUE_CHEVAUCHEMENT` vers `R 16605/31`.
- Judiciaire : deux affaires, `2025/1403/249` et `2025/1403/250`, toutes deux au tribunal de première instance de Guelmim ; aucune prochaine date.
- Oppositions : 16 connues, 1 détaillée, Commune de Mesti, institutionnelle.
- Source : la ligne détaillée n'a pas de `sourceDocumentId`; un document d'oppositions existe mais n'est pas lié automatiquement.
- Documents : 6 ; aucun Report lié.

## R 148026/31

- Identité : `AL MOUSTAKBEL / AMI ANTEL`, Enaala, 53 ha 70 a 0 ca, vendeur Achnit Ibrahim, acquéreur St Flawers Avenu.
- Judiciaire : aucune affaire ; événement de bornage bloqué du 25 juin 2025 ; aucune prochaine date.
- Oppositions : nombre connu absent, 0 détaillée.
- Documents : 6, dont un document `RAPPORTS` intitulé « Rapport stratégique portefeuille Naala / Enaala ».
- Rapports : aucun `Report` lié au terrain. Le document n'a pas été transformé ni dupliqué automatiquement.

## R 16605/31 — dossier lié non principal

- Identité : propriété, vendeur et acquéreur à confirmer ; Enaala ; surface enregistrée 0 ha 0 a 0 ca.
- Statut : `isPrincipal = false`.
- Relation : lien entrant `RECIPROQUE_CHEVAUCHEMENT` depuis `R 20612/31`.
- Judiciaire : aucune affaire, aucun hearing, aucun événement, aucune prochaine date.
- Oppositions : 17 connues, 0 détaillée.
- Documents et rapports : aucun.
- Point humain : les valeurs inconnues et la surface nulle sont conservées, sans reconstruction depuis `R 20612/31`.

## Contrôles transverses

- Prochaine date passée : aucune dans les sept snapshots après recalcul.
- Référence manquante : aucune.
- Doublon documentaire exact selon catégorie + catégorie personnalisée + nom de fichier courant : aucun détecté.
- Artefacts : 5 drafts non confirmés de plus de 7 jours détectés en dry-run ; aucune UploadSession expirée.
- Catégories : `ACTES` et `ACTES_PROPRIETE` restent compatibles ; l'UI les regroupe sous « Actes ».
- Rapports-as-documents : présents comme sources documentaires ; aucune conversion automatique vers `Report`.
- Sources opposition manquantes : 2 lignes détaillées, sur `R 20696/31` et `R 20612/31`.

