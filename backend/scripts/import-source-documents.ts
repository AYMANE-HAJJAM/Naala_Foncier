/**
 * Controlled import of manager source documents (PPTX/DOCX) into Neon + Cloudinary.
 *
 * Flags:
 *   --extract-only   Rebuild extracted/*.md, import-manifest.json, IMPORT_REVIEW.md
 *   --dry-run        Plan actions only (default when no other action flag is set)
 *   --import-data    Upsert safe requisition / legal-case fields (never deletes)
 *   --upload-files   Upload originals to Cloudinary + create Document/Report metadata
 *   --extract-assets Extract embedded PPTX media + build document-assets-manifest.json
 *   --review-assets  Apply visual overrides + regenerate DOCUMENT_IMPORT_REVIEW.md
 *   --dry-run-documents  Plan Cloudinary uploads for extracted scans (no writes)
 *   --import-documents   Upload confirmed scans + create Document records
 *   --import-judicial-events  Create/update factual hearings only when source-supported
 *
 * Default: --dry-run
 * Never deletes Neon records. Never overwrites newer/manual non-placeholder data
 * with older document values. Uncertain facts stay "À confirmer" or are flagged.
 * Do NOT upload large PPTX containers — only extracted individual assets.
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
const SOURCE_DIR = path.join(ROOT, "private-import", "source-documents");
const EXTRACTED_DIR = path.join(ROOT, "private-import", "extracted");
const MANIFEST_PATH = path.join(EXTRACTED_DIR, "import-manifest.json");
const REVIEW_PATH = path.join(ROOT, "private-import", "IMPORT_REVIEW.md");

type ActionKind = "CREATE" | "UPDATE" | "SKIP" | "FLAG" | "UPLOAD";

type PlannedAction = {
  kind: ActionKind;
  entity: string;
  reference?: string;
  detail: string;
  destructive?: boolean;
};

type ManifestRequisition = {
  reference: string;
  propertyName: string | null;
  location: string | null;
  surface: string | null;
  seller: string | null;
  buyer: string | null;
  generalObservation: string | null;
  judicialStatus: string | null;
  tribunalCases: Array<{ number: string; court?: string | null }>;
  courtEvents: Array<{ date?: string | null; type?: string | null; title?: string | null }>;
  linkedRequisitions: string[];
  uncertainties: unknown[];
  sourceReferences: unknown[];
};

type Manifest = {
  generatedAt: string;
  sourceFiles: Array<{ filename: string; classification: string }>;
  requisitions: ManifestRequisition[];
};

const PLACEHOLDER = /^(à confirmer|a confirmer|n\/a|null|-|—|\s*)$/i;

const PORTFOLIO_FILES: Array<{
  match: RegExp;
  title: string;
  classification: string;
  category: "FICHE_SYNTHESE" | "RAPPORTS" | "AUTRE";
  reportType: string;
}> = [
  {
    match: /^pr[ée]sentation1\.pptx$/i,
    title: "Présentation 1 — Fiches et pièces initiales",
    classification: "Portfolio source / fiches et pièces initiales",
    category: "FICHE_SYNTHESE",
    reportType: "SOURCE_PORTEFEUILLE",
  },
  {
    match: /^pr[ée]sentation\s*2\.pptx$/i,
    title: "Présentation 2 — Synthèse portefeuille",
    classification: "Portfolio presentation / synthèse",
    category: "FICHE_SYNTHESE",
    reportType: "SYNTHESE_PORTEFEUILLE",
  },
  {
    match: /^rapport.*\.docx$/i,
    title: "Rapport stratégique portefeuille Naala / Enaala",
    classification: "Portfolio report / rapport stratégique",
    category: "RAPPORTS",
    reportType: "RAPPORT_STRATEGIQUE_PORTEFEUILLE",
  },
];

/** Tribunal cases unambiguously owned by a single requisition (from Presentation1). */
const SAFE_CASE_OWNERS: Record<string, string> = {
  "2025/1403/237": "R 20629/31",
  "2025/1403/238": "R 20611/31",
  "2025/1403/249": "R 20612/31",
  "2025/1403/250": "R 20612/31", // reciprocal with R 16605; unique caseNumber — already on 20612
  "2024/1403/79": "R 20696/31",
};

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const extractOnly = flags.has("--extract-only");
  const importData = flags.has("--import-data");
  const uploadFiles = flags.has("--upload-files");
  const extractAssets = flags.has("--extract-assets");
  const reviewAssets = flags.has("--review-assets");
  const dryRunDocuments = flags.has("--dry-run-documents");
  const importDocuments = flags.has("--import-documents");
  const importJudicialEvents = flags.has("--import-judicial-events");
  const assetMode =
    extractAssets || reviewAssets || dryRunDocuments || importDocuments || importJudicialEvents;
  const dryRunExplicit = flags.has("--dry-run");
  const dryRun =
    dryRunExplicit ||
    (!extractOnly && !importData && !uploadFiles && !assetMode);
  return {
    extractOnly,
    importData,
    uploadFiles,
    extractAssets,
    reviewAssets,
    dryRunDocuments,
    importDocuments,
    importJudicialEvents,
    assetMode,
    dryRun,
  };
}

