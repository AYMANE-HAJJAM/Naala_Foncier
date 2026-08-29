/**
 * Import extracted presentation assets (individual scans) into Cloudinary + Neon Documents.
 * Invoked via import-source-documents.ts flags:
 *   --extract-assets --review-assets --dry-run-documents --import-documents --import-judicial-events
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "../src/generated/prisma/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EXTRACTED = path.join(ROOT, "private-import", "extracted");
const ASSETS_MANIFEST = path.join(EXTRACTED, "document-assets-manifest.json");

const CATEGORY_FOLDER: Record<string, string> = {
  FICHE_SYNTHESE: "fiche-synthese",
  ANCFCC: "ancfcc",
  ACTES_PROPRIETE: "actes-propriete",
  OPPOSITIONS: "oppositions",
  TRIBUNAL: "tribunal",
  TOPOGRAPHIE: "topographie",
  TERRAIN: "terrain",
  CORRESPONDANCES: "correspondances",
};

type Asset = {
  id: string;
  fingerprint: string;
  sourcePresentation: string;
  sourcePresentationRole: string;
  sourceSlide: number;
  sourceMediaPath: string;
  originalEmbeddedFilename: string;
  extractedLocalPath: string;
  bytes: number;
  mimeType: string;
  requisitionReference: string | null;
  category: string | null;
  proposedTitle: string | null;
  pageOrder: number | null;
  groupedDocumentId: string | null;
  confidence: string;
  importDecision: "import" | "review" | "skip";
  uncertaintyReason?: string;
};

type AssetsManifest = {
  assets: Asset[];
  judicialHints?: Array<{
    requisitionReference: string;
    caseNumber?: string;
    eventDate?: string;
    eventLabel?: string;
    importDecision?: string;
    status?: string;
    nextAction?: string;
    note?: string;
  }>;
};

function log(msg: string) {
  console.log(msg);
}

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary env missing");
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return process.env.CLOUDINARY_UPLOAD_FOLDER ?? "naala-foncier";
}

function refFolder(reference: string) {
  return reference.replace(/\s+/g, "-").replace(/\//g, "-");
}

function fingerprintNote(fp: string) {
  return `import-fingerprint:${fp}`;
}

async function runNode(script: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", script)], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

export async function extractAssets() {
  await runNode("extract-presentation-assets.mjs");
  await runNode("apply-asset-overrides.mjs");
}

export async function reviewAssets() {
  const exists = await fs
    .access(ASSETS_MANIFEST)
    .then(() => true)
    .catch(() => false);
  if (!exists) await extractAssets();
  else await runNode("apply-asset-overrides.mjs");
  const manifest = JSON.parse(await fs.readFile(ASSETS_MANIFEST, "utf8")) as AssetsManifest;
  const counts = {
    import: manifest.assets.filter((a) => a.importDecision === "import").length,
    review: manifest.assets.filter((a) => a.importDecision === "review").length,
    skip: manifest.assets.filter((a) => a.importDecision === "skip").length,
  };
  log(`Assets review: import=${counts.import} review=${counts.review} skip=${counts.skip}`);
  log(`See private-import/DOCUMENT_IMPORT_REVIEW.md`);
  return manifest;
}

/** Soft-delete duplicate portfolio RAPPORTS Document rows; keep the one linked by PORTFOLIO Report. */
export async function dedupePortfolioReports(prisma: PrismaClient) {
  const portfolio = await prisma.report.findFirst({
    where: {
      scope: "PORTFOLIO",
      reportType: "RAPPORT_STRATEGIQUE_PORTEFEUILLE",
      deletedAt: null,
    },
  });
  const keepId = portfolio?.documentId ?? null;
  const dups = await prisma.document.findMany({
    where: {
      deletedAt: null,
      category: "RAPPORTS",
      title: { contains: "Rapport stratégique portefeuille" },
    },
  });
  let removed = 0;
  for (const d of dups) {
    if (keepId && d.id === keepId) continue;
    // If no keepId yet, keep the first and remove the rest
    if (!keepId && removed === 0 && dups[0]?.id === d.id) {
      if (portfolio) {
        await prisma.report.update({ where: { id: portfolio.id }, data: { documentId: d.id } });
      }
      continue;
    }
    if (!keepId && d.id === dups[0]?.id) continue;
    await prisma.document.update({
      where: { id: d.id },
      data: { deletedAt: new Date() },
    });
    removed++;
    log(`SOFT-DELETE duplicate portfolio RAPPORTS doc ${d.id} (${d.title})`);
  }
  log(`Portfolio RAPPORTS dedupe: kept=${keepId ?? dups[0]?.id ?? "none"} removed=${removed}`);
}

