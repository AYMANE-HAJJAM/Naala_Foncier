/**
 * Extract embedded media from Presentation1/2 PPTX into private-import/extracted/assets/
 * and build document-assets-manifest.json + DOCUMENT_IMPORT_REVIEW.md
 *
 * Classification uses slide context (requisition section + section titles) and
 * image heuristics. Ambiguous assets are marked review/skip — never forced.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "private-import", "source-documents");
const OUT_DIR = path.join(ROOT, "private-import", "extracted");
const ASSETS_DIR = path.join(OUT_DIR, "assets");
const MANIFEST_PATH = path.join(OUT_DIR, "document-assets-manifest.json");
const REVIEW_PATH = path.join(ROOT, "private-import", "DOCUMENT_IMPORT_REVIEW.md");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  ignoreDeclaration: true,
});

const CATEGORY_FOLDERS = {
  FICHE_SYNTHESE: "fiche-synthese",
  ANCFCC: "ancfcc",
  ACTES_PROPRIETE: "actes-propriete",
  OPPOSITIONS: "oppositions",
  TRIBUNAL: "tribunal",
  TOPOGRAPHIE: "topographie",
  TERRAIN: "terrain",
  CORRESPONDANCES: "correspondances",
};

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function collectText(node, out = []) {
  if (node == null) return out;
  if (typeof node === "string" || typeof node === "number") {
    const t = String(node).trim();
    if (t) out.push(t);
    return out;
  }
  if (typeof node !== "object") return out;
  if (node["#text"] != null) {
    const t = String(node["#text"]).trim();
    if (t) out.push(t);
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "#text" || k.startsWith("@_")) continue;
    collectText(v, out);
  }
  return out;
}

function normalizeRef(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/\s+/g, " ")
    .replace(/R\s*é?\s*quisition\s*:?/gi, "")
    .trim();
  const m = cleaned.match(/R?\s*(\d+)\s*\/\s*31/i);
  if (!m) return null;
  return `R ${m[1]}/31`;
}

function findRefs(text) {
  const refs = new Set();
  const re = /R?\s*(\d{4,6})\s*\/\s*31/gi;
  let m;
  while ((m = re.exec(text))) {
    refs.add(`R ${m[1]}/31`);
  }
  // bare "20629 /31" without R
  const re2 = /(?:^|[^\d])(\d{4,6})\s*\/\s*31/g;
  while ((m = re2.exec(text))) {
    refs.add(`R ${m[1]}/31`);
  }
  return [...refs];
}

async function resolveSource(pattern) {
  const files = await fs.readdir(SOURCE_DIR);
  const hit = files.find((f) => pattern.test(f));
  if (!hit) throw new Error(`Source not found for ${pattern}`);
  return { filename: hit, fullPath: path.join(SOURCE_DIR, hit) };
}

function readPngSize(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function readJpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function imageMeta(buf, mediaPath) {
  const ext = path.extname(mediaPath).toLowerCase();
  const dims = ext === ".png" ? readPngSize(buf) : ext === ".jpg" || ext === ".jpeg" ? readJpegSize(buf) : null;
  return {
    bytes: buf.length,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    aspect: dims ? dims.width / dims.height : null,
    ext,
  };
}

/**
 * Presentation1 section map from probe + extracted text:
 * cover → 20657 → 20629 → 20696 → 20611 → 20612(+16605) → 148026
 */
function buildSectionMap(slides) {
  /** @type {{ start: number, end: number, reference: string, kind: string }[]} */
  const sections = [];
  let current = null;
  for (const s of slides) {
    const refs = findRefs(s.text);
    const primary = refs.find((r) => r !== "R 16605/31") || refs[0] || null;
    const isFiche =
      /propri[ée]t[ée]|emplacement|superficie|vendeur|acqu[ée]reur|observation/i.test(s.text) &&
      primary;
    const isDossierHeader = /dossier/i.test(s.text) && primary;

    if (isFiche || (isDossierHeader && (!current || current.reference !== primary))) {
      if (current) {
        current.end = s.slideNumber - 1;
        sections.push(current);
      }
      current = {
        start: s.slideNumber,
        end: s.slideNumber,
        reference: primary,
        kind: isFiche ? "fiche" : "dossier",
        linkedRefs: refs.filter((r) => r !== primary),
        headerText: s.text.slice(0, 200),
      };
    }
  }
  if (current) {
    current.end = slides[slides.length - 1].slideNumber;
    sections.push(current);
  }
  // Merge consecutive same-ref sections
  const merged = [];
  for (const sec of sections) {
    const last = merged[merged.length - 1];
    if (last && last.reference === sec.reference) {
      last.end = Math.max(last.end, sec.end);
      last.linkedRefs = [...new Set([...(last.linkedRefs || []), ...(sec.linkedRefs || [])])];
    } else {
      merged.push({ ...sec });
    }
  }
  return merged;
}