function log(msg: string) {
  console.log(msg);
}

function runNode(scriptRel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", scriptRel)], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptRel} exited with code ${code}`));
    });
  });
}

function parseSurface(s: string | null | undefined): { ha: number; a: number; ca: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*ha(?:\s*(\d+)\s*a)?(?:\s*(\d+)\s*ca)?/i);
  if (!m) return null;
  return { ha: Number(m[1]), a: Number(m[2] ?? 0), ca: Number(m[3] ?? 0) };
}

function fmtSurface(ha: number, a: number, ca: number) {
  return `${ha} ha ${a} a ${ca} ca`;
}

function isPlaceholder(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return PLACEHOLDER.test(v.trim());
  if (typeof v === "number") return v === 0;
  return false;
}

function normalizeName(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function namesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a).replace(/\b(mr|mme|st|societe|société)\b/g, "").replace(/\s+/g, " ").trim();
  const nb = normalizeName(b).replace(/\b(mr|mme|st|societe|société)\b/g, "").replace(/\s+/g, " ").trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  // OCR spacing variants: "FE M ENTEL" vs "FEM ENTEL"
  if (na.replace(/\s/g, "") === nb.replace(/\s/g, "")) return true;
  // location: "Naala / Sidi Ifni" vs "Naala"
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary env vars missing (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return process.env.CLOUDINARY_UPLOAD_FOLDER ?? "naala-foncier";
}

async function listSourceFiles(): Promise<string[]> {
  const entries = await fs.readdir(SOURCE_DIR);
  return entries.filter((f) => /\.(pptx|docx)$/i.test(f));
}

function classifyFile(filename: string) {
  return PORTFOLIO_FILES.find((p) => p.match.test(filename));
}