export async function planDocumentImport(prisma: PrismaClient, manifest: AssetsManifest) {
  const actions: Array<{ kind: string; detail: string }> = [];
  const importable = manifest.assets.filter((a) => a.importDecision === "import");
  const review = manifest.assets.filter((a) => a.importDecision === "review");
  const skip = manifest.assets.filter((a) => a.importDecision === "skip");

  for (const a of skip) {
    actions.push({ kind: "SKIP", detail: `decoration/portfolio slide ${a.sourceSlide} ${a.sourceMediaPath}` });
  }
  for (const a of review) {
    actions.push({
      kind: "FLAG",
      detail: `REVIEW ${a.requisitionReference} slide ${a.sourceSlide} ${a.category}: ${a.uncertaintyReason}`,
    });
  }

  for (const a of importable) {
    if (!a.requisitionReference || !a.category || !a.proposedTitle) {
      actions.push({ kind: "FLAG", detail: `Incomplete mapping for ${a.fingerprint}` });
      continue;
    }
    const existing = await prisma.documentVersion.findFirst({
      where: {
        notes: { contains: fingerprintNote(a.fingerprint) },
        document: { deletedAt: null },
      },
    });
    if (existing) {
      actions.push({
        kind: "SKIP",
        detail: `EXISTS ${a.requisitionReference} ${a.proposedTitle} (fingerprint ${a.fingerprint})`,
      });
      continue;
    }
    const overLimit = a.bytes > 10 * 1024 * 1024;
    actions.push({
      kind: overLimit ? "FLAG" : "UPLOAD",
      detail: `${a.requisitionReference} / ${a.category} / ${a.proposedTitle} (${a.bytes} bytes, slide ${a.sourceSlide})${overLimit ? " — exceeds 10MB" : ""}`,
    });
    if (!overLimit) {
      actions.push({
        kind: "CREATE",
        detail: `Document ${a.proposedTitle} → ${a.requisitionReference} [${a.category}]`,
      });
    }
  }
  return actions;
}

async function uploadAsset(absPath: string, folder: string, leaf: string, mimeType: string) {
  const result = await cloudinary.uploader.upload(absPath, {
    folder,
    public_id: leaf,
    resource_type: mimeType.startsWith("image/") ? "image" : "raw",
    type: "authenticated",
    overwrite: false,
    use_filename: false,
    unique_filename: false,
  });
  return result;
}