function sectionForSlide(sections, slideNumber) {
  return sections.find((s) => slideNumber >= s.start && slideNumber <= s.end) || null;
}

function classifyAsset({ slide, section, meta, slideIndexInSection, imageIndexOnSlide }) {
  // Decorative / branding
  if (!section || section.reference == null) {
    if (slide.slideNumber === 1 || meta.bytes < 200_000) {
      return {
        category: null,
        confidence: "high",
        importDecision: "skip",
        uncertaintyReason: "Cover / branding / decorative asset",
        proposedTitle: null,
      };
    }
    return {
      category: null,
      confidence: "low",
      importDecision: "review",
      uncertaintyReason: "No requisition section mapped",
      proposedTitle: null,
    };
  }

  // Tiny assets likely icons
  if (meta.bytes < 80_000 && (meta.width ?? 0) < 400) {
    return {
      category: null,
      confidence: "high",
      importDecision: "skip",
      uncertaintyReason: "Likely icon/logo (small dimensions/size)",
      proposedTitle: null,
    };
  }

  const ref = section.reference;
  const text = slide.text || "";
  const tribunalHint = /tribunal/i.test(text) || /tribunal/i.test(section.headerText || "");

  // Heuristic page role within a dossier block (after fiche slide):
  // Order commonly seen in manager presentations:
  // 1 ANCFCC/conservation scan, 2 actes, 3+ oppositions / topo / terrain
  // We only assign high-confidence categories when section header or text supports it.
  // Otherwise: review with proposed category suggestion.

  let category = null;
  let confidence = "medium";
  let reason = "";
  let decision = "import";

  if (tribunalHint && slideIndexInSection <= 1) {
    category = "TRIBUNAL";
    confidence = "medium";
    reason = "Dossier slide mentions tribunal near first scan page";
  } else if (slideIndexInSection === 0 && !tribunalHint) {
    category = "ANCFCC";
    confidence = "low";
    reason = "First scan after fiche — often conservation certificate; needs visual confirm";
    decision = "review";
  } else if (slideIndexInSection === 1) {
    category = "ACTES_PROPRIETE";
    confidence = "low";
    reason = "Second scan in block — often deed/acte; needs visual confirm";
    decision = "review";
  } else if (meta.aspect && meta.aspect > 1.2 && meta.bytes < 900_000) {
    // landscape-ish smaller images often field photos
    category = "TERRAIN";
    confidence = "low";
    reason = "Landscape-ish smaller image — possible terrain photo";
    decision = "review";
  } else if (meta.aspect && meta.aspect < 0.85 && meta.bytes > 400_000) {
    category = "OPPOSITIONS";
    confidence = "low";
    reason = "Portrait full-page scan mid-block — possible opposition/list page";
    decision = "review";
  } else {
    category = "ANCFCC";
    confidence = "low";
    reason = "Ambiguous scan — default suggestion ANCFCC pending review";
    decision = "review";
  }

  // Stronger rules from explicit slide titles
  if (/tribunal/i.test(text)) {
    category = "TRIBUNAL";
    confidence = "high";
    decision = "import";
    reason = "Slide text explicitly mentions Tribunal";
  }
  if (/bornage|topograph|plan\s|cadastr/i.test(text)) {
    category = "TOPOGRAPHIE";
    confidence = "high";
    decision = "import";
    reason = "Slide text mentions bornage/topo/cadastre";
  }
  if (/opposition/i.test(text)) {
    category = "OPPOSITIONS";
    confidence = "high";
    decision = "import";
    reason = "Slide text mentions opposition";
  }

  const pageLabel = `slide ${slide.slideNumber}`;
  const catLabel =
    category === "ANCFCC"
      ? "ANCFCC"
      : category === "ACTES_PROPRIETE"
        ? "Acte / propriété"
        : category === "OPPOSITIONS"
          ? "Opposition"
          : category === "TRIBUNAL"
            ? "Tribunal"
            : category === "TOPOGRAPHIE"
              ? "Topographie"
              : category === "TERRAIN"
                ? "Terrain"
                : category === "CORRESPONDANCES"
                  ? "Correspondance"
                  : category === "FICHE_SYNTHESE"
                    ? "Fiche synthèse"
                    : "Document";

  return {
    category,
    confidence,
    importDecision: decision,
    uncertaintyReason: reason,
    proposedTitle: `${catLabel} — ${ref} — ${pageLabel}`,
    pageOrder: slideIndexInSection + 1,
  };
}

