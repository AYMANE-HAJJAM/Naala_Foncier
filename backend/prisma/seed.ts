import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { terrainSummaries } from "../src/modules/requisitions/terrain-summaries.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL est requis pour exécuter le seed.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const permissionKeys = [
  "user.manage", "role.manage", "requisition.view", "requisition.create", "requisition.update", "requisition.delete",
  "document.view", "document.upload", "document.update", "document.validate", "opposition.view", "opposition.manage",
  "legalCase.view", "legalCase.manage", "hearing.manage", "action.view", "action.manage", "report.view", "report.manage",
  "report.validate", "aiAnalysis.launch", "aiAnalysis.validate", "audit.view",
] as const;

const userPermissionKeys = [
  "requisition.view",
  "document.view",
  "document.upload",
  "opposition.view",
  "legalCase.view",
  "action.view",
  "report.view",
] as const;

const obsoleteDemoEmails = [
  "karim@naala-foncier.ma",
  "salma@naala-foncier.ma",
  "youssef@naala-foncier.ma",
  "nadia@naala-foncier.ma",
  "nasser@naala-foncier.ma",
] as const;

const obsoleteRoleKeys = [
  "COORDINATEUR_FONCIER",
  "COORDINATEUR",
  "JURISTE_AVOCAT",
  "GEOMETRE",
  "GESTIONNAIRE_DOCUMENTAIRE",
  "PROPRIETAIRE_CONSULTATION",
] as const;

const records = [
  { reference: "R 148026/31", propertyName: "AL MOUSTAKBEL / AMI ANTEL", location: "Enaala", surface: [53, 70, 0], seller: "Achnit Ibrahim", buyer: "St Flawers Avenu", risk: "CRITIQUE_OPERATIONNEL", status: "BORNAGE_BLOQUE", label: "Bornage bloqué", issue: "Le premier bornage a été empêché sur le terrain malgré la présence des autorités.", count: null, date: "2025-06-25", event: "Tentative de bornage bloquée", next: "Situation actuelle à actualiser.", rank: 1, details: ["Identité des personnes ayant bloqué le bornage", "Existence du procès-verbal d’incident", "État ANCFCC après le blocage", "Nouvelle date de bornage"] },
  { reference: "R 20612/31", propertyName: "ENAALA 1", location: "Enaala", surface: [25, 30, 0], seller: "Boufim Rachid", buyer: "Nasser Bouazza", risk: "CRITIQUE", status: "AU_TRIBUNAL", label: "Au tribunal", issue: "Contentieux réciproque et possible chevauchement avec R 16605/31.", count: 16, date: "2026-07-15", event: "Audience annoncée", next: "Compte rendu ou situation actuelle à renseigner.", rank: 2, details: ["Compte rendu de l’audience du 15/07/2026", "Situation actuelle des dossiers 249 et 250", "Plan de superposition avec R 16605/31"] },
  { reference: "R 20696/31", propertyName: "FEM ENTEL", location: "Naala", surface: [48, 61, 0], seller: "Izlalne", buyer: "Nasser Bouazza", risk: "CRITIQUE", status: "AU_TRIBUNAL", label: "Au tribunal", issue: "Dossier judiciaire critique avec 27 oppositions.", count: 27, date: "2026-07-08", event: "Moudawala annoncée", next: "Résultat de la moudawala à renseigner.", rank: 3, details: ["Résultat de la moudawala du 08/07/2026", "Situation actuelle du dossier tribunal", "Localisation des oppositions partielles"] },
  { reference: "R 20657/31", propertyName: "LROUIA LKBIRA", location: "Naala", surface: [39, 59, 50], seller: "Bahri Ibrahim", buyer: "Nasser Bouazza", risk: "ELEVE_CRITIQUE", status: "A_CONFIRMER", label: "Oppositions à clarifier", issue: "Oppositions multiples à clarifier.", count: 22, date: null, event: "Transmission vers le tribunal mentionnée par la conservation", next: "Situation judiciaire à actualiser.", rank: 4, details: ["Confirmation de la transmission au tribunal", "Numéro de dossier tribunal éventuel", "Matrice des oppositions"] },
  { reference: "R 20611/31", propertyName: "ENAALA", location: "Enaala", surface: [26, 85, 53], seller: "El Kachout", buyer: "Nasser Bouazza", risk: "ELEVE_CRITIQUE", status: "AU_TRIBUNAL", label: "Au tribunal", issue: "Dossier au tribunal avec environ dix oppositions.", count: 10, date: "2026-07-22", event: "Événement judiciaire mentionné le 22/07/2026", next: "Nature et résultat à clarifier.", rank: 5, details: ["Nature exacte de l’événement du 22/07/2026", "Résultat ou suite procédurale", "Statut des oppositions transformées"] },
  { reference: "R 20629/31", propertyName: "ENRALA 2", location: "Naala", surface: [27, 87, 30], seller: "Boufim Rachid", buyer: "Nasser Bouazza", risk: "A_CONFIRMER", status: "AU_TRIBUNAL", label: "Au tribunal", issue: "Dossier au tribunal avec oppositions totales et une opposition partielle importante.", count: 7, date: null, event: "Dossier enregistré au tribunal de Sidi Ifni", next: "Prochaine date et situation judiciaire à actualiser.", rank: 6, details: ["Prochaine date judiciaire", "Situation actuelle du dossier 2025/1403/237", "Localisation de l’opposition partielle (~15 ha)"] },
  { reference: "R 16605/31", propertyName: "À confirmer", location: "Enaala", surface: [0, 0, 0], seller: "À confirmer", buyer: "À confirmer", risk: "A_CONFIRMER", status: "A_CONFIRMER", label: "Dossier lié à qualifier", issue: "Réquisition liée à R 20612/31; données complémentaires à confirmer.", count: 17, date: null, event: null, next: "Obtenir le plan certifié et les pièces du dossier.", rank: 7, details: ["Données minimales uniquement", "Aucun résultat juridique présumé"] },
] as const;