export async function importDocuments(prisma: PrismaClient, manifest: AssetsManifest, dryRun: boolean) {
  if (!dryRun) {
    await dedupePortfolioReports(prisma);
  } else {
    log("(dry-run) Would dedupe duplicate portfolio RAPPORTS Document rows");
  }
  const admin = await prisma.user.findFirst({
    where: { email: "admin@naala-foncier.ma", deletedAt: null },
  });
  if (!admin) throw new Error("Admin user missing");

  const actions = await planDocumentImport(prisma, manifest);
  log("\n========== DOCUMENT IMPORT PLAN ==========");
  const counts: Record<string, number> = {};
  for (const a of actions) {
    counts[a.kind] = (counts[a.kind] ?? 0) + 1;
    log(`${a.kind.padEnd(7)} ${a.detail}`);
  }
  log(`SUMMARY ${JSON.stringify(counts)}`);
  log("==========================================\n");

  if (dryRun) {
    log("Dry-run documents complete — no uploads.");
    return;
  }

  const folderRoot = configureCloudinary();
  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    select: { id: true, reference: true },
  });
  const byRef = new Map(requisitions.map((r) => [r.reference, r]));

  const importable = manifest.assets.filter(
    (a) =>
      a.importDecision === "import" &&
      a.requisitionReference &&
      a.category &&
      a.proposedTitle &&
      a.bytes <= 10 * 1024 * 1024,
  );

  let created = 0;
  let skipped = 0;
  for (const a of importable) {
    const existing = await prisma.documentVersion.findFirst({
      where: {
        notes: { contains: fingerprintNote(a.fingerprint) },
        document: { deletedAt: null },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const req = byRef.get(a.requisitionReference!);
    if (!req) {
      log(`FLAG missing requisition ${a.requisitionReference}`);
      continue;
    }
    const abs = path.join(ROOT, a.extractedLocalPath);
    const catFolder = CATEGORY_FOLDER[a.category!] ?? "autre";
    const folder = `${folderRoot}/requisitions/${refFolder(a.requisitionReference!)}/${catFolder}`;
    const leaf = randomUUID();
    log(`UPLOAD ${a.proposedTitle} → ${folder}/${leaf}`);
    const result = await uploadAsset(abs, folder, leaf, a.mimeType);
    const publicId = result.public_id;
    const buf = await fs.readFile(abs);
    const sha256 = createHash("sha256").update(buf).digest("hex");

    const doc = await prisma.document.create({
      data: {
        requisitionId: req.id,
        title: a.proposedTitle!,
        category: a.category as never,
        status: "DISPONIBLE",
        confidentiality: "INTERNE",
        visibility: "PARTAGE",
        description: [
          `Source: ${a.sourcePresentation}`,
          `Slide: ${a.sourceSlide}`,
          `Media: ${a.sourceMediaPath}`,
          a.groupedDocumentId ? `Group: ${a.groupedDocumentId}` : null,
          a.pageOrder ? `Page: ${a.pageOrder}` : null,
          a.uncertaintyReason ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdById: admin.id,
      },
    });

    const version = await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        storageProvider: "CLOUDINARY",
        storageBucket: process.env.CLOUDINARY_CLOUD_NAME ?? "",
        storageKey: `${publicId}__${a.fingerprint}`,
        originalFilename: a.originalEmbeddedFilename,
        mimeType: a.mimeType,
        sizeBytes: BigInt(result.bytes ?? a.bytes),
        sha256Checksum: sha256,
        pageCount: 1,
        uploadedById: admin.id,
        uploadedAt: new Date(),
        notes: `${fingerprintNote(a.fingerprint)} | slides:${a.sourceSlide} | presentation:${a.sourcePresentation}`,
        cloudinaryPublicId: publicId,
        cloudinaryAssetId: result.asset_id ?? null,
        cloudinaryVersion: result.version ? String(result.version) : null,
        cloudinaryResourceType: result.resource_type ?? "image",
        cloudinaryDeliveryType: "authenticated",
        format: result.format ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
      },
    });
    await prisma.document.update({
      where: { id: doc.id },
      data: { currentVersionId: version.id },
    });
    created++;
    log(`CREATED Document ${doc.id} ${a.proposedTitle}`);
  }
  log(`Import documents done: created=${created} skippedExisting=${skipped}`);
}