async function planDataImport(
  prisma: PrismaClient,
  manifest: Manifest,
): Promise<PlannedAction[]> {
  const actions: PlannedAction[] = [];
  const neon = await prisma.requisition.findMany({
    where: { deletedAt: null },
    include: { legalCases: { where: { deletedAt: null } }, hearings: true },
  });
  const byRef = new Map(neon.map((r) => [r.reference, r]));

  for (const item of manifest.requisitions) {
    const existing = byRef.get(item.reference);
    if (!existing) {
      actions.push({
        kind: "CREATE",
        entity: "Requisition",
        reference: item.reference,
        detail: `Create requisition from sources (property=${item.propertyName}, location=${item.location})`,
      });
      continue;
    }

    const fieldPlan: Array<{
      field: string;
      neonVal: string | number | null;
      extracted: string | null;
      safe: boolean;
      reason?: string;
    }> = [
      {
        field: "propertyName",
        neonVal: existing.propertyName,
        extracted: item.propertyName,
        safe: true,
      },
      {
        field: "location",
        neonVal: existing.location,
        extracted: item.location,
        safe: true,
      },
      {
        field: "sellerName",
        neonVal: existing.sellerName,
        extracted: item.seller,
        safe: true,
      },
      {
        field: "buyerName",
        neonVal: existing.buyerName,
        extracted: item.buyer,
        safe: true,
      },
    ];

    for (const f of fieldPlan) {
      if (!f.extracted || isPlaceholder(f.extracted)) {
        actions.push({
          kind: "SKIP",
          entity: "Requisition",
          reference: item.reference,
          detail: `${f.field}: no reliable extracted value`,
        });
        continue;
      }
      if (namesEquivalent(String(f.neonVal), f.extracted)) {
        actions.push({
          kind: "SKIP",
          entity: "Requisition",
          reference: item.reference,
          detail: `${f.field}: already equivalent ("${f.neonVal}" ≈ "${f.extracted}")`,
        });
        continue;
      }
      if (!isPlaceholder(f.neonVal)) {
        actions.push({
          kind: "FLAG",
          entity: "Requisition",
          reference: item.reference,
          detail: `${f.field}: preserve Neon "${f.neonVal}" — do not overwrite with "${f.extracted}"`,
          destructive: true,
        });
        continue;
      }
      // R 16605 identity fields come from the reciprocal R 20612 slide — do not invent.
      if (item.reference === "R 16605/31") {
        actions.push({
          kind: "FLAG",
          entity: "Requisition",
          reference: item.reference,
          detail: `${f.field}: extracted from R 20612 reciprocal slide — leave "À confirmer" (do not auto-import)`,
        });
        continue;
      }
      actions.push({
        kind: "UPDATE",
        entity: "Requisition",
        reference: item.reference,
        detail: `${f.field}: "${f.neonVal}" → "${f.extracted}" (placeholder fill)`,
      });
    }

    const surf = parseSurface(item.surface);
    const neonSurf = fmtSurface(
      existing.surfaceHectares,
      existing.surfaceAres,
      existing.surfaceCentiares,
    );
    if (surf) {
      const extractedSurf = fmtSurface(surf.ha, surf.a, surf.ca);
      const neonEmpty =
        existing.surfaceHectares === 0 &&
        existing.surfaceAres === 0 &&
        existing.surfaceCentiares === 0;
      if (neonEmpty && item.reference === "R 16605/31") {
        actions.push({
          kind: "FLAG",
          entity: "Requisition",
          reference: item.reference,
          detail: `surface ${extractedSurf} comes from R 20612 fiche — do not copy onto linked file R 16605/31`,
          destructive: true,
        });
      } else if (neonEmpty) {
        actions.push({
          kind: "UPDATE",
          entity: "Requisition",
          reference: item.reference,
          detail: `surface: empty → ${extractedSurf}`,
        });
      } else if (namesEquivalent(neonSurf, extractedSurf) || neonSurf === extractedSurf) {
        actions.push({
          kind: "SKIP",
          entity: "Requisition",
          reference: item.reference,
          detail: `surface: already correct (${neonSurf})`,
        });
      } else {
        actions.push({
          kind: "FLAG",
          entity: "Requisition",
          reference: item.reference,
          detail: `surface: preserve Neon ${neonSurf} vs extracted ${extractedSurf}`,
          destructive: true,
        });
      }
    }

    if (item.generalObservation) {
      actions.push({
        kind: "FLAG",
        entity: "Requisition",
        reference: item.reference,
        detail: `generalObservation / judicialStatus kept for manual review (uncertain wording): "${item.generalObservation.slice(0, 120)}"`,
      });
    }

    // Tribunal cases — only when ownership is unambiguous and case missing
    const seenCases = new Set(existing.legalCases.map((c) => c.caseNumber));
    for (const tc of item.tribunalCases ?? []) {
      const owner = SAFE_CASE_OWNERS[tc.number];
      if (!owner) {
        actions.push({
          kind: "FLAG",
          entity: "LegalCase",
          reference: item.reference,
          detail: `case ${tc.number}: no safe owner mapping — skip auto-import`,
        });
        continue;
      }
      if (owner !== item.reference) {
        actions.push({
          kind: "FLAG",
          entity: "LegalCase",
          reference: item.reference,
          detail: `case ${tc.number}: belongs to ${owner}, not ${item.reference} (false association) — skip`,
          destructive: true,
        });
        continue;
      }
      if (seenCases.has(tc.number)) {
        actions.push({
          kind: "SKIP",
          entity: "LegalCase",
          reference: item.reference,
          detail: `case ${tc.number}: already present`,
        });
        continue;
      }
      // Global uniqueness: check if case exists on another dossier
      const elsewhere = neon.some((r) =>
        r.legalCases.some((c) => c.caseNumber === tc.number && r.reference !== item.reference),
      );
      if (elsewhere) {
        actions.push({
          kind: "FLAG",
          entity: "LegalCase",
          reference: item.reference,
          detail: `case ${tc.number}: already linked to another requisition (unique constraint) — skip`,
        });
        continue;
      }
      actions.push({
        kind: "CREATE",
        entity: "LegalCase",
        reference: item.reference,
        detail: `case ${tc.number} / court=${tc.court ?? "À confirmer"} / phase=À confirmer`,
      });
    }

    for (const ev of item.courtEvents ?? []) {
      actions.push({
        kind: "FLAG",
        entity: "Hearing",
        reference: item.reference,
        detail: `court event not auto-imported (date/status must be confirmed manually): ${JSON.stringify(ev)}`,
      });
    }
  }

  return actions;
}