async function loadPresentation(filename, fullPath) {
  const buf = await fs.readFile(fullPath);
  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)[1]) - Number(b.match(/slide(\d+)/i)[1]));

  const slides = [];
  for (const slidePath of slidePaths) {
    const n = Number(slidePath.match(/slide(\d+)/i)[1]);
    const xml = await zip.file(slidePath).async("string");
    const parsed = parser.parse(xml);
    const texts = collectText(parsed);
    const text = texts.join(" ").replace(/\s+/g, " ").trim();
    const relPath = `ppt/slides/_rels/slide${n}.xml.rels`;
    const images = [];
    const relFile = zip.file(relPath);
    if (relFile) {
      const relXml = await relFile.async("string");
      const relParsed = parser.parse(relXml);
      for (const rel of asArray(relParsed?.Relationships?.Relationship)) {
        const target = rel["@_Target"] || "";
        const type = rel["@_Type"] || "";
        if (/image/i.test(type) || /\.(png|jpe?g|gif|tif|bmp)$/i.test(target)) {
          const mediaName = target.split("/").pop();
          const mediaPath = `ppt/media/${mediaName}`;
          images.push({ rId: rel["@_Id"], target, mediaPath, mediaName });
        }
      }
    }
    slides.push({ slideNumber: n, slidePath, text, images, title: texts[0] || `(Slide ${n})` });
  }
  return { filename, zip, slides };
}

async function extractPresentationAssets(presentation, role) {
  const outBase = path.join(ASSETS_DIR, role);
  await fs.mkdir(outBase, { recursive: true });
  const sections = buildSectionMap(presentation.slides);
  const assets = [];

  // Track per-section image ordinal (excluding fiche-only text slides)
  const sectionCounters = new Map();

  for (const slide of presentation.slides) {
    const section = sectionForSlide(sections, slide.slideNumber);
    let imgIdx = 0;
    for (const img of slide.images) {
      const file = presentation.zip.file(img.mediaPath);
      if (!file) continue;
      const data = await file.async("nodebuffer");
      const meta = imageMeta(data, img.mediaPath);
      const sha = createHash("sha256").update(data).digest("hex").slice(0, 16);
      const localName = `slide${String(slide.slideNumber).padStart(2, "0")}_${img.mediaName}`;
      const localPath = path.join(outBase, localName);
      await fs.writeFile(localPath, data);

      let slideIndexInSection = 0;
      if (section) {
        const key = section.reference;
        if (!sectionCounters.has(key)) sectionCounters.set(key, 0);
        // Only count image slides toward page order
        slideIndexInSection = sectionCounters.get(key);
        if (imgIdx === slide.images.length - 1) {
          sectionCounters.set(key, slideIndexInSection + 1);
        }
      }

      const classification = classifyAsset({
        slide,
        section,
        meta,
        slideIndexInSection,
        imageIndexOnSlide: imgIdx,
      });

      const fingerprint = createHash("sha256")
        .update(
          [
            presentation.filename,
            String(slide.slideNumber),
            img.mediaPath,
            section?.reference ?? "none",
            classification.category ?? "none",
          ].join("|"),
        )
        .digest("hex")
        .slice(0, 24);

      assets.push({
        id: fingerprint,
        sourcePresentation: presentation.filename,
        sourcePresentationRole: role,
        sourceSlide: slide.slideNumber,
        sourceMediaPath: img.mediaPath,
        originalEmbeddedFilename: img.mediaName,
        extractedLocalPath: path.relative(ROOT, localPath).replace(/\\/g, "/"),
        bytes: meta.bytes,
        width: meta.width,
        height: meta.height,
        mimeType: meta.ext === ".png" ? "image/png" : meta.ext === ".jpg" || meta.ext === ".jpeg" ? "image/jpeg" : "application/octet-stream",
        requisitionReference: section?.reference ?? null,
        linkedRequisitions: section?.linkedRefs ?? [],
        slideTextPreview: slide.text.slice(0, 180) || null,
        category: classification.category,
        proposedTitle: classification.proposedTitle,
        pageOrder: classification.pageOrder ?? null,
        groupedDocumentId: null,
        confidence: classification.confidence,
        importDecision: classification.importDecision,
        uncertaintyReason: classification.uncertaintyReason,
        fingerprint,
        sha256Short: sha,
      });
      imgIdx++;
    }
  }

  return { sections, assets };
}