async function syncRolePermissions(roleId: string, permissionIds: string[]) {
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  if (permissionIds.length) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }
}

async function main() {
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL ?? "admin@naala-foncier.ma")
    .trim()
    .toLowerCase();
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialPassword) {
    throw new Error("INITIAL_ADMIN_PASSWORD est requis pour executer le seed.");
  }
  const passwordHash = await hash(initialPassword, 12);
  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({ where: { key }, update: {}, create: { key, name: key } }),
    ),
  );
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  const adminRole = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: { name: "Gérant / Administrateur", description: "Accès complet à la plateforme" },
    create: { key: "ADMIN", name: "Gérant / Administrateur", description: "Accès complet à la plateforme" },
  });
  const userRole = await prisma.role.upsert({
    where: { key: "USER" },
    update: { name: "Utilisateur", description: "Consultation des dossiers assignés uniquement" },
    create: { key: "USER", name: "Utilisateur", description: "Consultation des dossiers assignés uniquement" },
  });

  await syncRolePermissions(
    adminRole.id,
    permissions.map((p) => p.id),
  );
  await syncRolePermissions(
    userRole.id,
    userPermissionKeys.map((key) => permissionByKey.get(key)!.id),
  );

  // Soft-deactivate known obsolete development accounts only (never wipe unknown/production users).
  for (const email of obsoleteDemoEmails) {
    await prisma.user.updateMany({
      where: { email },
      data: { isActive: false },
    });
  }

  for (const key of obsoleteRoleKeys) {
    const role = await prisma.role.findUnique({ where: { key } });
    if (!role) continue;
    await prisma.userRole.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { firstName: "Omar", lastName: "Alaoui", passwordHash, isActive: true, deletedAt: null },
    create: {
      firstName: "Omar",
      lastName: "Alaoui",
      email: adminEmail,
      passwordHash,
      isActive: true,
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: admin.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const demoUser = await prisma.user.upsert({
    where: { email: "user@naala-foncier.ma" },
    update: { firstName: "Utilisateur", lastName: "Démo", passwordHash, isActive: true, deletedAt: null },
    create: {
      firstName: "Utilisateur",
      lastName: "Démo",
      email: "user@naala-foncier.ma",
      passwordHash,
      isActive: true,
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: demoUser.id } });
  await prisma.userRole.create({ data: { userId: demoUser.id, roleId: userRole.id } });

  const refs = new Map<string, string>();
  const summaryByRef = new Map(terrainSummaries.map((s) => [s.reference, s]));

  for (const row of records) {
    const summary = summaryByRef.get(row.reference);
    const data = {
      propertyName: row.propertyName,
      location: row.location,
      province: "Sidi Ifni",
      surfaceHectares: row.surface[0],
      surfaceAres: row.surface[1],
      surfaceCentiares: row.surface[2],
      sellerName: row.seller,
      buyerName: row.buyer,
      riskLevel: row.risk,
      mainStatus: row.status,
      mainStatusLabel: row.label,
      mainIssue: row.issue,
      oppositionCount: row.count,
      nextAction: summary?.nextAction ?? row.next,
      criticalDetails: summary?.pointsToClarify ?? [...row.details],
      priorityRank: row.rank,
      // Never store past events as "importantDate" / upcoming deadline
      importantDate: summary?.nextScheduledEventAt
        ? new Date(`${summary.nextScheduledEventAt}T12:00:00Z`)
        : null,
      eventLabel: summary?.eventLabel ?? row.event,
      currentSituation: summary?.currentSituation ?? row.issue,
      constraintsJson: summary?.pointsToClarify ?? [...row.details],
      pointsToClarifyJson: summary?.pointsToClarify ?? [...row.details],
      resolutionStepsJson: summary?.resolutionSteps ?? [],
      latestKnownEvent: summary?.latestKnownEvent ?? row.event,
      latestKnownEventAt: summary?.latestKnownEventAt
        ? new Date(`${summary.latestKnownEventAt}T12:00:00Z`)
        : row.date && !summary
          ? new Date(`${row.date}T12:00:00Z`)
          : null,
      eventResult: summary?.eventResult ?? null,
      latestJudicialEvent: summary?.latestJudicialEvent ?? null,
      latestJudicialEventAt: summary?.latestJudicialEventAt
        ? new Date(`${summary.latestJudicialEventAt}T12:00:00Z`)
        : null,
      judicialResult: summary?.judicialResult ?? null,
      nextScheduledEventAt: summary?.nextScheduledEventAt
        ? new Date(`${summary.nextScheduledEventAt}T12:00:00Z`)
        : null,
      courtReached: summary?.courtReached ?? "À confirmer",
      dataFreshness: summary?.dataFreshness ?? "Situation à actualiser",
      summarySourceMeta: summary?.sourceMeta
        ? { ...summary.sourceMeta, importedAt: new Date().toISOString() }
        : undefined,
      isPrincipal: summary?.isPrincipal ?? row.reference !== "R 16605/31",
      lastUpdatedById: admin.id,
    } as const;
    const item = await prisma.requisition.upsert({
      where: { reference: row.reference },
      update: data,
      create: { reference: row.reference, ...data, createdById: admin.id },
    });
    refs.set(row.reference, item.id);
  }

  await prisma.requisitionRelation.upsert({
    where: {
      sourceRequisitionId_targetRequisitionId_relationType: {
        sourceRequisitionId: refs.get("R 20612/31")!,
        targetRequisitionId: refs.get("R 16605/31")!,
        relationType: "RECIPROQUE_CHEVAUCHEMENT",
      },
    },
    update: {},
    create: {
      sourceRequisitionId: refs.get("R 20612/31")!,
      targetRequisitionId: refs.get("R 16605/31")!,
      relationType: "RECIPROQUE_CHEVAUCHEMENT",
      description: "Superposition certifiée à obtenir; aucune conclusion foncière n'est présumée.",
    },
  });
  const legacyRelation = await prisma.requisitionRelation.findFirst({
    where: {
      sourceRequisitionId: refs.get("R 20612/31")!,
      targetRequisitionId: refs.get("R 16605/31")!,
      relationType: "CHEVAUCHEMENT_POTENTIEL",
    },
  });
  if (legacyRelation) {
    await prisma.requisitionRelation.update({
      where: { id: legacyRelation.id },
      data: { relationType: "RECIPROQUE_CHEVAUCHEMENT" },
    });
  }

  const assignedRefs = [
    "R 148026/31",
    "R 20612/31",
    "R 20696/31",
    "R 20657/31",
    "R 20611/31",
    "R 20629/31",
  ] as const;
  await prisma.userRequisitionAccess.deleteMany({ where: { userId: demoUser.id } });
  for (const reference of assignedRefs) {
    await prisma.userRequisitionAccess.create({
      data: {
        userId: demoUser.id,
        requisitionId: refs.get(reference)!,
        createdById: admin.id,
      },
    });
  }

  if ((await prisma.opposition.count()) === 0) {
    await prisma.opposition.createMany({
      data: [
        {
          requisitionId: refs.get("R 20696/31")!,
          oppositionNumber: 1,
          opponentName: null,
          identityStatus: "A_CONFIRMER",
          type: "PARTIELLE",
          scope: "Environ 37 ha 80 a — à confirmer",
          description: "Pièces intégrales à obtenir.",
          ancfccStatus: "Enregistrée",
          courtStatus: "Transmise",
          riskLevel: "CRITIQUE",
          strategy: "DEMANDER_DES_PIECES",
        },
        {
          requisitionId: refs.get("R 20612/31")!,
          oppositionNumber: 1,
          opponentName: "Commune de Mesti",
          identityStatus: "A_CONFIRMER",
          type: "INSTITUTIONNELLE",
          scope: "À confirmer",
          description: "Opposition institutionnelle signalée dans les sources.",
          ancfccStatus: "À confirmer",
          courtStatus: "Transmise",
          riskLevel: "CRITIQUE",
          strategy: "ANALYSER",
        },
      ],
    });
  }
  if ((await prisma.legalCase.count()) === 0) {
    for (const [reference, caseNumber, phase] of [
      ["R 20629/31", "2025/1403/237", "Instruction"],
      ["R 20611/31", "2025/1403/238", "Au tribunal — situation à actualiser"],
      ["R 20612/31", "2025/1403/249", "Instruction"],
      ["R 20612/31", "2025/1403/250", "Instruction"],
      ["R 20696/31", "2024/1403/79", "Moudawala — résultat à renseigner"],
    ] as const) {
      await prisma.legalCase.create({
        data: {
          requisitionId: refs.get(reference)!,
          caseNumber,
          courtName: "Tribunal de première instance de Guelmim",
          caseType: "Foncier",
          currentPhase: phase,
          opposingParties: "À confirmer",
          outcomeStatus: "À confirmer",
        },
      });
    }
  }
  if ((await prisma.hearing.count()) === 0) {
    await prisma.hearing.createMany({
      data: [
        {
          requisitionId: refs.get("R 20696/31")!,
          eventType: "MOUDAWALA",
          title: "Moudawala annoncée — résultat à renseigner",
          scheduledAt: new Date("2026-07-08T09:00:00Z"),
          status: "SUIVI_REQUIS",
        },
        {
          requisitionId: refs.get("R 20612/31")!,
          eventType: "AUDIENCE",
          title: "Audience annoncée — compte rendu à renseigner",
          scheduledAt: new Date("2026-07-15T09:00:00Z"),
          status: "SUIVI_REQUIS",
        },
        {
          requisitionId: refs.get("R 20611/31")!,
          eventType: "ECHEANCE_DOCUMENTAIRE",
          title: "Événement judiciaire mentionné — nature à clarifier",
          scheduledAt: new Date("2026-07-22T09:00:00Z"),
          status: "A_CONFIRMER",
        },
      ],
    });
  }
  if ((await prisma.actionItem.count()) === 0) {
    for (const row of records.slice(0, 6)) {
      await prisma.actionItem.create({
        data: {
          requisitionId: refs.get(row.reference),
          title: row.next,
          category: "COORDINATION",
          priority: row.rank <= 3 ? "URGENTE" : "HAUTE",
          createdById: admin.id,
          responsibleUserId: admin.id,
        },
      });
    }
  }
  if ((await prisma.documentRequest.count()) === 0) {
    for (const reference of ["R 148026/31", "R 20612/31", "R 20696/31", "R 20657/31", "R 20611/31", "R 20629/31"]) {
      await prisma.documentRequest.create({
        data: {
          requisitionId: refs.get(reference)!,
          requestedDocumentTitle: "Dossier source complet — à obtenir",
          category: "AUTRE",
          priority: "HAUTE",
          status: "A_DEMANDER",
          notes: "Aucun binaire fictif n'est créé par le seed.",
        },
      });
    }
  }

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [admin.id, demoUser.id] },
      title: {
        in: [
          "Résultat de moudawala à confirmer",
          "Compte rendu d'audience manquant",
          "Échéance du 22/07/2026",
          "Bornage bloqué — suivi assigné",
          "Audience à suivre sur dossier assigné",
        ],
      },
    },
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        requisitionId: refs.get("R 20696/31"),
        type: "CRITICAL",
        title: "Résultat de moudawala à confirmer",
        message: "Le suivi du 08/07/2026 est en retard.",
      },
      {
        userId: admin.id,
        requisitionId: refs.get("R 20612/31"),
        type: "CRITICAL",
        title: "Compte rendu d'audience manquant",
        message: "Audience du 15/07/2026.",
      },
      {
        userId: admin.id,
        requisitionId: refs.get("R 20611/31"),
        type: "WARNING",
        title: "Échéance du 22/07/2026",
        message: "La nature de l'échéance reste à clarifier.",
      },
      {
        userId: demoUser.id,
        requisitionId: refs.get("R 148026/31"),
        type: "WARNING",
        title: "Bornage bloqué — suivi assigné",
        message: "Votre dossier R 148026/31 nécessite un suivi de consultation.",
      },
      {
        userId: demoUser.id,
        requisitionId: refs.get("R 20612/31"),
        type: "INFO",
        title: "Audience à suivre sur dossier assigné",
        message: "Consultation seule — R 20612/31.",
      },
    ],
  });

  if ((await prisma.report.count({ where: { deletedAt: null, documentId: { not: null } } })) === 0) {
    console.log(
      "Seed: aucun rapport fichier; les brouillons « Seed de développement » ne sont plus créés.",
    );
  }

  console.log(
    `Seed terminé: ${records.length} réquisitions, rôles ADMIN/USER. Comptes: admin@naala-foncier.ma, user@naala-foncier.ma (assigné à ${assignedRefs.join(", ")}).`,
  );
}

main().finally(() => prisma.$disconnect());