async function planFileUploads(
  prisma: PrismaClient,
  sourceFiles: string[],
): Promise<PlannedAction[]> {
  const actions: PlannedAction[] = [];
  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    select: { id: true, reference: true },
  });
  const CLOUDINARY_MAX = 10 * 1024 * 1024;

  for (const filename of sourceFiles) {
    const meta = classifyFile(filename);
    if (!meta) {
      actions.push({
        kind: "FLAG",
        entity: "Document",
        detail: `${filename}: classification uncertain — skip upload`,
      });
      continue;
    }

    const existingVersion = await prisma.documentVersion.findFirst({
      where: {
        originalFilename: filename,
        document: { deletedAt: null },
      },
    });

    if (existingVersion) {
      actions.push({
        kind: "SKIP",
        entity: "Document",
        detail: `${filename}: already uploaded (documentId=${existingVersion.documentId}, publicId=${existingVersion.cloudinaryPublicId})`,
      });
      continue;
    }

    const stat = await fs.stat(path.join(SOURCE_DIR, filename));
    if (stat.size > CLOUDINARY_MAX) {
      actions.push({
        kind: "FLAG",
        entity: "Cloudinary",
        detail: `${filename}: ${stat.size} bytes exceeds Cloudinary plan limit (${CLOUDINARY_MAX}). Will create PORTFOLIO Report placeholder only — upgrade plan or compress before retry.`,
        destructive: false,
      });
      actions.push({
        kind: "CREATE",
        entity: "Report",
        detail: `PORTFOLIO placeholder "${meta.title} (upload en attente)" — no Document until upload succeeds`,
      });
      continue;
    }

    actions.push({
      kind: "UPLOAD",
      entity: "Cloudinary",
      detail: `${filename} → authenticated raw upload (${meta.classification})`,
    });
    actions.push({
      kind: "CREATE",
      entity: "Report",
      detail: `PORTFOLIO report "${meta.title}" (reportType=${meta.reportType}, requisitionId=null)`,
    });
    for (const r of requisitions) {
      actions.push({
        kind: "CREATE",
        entity: "Document",
        reference: r.reference,
        detail: `Link portfolio file "${filename}" as ${meta.category} on ${r.reference} (shared Cloudinary asset; unique storageKey per dossier)`,
      });
    }
  }

  return actions;
}