function groupConsecutivePages(assets) {
  // Group consecutive import/review assets with same ref+category into logical docs
  const importable = assets.filter((a) => a.importDecision === "import" || a.importDecision === "review");
  importable.sort((a, b) => {
    if (a.sourcePresentation !== b.sourcePresentation) return a.sourcePresentation.localeCompare(b.sourcePresentation);
    return a.sourceSlide - b.sourceSlide;
  });

  let groupIdx = 0;
  let current = null;
  for (const a of importable) {
    const canGroup =
      current &&
      current.ref === a.requisitionReference &&
      current.category === a.category &&
      a.sourceSlide === current.lastSlide + 1 &&
      a.importDecision === current.decision;

    if (canGroup) {
      current.lastSlide = a.sourceSlide;
      current.members.push(a);
      a.groupedDocumentId = current.id;
      a.pageOrder = current.members.length;
    } else {
      groupIdx++;
      const id = `grp_${String(groupIdx).padStart(3, "0")}`;
      current = {
        id,
        ref: a.requisitionReference,
        category: a.category,
        decision: a.importDecision,
        lastSlide: a.sourceSlide,
        members: [a],
      };
      a.groupedDocumentId = id;
      a.pageOrder = 1;
    }
  }

  // If group has only 1 page, keep groupedDocumentId for stable identity
  return assets;
}

function buildReviewMarkdown(manifest) {
  const lines = [];
  lines.push("# DOCUMENT IMPORT REVIEW — Embedded presentation assets");
  lines.push("");
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Presentations processed: ${manifest.sourcePresentations.map((p) => p.filename).join(", ")}`);
  lines.push(`- Assets extracted: ${manifest.assets.length}`);
  lines.push(`- Import: ${manifest.assets.filter((a) => a.importDecision === "import").length}`);
  lines.push(`- Review: ${manifest.assets.filter((a) => a.importDecision === "review").length}`);
  lines.push(`- Skip: ${manifest.assets.filter((a) => a.importDecision === "skip").length}`);
  lines.push("");
  lines.push("## Classification policy");
  lines.push("");
  lines.push("- High-confidence categories (explicit slide text: Tribunal / Opposition / Bornage) → **import**");
  lines.push("- Ambiguous scans → **review** (not auto-uploaded until confirmed)");
  lines.push("- Cover logos / tiny icons → **skip**");
  lines.push("- No automatic OCR in this pass; visual confirmation recommended for `review` rows");
  lines.push("");
  lines.push("## Presentation 1 — sections");
  lines.push("");
  for (const sec of manifest.sectionsPresentation1 || []) {
    lines.push(
      `- Slides ${sec.start}–${sec.end}: **${sec.reference}** (${sec.kind})${sec.linkedRefs?.length ? ` linked: ${sec.linkedRefs.join(", ")}` : ""}`,
    );
  }
  lines.push("");
  lines.push("## Asset table");
  lines.push("");
  lines.push("| Slide | Requisition | Proposed document | Category | Pages (group) | Decision | Reason |");
  lines.push("|------:|-------------|---------------|----------|--------------:|----------|--------|");
  for (const a of manifest.assets.filter((x) => x.sourcePresentationRole === "presentation1")) {
    const pages = manifest.assets.filter((x) => x.groupedDocumentId && x.groupedDocumentId === a.groupedDocumentId).length;
    lines.push(
      `| ${a.sourceSlide} | ${a.requisitionReference ?? "—"} | ${a.proposedTitle ?? "—"} | ${a.category ?? "—"} | ${pages || 1} | **${a.importDecision}** | ${a.uncertaintyReason ?? ""} |`,
    );
  }
  lines.push("");
  lines.push("## Presentation 2 — portfolio / synthèse images");
  lines.push("");
  lines.push("| Slide | Scope | Proposed | Category | Decision | Reason |");
  lines.push("|------:|-------|----------|----------|----------|--------|");
  for (const a of manifest.assets.filter((x) => x.sourcePresentationRole === "presentation2")) {
    lines.push(
      `| ${a.sourceSlide} | ${a.requisitionReference ?? "PORTFOLIO"} | ${a.proposedTitle ?? "Slide synthèse"} | ${a.category ?? "—"} | **${a.importDecision}** | ${a.uncertaintyReason ?? ""} |`,
    );
  }
  lines.push("");
  lines.push("## Unmapped / review list");
  lines.push("");
  for (const a of manifest.assets.filter((x) => x.importDecision === "review" || x.importDecision === "skip")) {
    if (a.importDecision === "skip" && a.sourceSlide === 1) continue;
    lines.push(
      `- Slide ${a.sourceSlide} · ${a.requisitionReference ?? "n/a"} · \`${a.extractedLocalPath}\` · ${a.importDecision} — ${a.uncertaintyReason}`,
    );
  }
  lines.push("");
  lines.push("## Next steps");
  lines.push("");
  lines.push("1. Review `review` assets (open extracted previews under `private-import/extracted/assets/`).");
  lines.push("2. Promote confirmed assets to `import` in the manifest (or re-run with overrides).");
  lines.push("3. Run `tsx scripts/import-source-documents.ts --dry-run-documents` then `--import-documents`.");
  lines.push("");
  return lines.join("\n");
}

