/**
 * Apply visual-classification-overrides.json onto document-assets-manifest.json
 * and regenerate DOCUMENT_IMPORT_REVIEW.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "private-import", "extracted");
const MANIFEST = path.join(OUT, "document-assets-manifest.json");
const OVERRIDES = path.join(OUT, "visual-classification-overrides.json");
const REVIEW = path.join(ROOT, "private-import", "DOCUMENT_IMPORT_REVIEW.md");

const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
const overrides = JSON.parse(await fs.readFile(OVERRIDES, "utf8"));

for (const a of manifest.assets) {
  if (a.sourcePresentationRole === "presentation2") {
    Object.assign(a, {
      importDecision: overrides.presentation2Policy.importDecision,
      uncertaintyReason: overrides.presentation2Policy.uncertaintyReason,
      category: null,
      proposedTitle: null,
      requisitionReference: null,
    });
    continue;
  }
  const key = `${a.sourcePresentationRole}|${a.sourceSlide}|${a.sourceMediaPath}`;
  const o = overrides.overrides[key];
  if (!o) continue;
  Object.assign(a, o);
}

manifest.counts = {
  total: manifest.assets.length,
  import: manifest.assets.filter((a) => a.importDecision === "import").length,
  review: manifest.assets.filter((a) => a.importDecision === "review").length,
  skip: manifest.assets.filter((a) => a.importDecision === "skip").length,
};
manifest.visualOverridesAppliedAt = new Date().toISOString();
manifest.judicialHints = overrides.judicialHints;
manifest.generatedAt = new Date().toISOString();

await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");

const lines = [];
lines.push("# DOCUMENT IMPORT REVIEW — Embedded presentation assets");
lines.push("");
lines.push(`Generated: ${manifest.generatedAt}`);
lines.push(`Visual overrides applied: ${manifest.visualOverridesAppliedAt}`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- Assets extracted: **${manifest.counts.total}**`);
lines.push(`- Ready to import: **${manifest.counts.import}**`);
lines.push(`- Needs review (not auto-uploaded): **${manifest.counts.review}**`);
lines.push(`- Skip (decoration / portfolio synthesis): **${manifest.counts.skip}**`);
lines.push("");
lines.push("## Important");
lines.push("");
lines.push("- Large PPTX containers are **not** uploaded.");
lines.push("- Only visually confirmed / structurally confirmed scans with `importDecision=import` will be uploaded.");
lines.push("- Presentation2 slide images remain **skip** (portfolio synthesis, not legal source docs).");
lines.push("- Duplicate portfolio RAPPORTS Document rows must be cleaned to a single PORTFOLIO Report link.");
lines.push("");
lines.push("## Presentation 1 — sections");
lines.push("");
for (const sec of manifest.sectionsPresentation1 || []) {
  lines.push(`- Slides ${sec.start}–${sec.end}: **${sec.reference}**${sec.linkedRefs?.length ? ` (linked ${sec.linkedRefs.join(", ")})` : ""}`);
}
lines.push("");
lines.push("## Asset table");
lines.push("");
lines.push("| Slide | Requisition | Proposed document | Category | Group | Decision | Reason |");
lines.push("|------:|-------------|-------------------|----------|-------|----------|--------|");
for (const a of manifest.assets.filter((x) => x.sourcePresentationRole === "presentation1")) {
  lines.push(
    `| ${a.sourceSlide} | ${a.requisitionReference ?? "—"} | ${a.proposedTitle ?? "—"} | ${a.category ?? "—"} | ${a.groupedDocumentId ?? "—"} | **${a.importDecision}** | ${(a.uncertaintyReason ?? "").replace(/\|/g, "/")} |`,
  );
}
lines.push("");
lines.push("## Review / unmapped");
lines.push("");
for (const a of manifest.assets.filter((x) => x.importDecision === "review")) {
  lines.push(`- Slide ${a.sourceSlide} · ${a.requisitionReference ?? "n/a"} · \`${a.extractedLocalPath}\` — ${a.uncertaintyReason}`);
}
lines.push("");
lines.push("## Judicial hints (from sources — results not invented)");
lines.push("");
for (const j of manifest.judicialHints || []) {
  lines.push(
    `- ${j.requisitionReference} · ${j.caseNumber ?? "—"} · ${j.eventDate ?? "—"} · ${j.eventLabel} · **${j.importDecision}**${j.note ? ` — ${j.note}` : ""}`,
  );
}
lines.push("");
lines.push("## Commands");
lines.push("");
lines.push("```bash");
lines.push("npx tsx scripts/import-source-documents.ts --dry-run-documents");
lines.push("npx tsx scripts/import-source-documents.ts --import-documents");
lines.push("npx tsx scripts/import-source-documents.ts --import-judicial-events");
lines.push("```");
lines.push("");

await fs.writeFile(REVIEW, lines.join("\n"), "utf8");
console.log("Updated manifest + review", manifest.counts);