function printPlan(actions: PlannedAction[]) {
  const counts = { CREATE: 0, UPDATE: 0, SKIP: 0, FLAG: 0, UPLOAD: 0 };
  const destructive = actions.filter((a) => a.destructive);
  log("\n========== IMPORT PLAN ==========");
  for (const a of actions) {
    counts[a.kind]++;
    const ref = a.reference ? ` [${a.reference}]` : "";
    const tag = a.destructive ? " ⚠ DESTRUCTIVE-IF-APPLIED" : "";
    log(`${a.kind.padEnd(7)} ${a.entity}${ref}: ${a.detail}${tag}`);
  }
  log("---------- SUMMARY ----------");
  log(
    `CREATE=${counts.CREATE} UPDATE=${counts.UPDATE} SKIP=${counts.SKIP} FLAG=${counts.FLAG} UPLOAD=${counts.UPLOAD}`,
  );
  log(`Unresolved destructive flags: ${destructive.length}`);
  if (destructive.length) {
    log("Real --import-data will NOT overwrite conflicting Neon fields.");
    log("False tribunal associations and R 16605 identity/surface copies remain FLAG-only.");
  }
  log("================================\n");
  return { counts, destructive };
}

async function applyDataImport(
  prisma: PrismaClient,
  manifest: Manifest,
  actions: PlannedAction[],
  adminId: string,
) {
  const neon = await prisma.requisition.findMany({
    where: { deletedAt: null },
    include: { legalCases: { where: { deletedAt: null } } },
  });
  const byRef = new Map(neon.map((r) => [r.reference, r]));

  for (const action of actions.filter((a) => a.kind === "UPDATE" && a.entity === "Requisition")) {
    const m = action.detail.match(/^(\w+):/);
    if (!m || !action.reference) continue;
    const field = m[1];
    const item = manifest.requisitions.find((r) => r.reference === action.reference);
    const row = byRef.get(action.reference);
    if (!item || !row) continue;

    const data: Record<string, unknown> = { lastUpdatedById: adminId };
    if (field === "propertyName" && item.propertyName) data.propertyName = item.propertyName;
    if (field === "location" && item.location) data.location = item.location;
    if (field === "sellerName" && item.seller) data.sellerName = item.seller;
    if (field === "buyerName" && item.buyer) data.buyerName = item.buyer;
    if (field === "surface") {
      const surf = parseSurface(item.surface);
      if (surf) {
        data.surfaceHectares = surf.ha;
        data.surfaceAres = surf.a;
        data.surfaceCentiares = surf.ca;
      }
    }
    if (Object.keys(data).length <= 1) continue;
    await prisma.requisition.update({ where: { id: row.id }, data });
    log(`UPDATED ${action.reference} ${field}`);
  }

  for (const action of actions.filter((a) => a.kind === "CREATE" && a.entity === "LegalCase")) {
    if (!action.reference) continue;
    const row = byRef.get(action.reference);
    const m = action.detail.match(/case\s+(\d{4}\/\d+\/\d+)/);
    if (!row || !m) continue;
    const caseNumber = m[1];
    const exists = await prisma.legalCase.findUnique({ where: { caseNumber } });
    if (exists) {
      log(`SKIP LegalCase ${caseNumber} (exists)`);
      continue;
    }
    await prisma.legalCase.create({
      data: {
        requisitionId: row.id,
        caseNumber,
        courtName: "À confirmer",
        caseType: "Foncier",
        currentPhase: "À confirmer",
        currentStage: "A_CONFIRMER",
        opposingParties: "À confirmer",
        outcomeStatus: "À confirmer",
        generalObservation: "Importé depuis sources manager — à confirmer",
      },
    });
    log(`CREATED LegalCase ${caseNumber} → ${action.reference}`);
  }

  for (const action of actions.filter((a) => a.kind === "CREATE" && a.entity === "Requisition")) {
    if (!action.reference) continue;
    const item = manifest.requisitions.find((r) => r.reference === action.reference);
    if (!item) continue;
    const surf = parseSurface(item.surface) ?? { ha: 0, a: 0, ca: 0 };
    await prisma.requisition.upsert({
      where: { reference: item.reference },
      update: {},
      create: {
        reference: item.reference,
        propertyName: item.propertyName ?? "À confirmer",
        location: item.location ?? "À confirmer",
        province: "Sidi Ifni",
        surfaceHectares: surf.ha,
        surfaceAres: surf.a,
        surfaceCentiares: surf.ca,
        sellerName: item.seller ?? "À confirmer",
        buyerName: item.buyer ?? "À confirmer",
        riskLevel: "A_CONFIRMER",
        mainStatus: "A_CONFIRMER",
        mainIssue: item.generalObservation ?? "À confirmer",
        createdById: adminId,
        lastUpdatedById: adminId,
      },
    });
    log(`CREATED Requisition ${item.reference}`);
  }
}