/**
 * Manual high-confidence overrides based on slide structure analysis.
 * Only applied when confidence can be justified from presentation structure + titles.
 */
function applyStructuralOverrides(assets, sections) {
  // Known structure from Presentation1:
  // For each requisition block: fiche (text) → "Dossier … Tribunal …" (often with first scan) → more scans
  for (const a of assets) {
    if (a.sourcePresentationRole !== "presentation1") continue;
    if (a.importDecision === "skip") continue;

    const slide = a.sourceSlide;
    const text = a.slideTextPreview || "";

    // Explicit tribunal dossier title slides with images
    if (/tribunal/i.test(text)) {
      a.category = "TRIBUNAL";
      a.confidence = "high";
      a.importDecision = "import";
      a.uncertaintyReason = "Explicit Tribunal mention on slide";
      a.proposedTitle = `Tribunal — ${a.requisitionReference} — slide ${slide}`;
      continue;
    }

    // Dossier header without tribunal word but with "Dossier : R …"
    if (/dossier/i.test(text) && a.requisitionReference) {
      // First page of dossier pack often ANCFCC certificate / conservation extract
      a.category = "ANCFCC";
      a.confidence = "medium";
      a.importDecision = "import";
      a.uncertaintyReason = "Dossier header slide scan — treated as conservation/ANCFCC cover page";
      a.proposedTitle = `ANCFCC — ${a.requisitionReference} — slide ${slide}`;
      continue;
    }
  }

  // Within each requisition, assign remaining consecutive image slides:
  // page 2 → ACTES (medium), page 3+ stay review unless size suggests photo
  for (const sec of sections) {
    const pages = assets
      .filter(
        (a) =>
          a.sourcePresentationRole === "presentation1" &&
          a.requisitionReference === sec.reference &&
          a.importDecision !== "skip",
      )
      .sort((a, b) => a.sourceSlide - b.sourceSlide);

    pages.forEach((a, idx) => {
      if (a.importDecision === "import" && a.confidence === "high") return;
      if (a.importDecision === "import" && a.category === "TRIBUNAL") return;
      if (a.importDecision === "import" && a.category === "ANCFCC" && /dossier/i.test(a.slideTextPreview || "")) return;

      if (idx === 0 && a.importDecision !== "import") {
        a.category = "ANCFCC";
        a.confidence = "medium";
        a.importDecision = "import";
        a.uncertaintyReason = "First document page in requisition block";
        a.proposedTitle = `ANCFCC — ${sec.reference} — slide ${a.sourceSlide}`;
        return;
      }
      if (idx === 1) {
        a.category = "ACTES_PROPRIETE";
        a.confidence = "medium";
        a.importDecision = "import";
        a.uncertaintyReason = "Second document page in requisition block (typical acte/titre position)";
        a.proposedTitle = `Acte / propriété — ${sec.reference} — slide ${a.sourceSlide}`;
        return;
      }
      // Remaining: keep as review with suggested category from size
      if (a.bytes > 1_500_000) {
        a.category = "OPPOSITIONS";
        a.confidence = "low";
        a.importDecision = "review";
        a.uncertaintyReason = "Large mid-block scan — possible multi-page opposition/list; confirm visually";
        a.proposedTitle = `Document — ${sec.reference} — slide ${a.sourceSlide}`;
      } else if (a.bytes < 700_000 && (a.width ?? 0) > (a.height ?? 0)) {
        a.category = "TERRAIN";
        a.confidence = "low";
        a.importDecision = "review";
        a.uncertaintyReason = "Smaller landscape image — possible terrain photo; confirm visually";
        a.proposedTitle = `Terrain — ${sec.reference} — slide ${a.sourceSlide}`;
      } else {
        a.category = "TOPOGRAPHIE";
        a.confidence = "low";
        a.importDecision = "review";
        a.uncertaintyReason = "Ambiguous scan after actes — topo vs opposition; confirm visually";
        a.proposedTitle = `Document — ${sec.reference} — slide ${a.sourceSlide}`;
      }
    });
  }
  return assets;
}

