import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PRINCIPAL_REFERENCES } from "../src/modules/requisitions/terrain-summaries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../private-import/FINAL_IMPORT_STATUS.md");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATEGORY_LABEL = {
  FICHE_SYNTHESE: "01 — Fiche synthèse",
  ANCFCC: "02 — ANCFCC",
  ACTES_PROPRIETE: "03 — Actes et propriété",
  OPPOSITIONS: "04 — Oppositions",
  TRIBUNAL: "05 — Tribunal",
  TOPOGRAPHIE: "06 — Topographie",
  TERRAIN: "07 — Terrain",
  CORRESPONDANCES: "08 — Correspondances",
  RAPPORTS: "Rapports (hors compte dossier)",
  AUTRE: "Autre",
};

const lines = [];
lines.push("# Final import status — six principal terrains");
lines.push("");
lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
lines.push("");
lines.push(
  "Source basis: Presentation1 embedded scans, Presentation2 (synthesis, not imported as dossier docs), strategic DOCX portfolio report.",
);
lines.push("");
lines.push("## Portfolio report");
const portfolio = await prisma.report.findFirst({
  where: {
    deletedAt: null,
    scope: "PORTFOLIO",
    documentId: { not: null },
  },
  include: { document: { include: { currentVersion: true } } },
});
if (portfolio?.document?.currentVersion) {
  lines.push(
    `- Linked: **${portfolio.title}** → Cloudinary \`${portfolio.document.currentVersion.cloudinaryPublicId}\``,
  );
  lines.push(
    `- Not counted in dossier document totals (category RAPPORTS / Reports tab).`,
  );
} else {
  lines.push("- **Missing** portfolio report with Cloudinary file.");
}
lines.push("");
lines.push("## Linked non-principal dossier");
const linked = await prisma.requisition.findFirst({
  where: { reference: "R 16605/31", deletedAt: null },
  include: {
    incomingRelations: { include: { source: true } },
    documents: { where: { deletedAt: null } },
  },
});
lines.push(
  `- R 16605/31 exists: **${Boolean(linked)}**; documents: **${linked?.documents.length ?? 0}** (expected: none exclusive).`,
);
lines.push(
  `- Linked from: ${
    linked?.incomingRelations.map((x) => x.source.reference).join(", ") || "—"
  }`,
);
lines.push("");

for (const reference of PRINCIPAL_REFERENCES) {
  const req = await prisma.requisition.findFirst({
    where: { reference, deletedAt: null },
    include: {
      documents: {
        where: { deletedAt: null },
        include: { currentVersion: true },
      },
      outgoingRelations: { include: { target: true } },
    },
  });
  lines.push(`## ${reference} — ${req?.propertyName ?? "?"}`);
  lines.push("");
  if (!req) {
    lines.push("- **MISSING from Neon**");
    lines.push("");
    continue;
  }
  const dossierDocs = req.documents.filter((d) => d.category !== "RAPPORTS");
  const byCat = {};
  for (const d of dossierDocs) {
    byCat[d.category] = (byCat[d.category] ?? 0) + 1;
  }
  lines.push(`- Identity: **${req.propertyName}** · ${req.location} · ${req.surfaceHectares} ha ${req.surfaceAres} a ${req.surfaceCentiares} ca`);
  lines.push(`- Public summary filled: **${Boolean(req.currentSituation)}**`);
  lines.push(`- Dossier documents (excl. RAPPORTS): **${dossierDocs.length}**`);
  lines.push("");
  lines.push("| Category | Count |");
  lines.push("|---|---:|");
  for (const [k, label] of Object.entries(CATEGORY_LABEL)) {
    if (k === "RAPPORTS") continue;
    const n = byCat[k] ?? 0;
    if (n > 0) lines.push(`| ${label} | ${n} |`);
  }
  lines.push("");
  lines.push("### Files");
  for (const d of dossierDocs) {
    const v = d.currentVersion;
    const ok = Boolean(v?.cloudinaryPublicId);
    lines.push(
      `- [${ok ? "OK" : "NO FILE"}] ${d.title} · ${d.category} · \`${v?.originalFilename ?? "—"}\``,
    );
  }
  if (req.outgoingRelations.length) {
    lines.push("");
    lines.push(
      `### Links: ${req.outgoingRelations.map((x) => `${x.relationType} → ${x.target.reference}`).join("; ")}`,
    );
  }
  lines.push("");
  if (dossierDocs.length === 0) {
    lines.push(
      "**Gap:** no imported dossier scans for this terrain — re-run presentation asset import if source slides contain exclusive documents.",
    );
    lines.push("");
  }
}

lines.push("## Known skipped / review assets (from prior import reviews)");
lines.push("");
lines.push("- Presentation2.pptx: synthesis deck — not imported as per-dossier documents.");
lines.push("- Oversized PPTX containers: not uploaded (Cloudinary size limit); individual embeds used instead.");
lines.push("- R 20696/31 slides 16–19: previously held in review (ambiguous classification).");
lines.push("- R 20612/31 slide 31: topography held in review.");
lines.push("- R 16605/31: no exclusive source scans; only reciprocal link from R 20612/31.");
lines.push("- Decorative slide graphics: skipped.");
lines.push("");
lines.push("## Cloudinary");
lines.push("");
lines.push("- Delivery: authenticated / signed URLs via backend.");
lines.push("- Portfolio DOCX and dossier scans use private folders under `naala-foncier/`.");
lines.push("");

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, lines.join("\n"), "utf8");
console.log("Wrote", OUT);
await prisma.$disconnect();