async function applyFileUploads(prisma: PrismaClient, adminId: string, dryRun: boolean) {
  if (dryRun) return;
  const folderRoot = configureCloudinary();
  const sourceFiles = await listSourceFiles();
  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    select: { id: true, reference: true },
  });

  for (const filename of sourceFiles) {
    const meta = classifyFile(filename);
    if (!meta) {
      log(`FLAG skip unclassified ${filename}`);
      continue;
    }

    const already = await prisma.documentVersion.findFirst({
      where: { originalFilename: filename, document: { deletedAt: null } },
    });
    if (already) {
      log(`SKIP already uploaded ${filename}`);
      continue;
    }

    const filePath = path.join(SOURCE_DIR, filename);
    const buf = await fs.readFile(filePath);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const folder = `${folderRoot}/portfolio/source-documents`;
    const leafId = randomUUID();
    const expectedPublicId = `${folder}/${leafId}`;
    const mime =
      filename.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    // Skip Cloudinary attempt when over plan limit — placeholder report only (idempotent by title+type).
    if (buf.length > 10 * 1024 * 1024) {
      const existingPlaceholder = await prisma.report.findFirst({
        where: {
          scope: "PORTFOLIO",
          reportType: meta.reportType,
          deletedAt: null,
          title: { contains: "upload en attente" },
        },
      });
      if (existingPlaceholder) {
        log(`SKIP oversized placeholder already exists for ${filename}`);
        continue;
      }
      const sha = sha256;
      await prisma.report.create({
        data: {
          requisitionId: null,
          scope: "PORTFOLIO",
          reportType: meta.reportType,
          title: `${meta.title} (upload en attente)`,
          description: `${meta.classification}. Source filename: ${filename}. Cloudinary plan limit is 10MB; file is ${buf.length} bytes. Original kept in private-import only (not stored as app path). sha256=${sha}`,
          status: "BROUILLON",
          createdById: adminId,
        },
      });
      log(`CREATED PORTFOLIO Report placeholder (oversized): ${filename}`);
      continue;
    }

    log(`UPLOAD ${filename} (${buf.length} bytes) → ${expectedPublicId}`);
    const uploadOptions = {
      folder,
      public_id: leafId,
      resource_type: "raw" as const,
      type: "authenticated" as const,
      overwrite: false,
      use_filename: false,
      unique_filename: false,
    };

    let result: {
      public_id?: string;
      bytes?: number;
      asset_id?: string;
      version?: string | number;
      resource_type?: string;
      format?: string;
    };
    try {
      result = await cloudinary.uploader.upload(filePath, uploadOptions);
    } catch (err) {
          const message =
            err && typeof err === "object" && "message" in err
              ? String(err.message)
              : String(err);
          log(`FLAG UPLOAD FAILED ${filename}: ${message}`);
          await prisma.report.create({
            data: {
              requisitionId: null,
              scope: "PORTFOLIO",
              reportType: meta.reportType,
              title: `${meta.title} (upload en attente)`,
              description: `${meta.classification}. Source filename: ${filename}. Cloudinary upload failed (${message}). Original kept only in private-import until storage quota allows authenticated upload. sha256=${sha256}`,
              status: "BROUILLON",
              createdById: adminId,
            },
          });
          log(`CREATED PORTFOLIO Report placeholder for failed upload: ${filename}`);
          continue;
        }

    const publicId = result.public_id || expectedPublicId;
    if (!result.public_id || !result.bytes) {
      log(`FLAG UPLOAD incomplete response for ${filename}: ${JSON.stringify(result)}`);
      continue;
    }
    log(`UPLOAD OK ${filename} public_id=${publicId} bytes=${result.bytes}`);

    // Create one Document per requisition sharing the same Cloudinary asset (portfolio visibility).
    let firstDocumentId: string | null = null;
    for (const r of requisitions) {
      const doc = await prisma.document.create({
        data: {
          requisitionId: r.id,
          title: meta.title,
          category: meta.category,
          status: "DISPONIBLE",
          confidentiality: "CONFIDENTIEL",
          visibility: "INTERNE",
          description: `Document portefeuille — ${meta.classification}. Source: ${filename}. Non exclusif à ce dossier.`,
          createdById: adminId,
        },
      });
      const version = await prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          storageProvider: "CLOUDINARY",
          storageBucket: process.env.CLOUDINARY_CLOUD_NAME ?? "",
          storageKey: `${publicId}__${r.reference.replace(/[^\w]+/g, "_")}`,
          originalFilename: filename,
          mimeType: mime,
          sizeBytes: BigInt(result.bytes ?? buf.length),
          sha256Checksum: sha256,
          uploadedById: adminId,
          uploadedAt: new Date(),
          notes: `Import contrôlé source manager — ${meta.classification}`,
          cloudinaryPublicId: publicId,
          cloudinaryAssetId: result.asset_id ?? null,
          cloudinaryVersion: result.version ? String(result.version) : null,
          cloudinaryResourceType: result.resource_type ?? "raw",
          cloudinaryDeliveryType: "authenticated",
          format: result.format ?? null,
        },
      });
      await prisma.document.update({
        where: { id: doc.id },
        data: { currentVersionId: version.id },
      });
      if (!firstDocumentId) firstDocumentId = doc.id;
      log(`CREATED Document on ${r.reference} ← ${filename}`);
    }

    await prisma.report.create({
      data: {
        requisitionId: null,
        scope: "PORTFOLIO",
        reportType: meta.reportType,
        title: meta.title,
        description: `${meta.classification}. Source filename: ${filename}. Uploaded by ADMIN import script.`,
        documentId: firstDocumentId,
        status: "VALIDE",
        createdById: adminId,
        validatedById: adminId,
        validatedAt: new Date(),
      },
    });
    log(`CREATED PORTFOLIO Report "${meta.title}"`);
  }
}