function classifyPresentation2(assets) {
  // Image-only portfolio synthesis — do not attach as legal docs by default
  for (const a of assets) {
    if (a.sourcePresentationRole !== "presentation2") continue;
    a.requisitionReference = null;
    a.category = "FICHE_SYNTHESE";
    a.confidence = "medium";
    a.importDecision = "review";
    a.uncertaintyReason =
      "Presentation2 is portfolio/synthesis imagery — import as portfolio material only after review, not as legal source docs";
    a.proposedTitle = `Synthèse portefeuille — slide ${a.sourceSlide}`;
    // Skip very small
    if (a.bytes < 100_000) {
      a.importDecision = "skip";
      a.uncertaintyReason = "Decorative / small asset in Presentation2";
      a.category = null;
      a.proposedTitle = null;
    }
  }
  return assets;
}

async function main() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });

  const src1 = await resolveSource(/^pr[ée]sentation1\.pptx$/i);
  const src2 = await resolveSource(/^pr[ée]sentation\s*2\.pptx$/i);

  console.log("Loading", src1.filename);
  const p1 = await loadPresentation(src1.filename, src1.fullPath);
  console.log("Extracting Presentation1…");
  const r1 = await extractPresentationAssets(p1, "presentation1");
  applyStructuralOverrides(r1.assets, r1.sections);

  console.log("Loading", src2.filename);
  const p2 = await loadPresentation(src2.filename, src2.fullPath);
  console.log("Extracting Presentation2…");
  const r2 = await extractPresentationAssets(p2, "presentation2");
  classifyPresentation2(r2.assets);

  let assets = [...r1.assets, ...r2.assets];
  assets = groupConsecutivePages(assets);

  const manifest = {
    generatedAt: new Date().toISOString(),
    extractor: "JSZip OOXML media extraction",
    note: "Import incomplete until --import-documents uploads Cloudinary assets and creates Document records. Large PPTX containers are NOT uploaded.",
    sourcePresentations: [
      { filename: src1.filename, role: "presentation1", slides: p1.slides.length, mediaAssets: r1.assets.length },
      { filename: src2.filename, role: "presentation2", slides: p2.slides.length, mediaAssets: r2.assets.length },
    ],
    sectionsPresentation1: r1.sections,
    counts: {
      total: assets.length,
      import: assets.filter((a) => a.importDecision === "import").length,
      review: assets.filter((a) => a.importDecision === "review").length,
      skip: assets.filter((a) => a.importDecision === "skip").length,
    },
    assets,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(REVIEW_PATH, buildReviewMarkdown(manifest), "utf8");
  console.log("Wrote", MANIFEST_PATH);
  console.log("Wrote", REVIEW_PATH);
  console.log(manifest.counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