export async function importJudicialEvents(
  prisma: PrismaClient,
  manifest: AssetsManifest,
  dryRun: boolean,
) {
  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    include: { hearings: true, legalCases: { where: { deletedAt: null } } },
  });
  const byRef = new Map(requisitions.map((r) => [r.reference, r]));

  log("\n========== JUDICIAL EVENTS PLAN ==========");
  for (const h of manifest.judicialHints ?? []) {
    if (h.importDecision !== "import") {
      log(`FLAG    ${h.requisitionReference}: ${h.eventLabel} — ${h.note ?? h.importDecision}`);
      continue;
    }
    const req = byRef.get(h.requisitionReference);
    if (!req) {
      log(`FLAG    missing ${h.requisitionReference}`);
      continue;
    }
    const date = h.eventDate ? new Date(`${h.eventDate}T09:00:00Z`) : null;
    const already = req.hearings.some(
      (x) =>
        x.title.includes(h.eventLabel ?? "") &&
        date &&
        x.scheduledAt &&
        Math.abs(x.scheduledAt.getTime() - date.getTime()) < 86400000,
    );
    if (already) {
      log(`SKIP    Hearing already exists for ${h.requisitionReference} ${h.eventLabel} ${h.eventDate}`);
      continue;
    }
    log(
      `CREATE  Hearing ${h.requisitionReference} ${h.eventDate} ${h.eventLabel} status=SUIVI_REQUIS result=null nextAction="${h.nextAction}"`,
    );
    if (!dryRun) {
      const caseRow = h.caseNumber
        ? req.legalCases.find((c) => c.caseNumber === h.caseNumber) ?? null
        : null;
      await prisma.hearing.create({
        data: {
          requisitionId: req.id,
          legalCaseId: caseRow?.id ?? null,
          eventType: /moudawala/i.test(h.eventLabel ?? "")
            ? "MOUDAWALA"
            : /échéance|echeance/i.test(h.eventLabel ?? "")
              ? "ECHEANCE_DOCUMENTAIRE"
              : /audience|notification/i.test(h.eventLabel ?? "")
                ? "AUDIENCE"
                : "AUDIENCE",
          title: `${h.eventLabel} — résultat à mettre à jour`,
          description: `Import source présentation/rapport. Case ${h.caseNumber ?? "À confirmer"}. Résultat non inventé.`,
          scheduledAt: date,
          status: "SUIVI_REQUIS",
          result: null,
          nextAction: h.nextAction ?? "Compte rendu ou nouvelle situation à renseigner",
          visibility: "PARTAGE",
          createdById: (
            await prisma.user.findFirst({ where: { email: "admin@naala-foncier.ma" } })
          )?.id,
        },
      });
      log(`CREATED Hearing for ${h.requisitionReference}`);
    }
  }
  log("==========================================\n");
}

export async function runDocumentPipeline(flags: {
  extractAssets?: boolean;
  reviewAssets?: boolean;
  dryRunDocuments?: boolean;
  importDocuments?: boolean;
  importJudicialEvents?: boolean;
}) {
  if (flags.extractAssets) await extractAssets();
  const manifest =
    flags.reviewAssets || flags.dryRunDocuments || flags.importDocuments || flags.importJudicialEvents
      ? await reviewAssets()
      : null;
  if (!manifest) return;

  const prisma = createPrisma();
  try {
    if (flags.dryRunDocuments) {
      await importDocuments(prisma, manifest, true);
    }
    if (flags.importDocuments) {
      await importDocuments(prisma, manifest, false);
    }
    if (flags.importJudicialEvents) {
      await importJudicialEvents(prisma, manifest, false);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Allow direct execution
const isDirect = process.argv[1]?.replace(/\\/g, "/").endsWith("import-document-assets.ts");
if (isDirect) {
  const args = new Set(process.argv.slice(2));
  runDocumentPipeline({
    extractAssets: args.has("--extract-assets"),
    reviewAssets: args.has("--review-assets") || args.size === 0,
    dryRunDocuments: args.has("--dry-run-documents") || (!args.has("--import-documents") && !args.has("--import-judicial-events") && !args.has("--extract-assets")),
    importDocuments: args.has("--import-documents"),
    importJudicialEvents: args.has("--import-judicial-events"),
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