async function appendDecisionToReview(summary: string) {
  const block = `\n\n## Import script decision\n\nGenerated: ${new Date().toISOString()}\n\n${summary}\n`;
  await fs.appendFile(REVIEW_PATH, block, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log(
    `Mode: extractOnly=${args.extractOnly} dryRun=${args.dryRun} importData=${args.importData} uploadFiles=${args.uploadFiles} extractAssets=${args.extractAssets} reviewAssets=${args.reviewAssets} dryRunDocuments=${args.dryRunDocuments} importDocuments=${args.importDocuments} importJudicialEvents=${args.importJudicialEvents}`,
  );

  if (args.assetMode) {
    const { runDocumentPipeline } = await import("./import-document-assets.js");
    await runDocumentPipeline({
      extractAssets: args.extractAssets,
      reviewAssets:
        args.reviewAssets ||
        args.dryRunDocuments ||
        args.importDocuments ||
        args.importJudicialEvents ||
        args.extractAssets,
      dryRunDocuments: args.dryRunDocuments && !args.importDocuments,
      importDocuments: args.importDocuments,
      importJudicialEvents: args.importJudicialEvents,
    });
    // If only asset flags, stop here (do not re-run legacy PPTX upload path).
    if (!args.importData && !args.uploadFiles && !args.extractOnly) return;
  }

  if (args.extractOnly || args.dryRun || args.importData || args.uploadFiles) {
    if (args.extractOnly || (!args.importData && !args.uploadFiles && args.dryRun)) {
      // Always refresh extraction for extract-only; for dry-run refresh if missing
      const needExtract =
        args.extractOnly ||
        !(await fs
          .access(MANIFEST_PATH)
          .then(() => true)
          .catch(() => false));
      if (args.extractOnly || needExtract) {
        log("→ Running extraction…");
        await runNode("extract-source-documents.mjs");
        log("→ Building manifest + Neon review…");
        await runNode("build-import-manifest.mjs");
      }
      if (args.extractOnly && !args.dryRun && !args.importData && !args.uploadFiles) {
        log("Extract-only complete.");
        return;
      }
    }
  }

  if (args.assetMode && !args.importData && !args.uploadFiles) return;

  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")) as Manifest;
  const sourceFiles = await listSourceFiles();
  log(`Sources on disk: ${sourceFiles.join(" | ")}`);
  log(`Manifest requisitions: ${manifest.requisitions.map((r) => r.reference).join(", ")}`);

  const prisma = createPrisma();
  try {
    const dataActions = await planDataImport(prisma, manifest);
    const fileActions = await planFileUploads(prisma, sourceFiles);
    const actions = [...dataActions, ...fileActions];
    const { counts, destructive } = printPlan(actions);

    // Destructive flags that would cause wrong data if blindly imported —
    // our apply path never applies FLAG actions, so dry-run "succeeds" when
    // there are no CREATE/UPDATE actions that themselves are destructive.
    const unresolvedDestructiveCreates = actions.filter(
      (a) => a.destructive && (a.kind === "CREATE" || a.kind === "UPDATE" || a.kind === "UPLOAD"),
    );

    const decision = [
      `- Planned CREATE=${counts.CREATE}, UPDATE=${counts.UPDATE}, SKIP=${counts.SKIP}, FLAG=${counts.FLAG}, UPLOAD=${counts.UPLOAD}`,
      `- Destructive FLAG items (blocked from auto-apply): ${destructive.length}`,
      `- Unresolved destructive CREATE/UPDATE/UPLOAD: ${unresolvedDestructiveCreates.length}`,
      `- Safe to run --import-data: ${unresolvedDestructiveCreates.length === 0 && counts.UPDATE + counts.CREATE > 0 ? "YES (placeholder fills + missing safe cases only)" : unresolvedDestructiveCreates.length === 0 ? "YES (no data changes needed, or uploads only)" : "NO"}`,
      `- Safe to run --upload-files: YES (portfolio docs; idempotent by originalFilename)`,
      `- Real import executed this run: data=${args.importData && !args.dryRun}, files=${args.uploadFiles && !args.dryRun}`,
    ].join("\n");

    log(decision);
    await appendDecisionToReview(decision);

    if (args.dryRun) {
      log("Dry-run complete — no Neon writes, no Cloudinary uploads.");
      if (unresolvedDestructiveCreates.length > 0) {
        log("⚠ Dry-run found unresolved destructive CREATE/UPDATE — abort real import.");
        process.exitCode = 2;
      }
      return;
    }

    if (unresolvedDestructiveCreates.length > 0) {
      log("Refusing real import: unresolved destructive CREATE/UPDATE remain.");
      process.exitCode = 2;
      return;
    }

    const admin = await prisma.user.findFirst({
      where: { isActive: true, deletedAt: null, roles: { some: { role: { key: "ADMIN" } } } },
    });
    if (!admin) throw new Error("Active ADMIN user not found");

    if (args.importData) {
      log("→ Applying safe data import…");
      await applyDataImport(prisma, manifest, actions, admin.id);
    }
    if (args.uploadFiles) {
      log("→ Uploading portfolio source files…");
      await applyFileUploads(prisma, admin.id, false);
    }
    log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
