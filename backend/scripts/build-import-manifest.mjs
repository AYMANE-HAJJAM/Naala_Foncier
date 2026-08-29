/**
 * Re-extract PPTX with paragraph-level text joining, then build
 * import-manifest.json + IMPORT_REVIEW.md against Neon (read-only).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const SOURCE_DIR = path.join(ROOT, "private-import", "source-documents");
const OUT_DIR = path.join(ROOT, "private-import", "extracted");
const REVIEW_PATH = path.join(ROOT, "private-import", "IMPORT_REVIEW.md");
const MANIFEST_PATH = path.join(OUT_DIR, "import-manifest.json");

const EXPECTED_REFS = [
  "R 20657/31",
  "R 20629/31",
  "R 20696/31",
  "R 20611/31",
  "R 20612/31",
  "R 148026/31",
  "R 16605/31",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  ignoreDeclaration: true,
});

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

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

function joinRuns(texts) {
  let out = "";
  for (const raw of texts) {
    const t = String(raw);
    if (!t) continue;
    if (!out) {
      out = t;
      continue;
    }
    if (/^[°\u0300-\u036f]/.test(t) || /^[,.;:/%)]/.test(t)) out += t;
    else if (/[(\[/]$/.test(out)) out += t;
    else if (/^\d/.test(t) && /\d$/.test(out)) out += t;
    else out += ` ${t}`;
  }
  return out.replace(/\s+/g, " ").trim();
}

function walkParagraphs(node, keyName, paragraphs = []) {
  if (node == null || typeof node !== "object") return paragraphs;
  for (const [k, v] of Object.entries(node)) {
    if (k === keyName) {
      for (const p of asArray(v)) {
        const text = joinRuns(collectText(p));
        if (text) paragraphs.push(text);
      }
    } else if (!k.startsWith("@_")) {
      walkParagraphs(v, keyName, paragraphs);
    }
  }
  return paragraphs;
}

function walkTables(node, rows = []) {
  if (node == null || typeof node !== "object") return rows;
  for (const [k, v] of Object.entries(node)) {
    if (k === "a:tr" || k === "w:tr") {
      for (const tr of asArray(v)) {
        const cells = [];
        for (const [ck, cv] of Object.entries(tr)) {
          if (ck === "a:tc" || ck === "w:tc") {
            for (const tc of asArray(cv)) cells.push(joinRuns(collectText(tc)));
          }
        }
        if (cells.some(Boolean)) rows.push(cells);
      }
    } else if (!k.startsWith("@_")) walkTables(v, rows);
  }
  return rows;
}

async function extractPptx(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)/i)[1]) - Number(b.match(/slide(\d+)/i)[1]),
    );
  const slides = [];
  for (const slidePath of slideFiles) {
    const num = Number(slidePath.match(/slide(\d+)/i)[1]);
    const parsed = parser.parse(await zip.file(slidePath).async("string"));
    const paragraphs = walkParagraphs(parsed, "a:p");
    slides.push({
      slideNumber: num,
      title: paragraphs[0] ?? `(Slide ${num})`,
      paragraphs,
      joinedText: paragraphs.join(" "),
      tables: walkTables(parsed),
      sourcePath: slidePath,
    });
  }
  return { kind: "pptx", slides };
}

async function extractDocx(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const parsed = parser.parse(await zip.file("word/document.xml").async("string"));
  return {
    kind: "docx",
    paragraphs: walkParagraphs(parsed, "w:p"),
    tables: walkTables(parsed),
  };
}

function normalizeRef(raw) {
  if (!raw) return null;
  const m = String(raw)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .match(/R?\s*(\d{4,6})\s*\/\s*31/);
  return m ? `R ${m[1]}/31` : null;
}

function emptyRecord(reference) {
  return {
    reference,
    propertyName: null,
    location: null,
    surface: null,
    seller: null,
    buyer: null,
    generalObservation: null,
    judicialStatus: null,
    tribunalCases: [],
    courtEvents: [],
    importantDates: [],
    linkedRequisitions: [],
    sourceDocuments: [],
    uncertainties: [],
    sourceReferences: [],
  };
}

function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addRef(rec, ref) {
  const key = JSON.stringify(ref);
  if (!rec.sourceReferences.some((x) => JSON.stringify(x) === key)) {
    rec.sourceReferences.push(ref);
  }
}

function ensureDoc(rec, filename, role) {
  if (!rec.sourceDocuments.some((s) => s.filename === filename)) {
    rec.sourceDocuments.push({ filename, role });
  }
}

function setFact(rec, field, value, sourceRef, uncertain = false) {
  if (value == null) return;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return;
  addRef(rec, sourceRef);
  if (rec[field] == null || rec[field] === "À confirmer") {
    rec[field] = cleaned;
    if (uncertain) {
      rec.uncertainties.push({ field, value: cleaned, reason: "uncertain wording", ...sourceRef });
    }
    return;
  }
  if (norm(rec[field]) !== norm(cleaned)) {
    rec.uncertainties.push({
      type: "conflict",
      field,
      existing: rec[field],
      incoming: cleaned,
      ...sourceRef,
    });
  }
}

function parseSurface(text) {
  const m = text.match(/(\d+)\s*[Hh][Aa]\s*(\d+)\s*[Aa]\s*(\d+)\s*[Cc][Aa]/);
  return m
    ? `${Number(m[1])} ha ${Number(m[2])} a ${Number(m[3])} ca`
    : null;
}

function parseTribunalNumbers(text) {
  const out = new Set();
  for (const m of text.matchAll(/(\d{4})\s*\/\s*1403\s*\/\s*(\d{2,4})/g)) {
    out.add(`${m[1]}/1403/${m[2]}`);
  }
  return [...out];
}

function parseDates(text) {
  const found = [];
  for (const m of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g)) {
    found.push({
      display: m[0],
      iso: `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`,
    });
  }
  const months = {
    janvier: "01", février: "02", fevrier: "02", mars: "03", avril: "04",
    mai: "05", juin: "06", juillet: "07", août: "08", aout: "08",
    septembre: "09", octobre: "10", novembre: "11", décembre: "12", decembre: "12",
  };
  for (const m of text.matchAll(
    /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/gi,
  )) {
    found.push({
      display: m[0],
      iso: `${m[3]}-${months[m[2].toLowerCase()]}-${String(m[1]).padStart(2, "0")}`,
    });
  }
  return found;
}

function absorbSlide(recMap, slide, sourceName, role) {
  const text = slide.joinedText || slide.paragraphs.join(" ");
  if (!text.trim()) return;
  const sourceRef = {
    sourceFilename: sourceName,
    slideNumber: slide.slideNumber,
    sourcePath: slide.sourcePath,
    originalText: text,
  };
  const refs = new Set();
  for (const m of text.matchAll(/R?\s*\d{4,6}\s*\/\s*31/gi)) {
    const ref = normalizeRef(m[0]);
    if (ref) refs.add(ref);
  }
  if (!refs.size) return;

  for (const reference of refs) {
    const rec = recMap.get(reference) ?? emptyRecord(reference);
    recMap.set(reference, rec);
    ensureDoc(rec, sourceName, role);
    addRef(rec, sourceRef);

    let m = text.match(
      /Propri[ée]t[ée]\s*:\s*(.+?)(?=\s+(?:Emplacement|EMPLACEMENT|E\s*mplacement|Superficie|Vendeur|Acqu|$))/i,
    );
    if (m) setFact(rec, "propertyName", m[1], sourceRef);

    m = text.match(
      /(?:Emplacement|EMPLACEMENT|E\s*mplacement)\s*:\s*(.+?)(?=\s+Superficie|\s+Vendeur|\s+Acqu|$)/i,
    );
    if (m) {
      let loc = m[1].replace(/\s+/g, " ").trim();
      if (/enaala/i.test(loc)) loc = /sidi\s*ifni/i.test(loc) ? "Enaala / Sidi Ifni" : "Enaala";
      else if (/naala/i.test(loc)) loc = /sidi\s*ifni/i.test(loc) ? "Naala / Sidi Ifni" : "Naala";
      setFact(rec, "location", loc, sourceRef);
    }

    const surface = parseSurface(text);
    if (surface) setFact(rec, "surface", surface, sourceRef);

    m = text.match(
      /Vendeur\s*:\s*(?:Mr|MR|M\.|Mme)?\s*([A-Za-z][A-Za-z '\-]+?)(?=\s+Acqu|\s+Observation|$)/i,
    );
    if (m) setFact(rec, "seller", m[1], sourceRef);

    m = text.match(
      /Acqu[ée]reur\s*:\s*(?:Mr|MR|M\.|Mme|St|ST)?\s*([A-Za-z][A-Za-z '\-]+?)(?=\s+Observation|$)/i,
    );
    if (m) setFact(rec, "buyer", m[1], sourceRef);

    m = text.match(/Observation\s*:\s*(.+)$/i);
    if (m) {
      const obs = m[1].replace(/\s+/g, " ").trim();
      setFact(rec, "generalObservation", obs, sourceRef, true);
      if (/tribunal/i.test(obs)) {
        setFact(rec, "judicialStatus", "Transmis / au tribunal — À confirmer", sourceRef, true);
      } else if (/bornage/i.test(obs)) {
        setFact(rec, "judicialStatus", "Bornage — À confirmer", sourceRef, true);
      }
    }

    for (const num of parseTribunalNumbers(text)) {
      if (!rec.tribunalCases.some((x) => x.number === num)) {
        rec.tribunalCases.push({
          number: num,
          court: /ifni/i.test(text) ? "Tribunal de Ifni" : "À confirmer",
          source: sourceRef,
        });
      }
    }

    for (const d of parseDates(text)) {
      const kind = /moudawala/i.test(text)
        ? "moudawala"
        : /bornage/i.test(text)
          ? "bornage"
          : /audience|tribunal/i.test(text)
            ? "audience"
            : "date";
      if (!rec.importantDates.some((x) => x.iso === d.iso)) {
        rec.importantDates.push({ ...d, kind, source: sourceRef });
      }
      if (!rec.courtEvents.some((x) => x.date === d.iso && x.kind === kind)) {
        rec.courtEvents.push({
          date: d.iso,
          dateDisplay: d.display,
          kind,
          description: text.slice(0, 240),
          result: null,
          source: sourceRef,
        });
      }
    }

    for (const other of refs) {
      if (other !== reference && !rec.linkedRequisitions.includes(other)) {
        rec.linkedRequisitions.push(other);
      }
    }
  }
}

function absorbRapport(recMap, paragraphs, tables, sourceName) {
  const role = "portfolio-report / rapport stratégique";
  for (const reference of EXPECTED_REFS) {
    const rec = recMap.get(reference) ?? emptyRecord(reference);
    recMap.set(reference, rec);
    ensureDoc(rec, sourceName, role);
  }

  for (const [idx, row] of tables.entries()) {
    const sourceRef = {
      sourceFilename: sourceName,
      section: `table-row-${idx + 1}`,
      originalText: row.join(" | "),
    };
    const reference = normalizeRef(row[0]);
    if (!reference || row.length < 3) continue;
    const rec = recMap.get(reference) ?? emptyRecord(reference);
    recMap.set(reference, rec);
    ensureDoc(rec, sourceName, role);
    if (row[1]) setFact(rec, "propertyName", row[1], sourceRef);
    if (row[2] && !/ha/i.test(row[2])) setFact(rec, "location", row[2], sourceRef);
    const surfaceCell = row.find((c) => /\dha/i.test(c) || /\d\s*ha/i.test(c));
    if (surfaceCell) setFact(rec, "surface", surfaceCell, sourceRef);
    const buyerIdx = row.findIndex((c) => /nasser|bouazza|flawers|avenu/i.test(c));
    if (buyerIdx >= 0) setFact(rec, "buyer", row[buyerIdx], sourceRef);
  }

  let currentRef = null;
  for (const [i, p] of paragraphs.entries()) {
    const sourceRef = {
      sourceFilename: sourceName,
      section: `paragraph-${i + 1}`,
      originalText: p,
    };
    const header = p.match(
      /Rapport par terrain\s*[—\-–]\s*(R\s*\d+\s*\/\s*31)\s*(.*)$/i,
    );
    if (header) {
      currentRef = normalizeRef(header[1]);
      const rec = recMap.get(currentRef) ?? emptyRecord(currentRef);
      recMap.set(currentRef, rec);
      ensureDoc(rec, sourceName, role);
      addRef(rec, sourceRef);
      const rest = header[2]?.trim() ?? "";
      const linked = rest.match(/R\s*\d+\s*\/\s*31/i);
      if (linked) {
        const lr = normalizeRef(linked[0]);
        if (lr && !rec.linkedRequisitions.includes(lr)) rec.linkedRequisitions.push(lr);
        const nameOnly = rest.replace(/\/?\s*R\s*\d+\s*\/\s*31/ig, "").replace(/\s*\/\s*$/, "").trim();
        if (nameOnly) setFact(rec, "propertyName", nameOnly, sourceRef);
      } else if (rest) setFact(rec, "propertyName", rest, sourceRef);
      continue;
    }
    if (!currentRef) continue;
    const rec = recMap.get(currentRef);
    if (!rec) continue;

    let m = p.match(/^(?:Propriété|Nom de la propriété|Terrain)\s*[:\-]\s*(.+)$/i);
    if (m) setFact(rec, "propertyName", m[1], sourceRef);
    m = p.match(/^(?:Localisation|Zone|Emplacement)\s*[:\-]\s*(.+)$/i);
    if (m) setFact(rec, "location", m[1], sourceRef);
    m = p.match(/^(?:Superficie|Surface)\s*[:\-]\s*(.+)$/i);
    if (m) setFact(rec, "surface", m[1], sourceRef);
    m = p.match(/^(?:Vendeur|Vendeurs)\s*[:\-]\s*(.+)$/i);
    if (m) setFact(rec, "seller", m[1], sourceRef);
    m = p.match(/^(?:Acquéreur|Acquereur|Acheteur)\s*[:\-]\s*(.+)$/i);
    if (m) setFact(rec, "buyer", m[1], sourceRef);
    m = p.match(/^(?:Observation|Observations|Situation judiciaire|Statut)\s*[:\-]\s*(.+)$/i);
    if (m) {
      setFact(rec, "generalObservation", m[1], sourceRef, true);
      if (/tribunal/i.test(m[1])) {
        setFact(rec, "judicialStatus", "Au tribunal — À confirmer", sourceRef, true);
      }
    }
    for (const num of parseTribunalNumbers(p)) {
      if (!rec.tribunalCases.some((x) => x.number === num)) {
        rec.tribunalCases.push({
          number: num,
          court: /ifni/i.test(p) ? "Tribunal de Ifni" : "À confirmer",
          source: sourceRef,
        });
      }
    }
    for (const d of parseDates(p)) {
      const kind = /moudawala/i.test(p)
        ? "moudawala"
        : /bornage/i.test(p)
          ? "bornage"
          : /audience/i.test(p)
            ? "audience"
            : "date";
      if (!rec.importantDates.some((x) => x.iso === d.iso)) {
        rec.importantDates.push({ ...d, kind, source: sourceRef });
      }
      if (!rec.courtEvents.some((x) => x.date === d.iso && x.kind === kind)) {
        rec.courtEvents.push({
          date: d.iso,
          dateDisplay: d.display,
          kind,
          description: p,
          result: null,
          source: sourceRef,
        });
      }
    }
    for (const m of p.matchAll(/R\s*\d{4,6}\s*\/\s*31/gi)) {
      const lr = normalizeRef(m[0]);
      if (lr && lr !== currentRef && !rec.linkedRequisitions.includes(lr)) {
        rec.linkedRequisitions.push(lr);
      }
    }
    if (/à confirmer|probablement|semble|potentiel|incert/i.test(p)) {
      rec.uncertainties.push({ field: "general", value: p.slice(0, 280), ...sourceRef });
    }
  }
}

function neonSurface(r) {
  if (r.surfaceHa == null && r.surfaceA == null && r.surfaceCa == null) return null;
  return `${r.surfaceHa ?? 0} ha ${r.surfaceA ?? 0} a ${r.surfaceCa ?? 0} ca`;
}

async function readNeon() {
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: requisitions } = await pool.query(`
    SELECT id, reference, "propertyName", location,
           "surfaceHectares", "surfaceAres", "surfaceCentiares",
           "sellerName", "buyerName", "riskLevel", "mainStatus", "mainStatusLabel",
           "mainIssue", "oppositionCount", "importantDate", "eventLabel", "nextAction",
           "priorityRank", "updatedAt", "createdAt"
    FROM "Requisition"
    WHERE "deletedAt" IS NULL
    ORDER BY reference ASC
  `);
  for (const r of requisitions) {
    const { rows: legalCases } = await pool.query(
      `SELECT id, "caseNumber", "courtName", "currentPhase" FROM "LegalCase" WHERE "requisitionId" = $1 AND "deletedAt" IS NULL`,
      [r.id],
    );
    const { rows: hearings } = await pool.query(
      `SELECT id, "scheduledAt", "eventType", title, status FROM "Hearing" WHERE "requisitionId" = $1`,
      [r.id],
    );
    const { rows: documents } = await pool.query(
      `SELECT id, title, category, status FROM "Document" WHERE "requisitionId" = $1 AND "deletedAt" IS NULL LIMIT 8`,
      [r.id],
    );
    r.legalCases = legalCases;
    r.hearings = hearings;
    r.documents = documents;
    // aliases for compare()
    r.seller = r.sellerName;
    r.buyer = r.buyerName;
    r.surfaceHa = r.surfaceHectares;
    r.surfaceA = r.surfaceAres;
    r.surfaceCa = r.surfaceCentiares;
  }
  return { pool, requisitions };
}

function compare(manifest, neonReqs) {
  const byRef = new Map(
    neonReqs.map((r) => [normalizeRef(r.reference) ?? r.reference, r]),
  );
  const correct = [];
  const missing = [];
  const conflicts = [];
  const noAuto = [];
  const docsLinkable = [];
  const docsUncertain = [];

  for (const rec of manifest.requisitions) {
    const neon = byRef.get(rec.reference);
    if (!neon) {
      missing.push({ reference: rec.reference, reason: "absent from Neon" });
      continue;
    }
    for (const [field, neonVal] of [
      ["propertyName", neon.propertyName],
      ["location", neon.location],
      ["seller", neon.seller],
      ["buyer", neon.buyer],
      ["surface", neonSurface(neon)],
    ]) {
      const extracted = rec[field];
      if (extracted == null || extracted === "À confirmer") continue;
      if (neonVal == null || neonVal === "" || neonVal === "À confirmer") {
        missing.push({ reference: rec.reference, field, extracted, neon: neonVal });
      } else if (norm(extracted) === norm(neonVal)) {
        correct.push({ reference: rec.reference, field, value: extracted });
      } else {
        conflicts.push({ reference: rec.reference, field, extracted, neon: neonVal });
      }
    }
    for (const tc of rec.tribunalCases) {
      const exists = (neon.legalCases ?? []).some((lc) =>
        String(lc.caseNumber ?? lc.number ?? "")
          .replace(/\s+/g, "")
          .includes(tc.number.replace(/\s+/g, "")),
      );
      if (exists) correct.push({ reference: rec.reference, field: "tribunalCase", value: tc.number });
      else missing.push({ reference: rec.reference, field: "tribunalCase", extracted: tc });
    }
    for (const u of rec.uncertainties) {
      noAuto.push({ reference: rec.reference, detail: u });
    }
  }

  for (const f of manifest.sourceFiles) {
    docsLinkable.push({
      filename: f.filename,
      classification: f.classification,
      linkTarget: "portfolio (all requisitions) — not a single dossier",
    });
    if (f.extractorNote) docsUncertain.push({ filename: f.filename, reason: f.extractorNote });
  }
  return { correct, missing, conflicts, noAuto, docsLinkable, docsUncertain };
}

function mdPptx(sourceName, extracted) {
  const lines = [
    `# Extraction — ${sourceName}`,
    "",
    `- Source filename: \`${sourceName}\``,
    `- Format: PPTX`,
    `- Slide count: ${extracted.slides.length}`,
    `- Extractor: JSZip + fast-xml-parser (python-pptx unavailable)`,
    "",
    "---",
    "",
  ];
  for (const slide of extracted.slides) {
    lines.push(`## Slide ${slide.slideNumber}`);
    lines.push("");
    lines.push(`- Source location: \`${slide.sourcePath}\``);
    lines.push(`- Slide title: ${slide.title}`);
    lines.push("");
    lines.push("### Joined text");
    lines.push("");
    lines.push(slide.joinedText || "(no extractable text — likely image-only)");
    lines.push("");
    lines.push("### Paragraphs");
    lines.push("");
    slide.paragraphs.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    if (slide.tables.length) {
      lines.push("");
      lines.push("### Tables");
      lines.push("");
      slide.tables.forEach((row, i) =>
        lines.push(`- Row ${i + 1}: ${row.map((c) => JSON.stringify(c)).join(" | ")}`),
      );
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function mdDocx(sourceName, extracted) {
  const lines = [
    `# Extraction — ${sourceName}`,
    "",
    `- Source filename: \`${sourceName}\``,
    `- Format: DOCX`,
    `- Paragraph count: ${extracted.paragraphs.length}`,
    `- Table row count: ${extracted.tables.length}`,
    `- Extractor: JSZip + fast-xml-parser (python-docx unavailable)`,
    "",
    "---",
    "",
    "## Paragraphs",
    "",
  ];
  extracted.paragraphs.forEach((p, i) => {
    lines.push(`### Paragraph ${i + 1}`);
    lines.push("");
    lines.push(p);
    lines.push("");
  });
  if (extracted.tables.length) {
    lines.push("---", "", "## Tables", "");
    extracted.tables.forEach((row, i) => {
      lines.push(`### Table row ${i + 1}`, "");
      lines.push("| " + row.map((c) => c.replace(/\|/g, "\\|")).join(" | ") + " |", "");
    });
  }
  return lines.join("\n");
}

function buildReview(manifest, comparison, neonReqs) {
  const lines = [
    "# IMPORT REVIEW — Source documents vs Neon",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    "## Source files",
    "",
  ];
  for (const f of manifest.sourceFiles) {
    lines.push(`- \`${f.filename}\` — **${f.classification}**`);
    if (f.extractorNote) lines.push(`  - Note: ${f.extractorNote}`);
    if (f.slides != null) lines.push(`  - Slides: ${f.slides} (text slides: ${f.textSlides})`);
    if (f.paragraphs != null) lines.push(`  - Paragraphs: ${f.paragraphs}, table rows: ${f.tableRows}`);
  }
  lines.push("", "## Neon snapshot", "", `- Requisitions in Neon: ${neonReqs.length}`);
  for (const r of neonReqs) {
    lines.push(
      `- \`${r.reference}\` | ${r.propertyName} | ${r.location} | ${neonSurface(r)} | cases=${r.legalCases?.length ?? 0} | hearings=${r.hearings?.length ?? 0} | docs=${r.documents?.length ?? 0}`,
    );
  }
  const section = (title, items, mapFn) => {
    lines.push("", `## ${title}`, "");
    if (!items.length) lines.push("_None._");
    else items.forEach((x) => lines.push(`- ${mapFn(x)}`));
  };
  section("Data already correct", comparison.correct, (c) =>
    `${c.reference} · ${c.field} = ${JSON.stringify(c.value)}`,
  );
  section("Data missing from Neon", comparison.missing, (m) => JSON.stringify(m));
  section("Data that conflicts with Neon", comparison.conflicts, (c) => JSON.stringify(c));
  section(
    "Data that should not be imported automatically",
    comparison.noAuto.slice(0, 150),
    (n) => JSON.stringify(n),
  );
  section("Documents that can be linked to a requisition / portfolio", comparison.docsLinkable, (d) =>
    JSON.stringify(d),
  );
  section("Documents whose category is uncertain", comparison.docsUncertain, (d) =>
    JSON.stringify(d),
  );
  lines.push("", "## Cross-source conflicts (presentations vs report)", "");
  if (!(manifest.crossSourceConflicts ?? []).length) lines.push("_None detected at field level._");
  else manifest.crossSourceConflicts.forEach((c) => lines.push(`- ${JSON.stringify(c)}`));
  lines.push(
    "",
    "## Notes",
    "",
    "- Python python-pptx / python-docx unavailable; used JSZip + fast-xml-parser OOXML extraction.",
    "- Presentation2 has no extractable text (image-heavy). Treat as visual portfolio source only.",
    "- No judicial outcomes invented. Dates kept with source refs; not assumed to be future.",
    "- Safe import should upsert by reference, preserve newer Neon edits, mark uncertain fields as « À confirmer ».",
    "",
  );
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = await fs.readdir(SOURCE_DIR);
  const pptx = files
    .filter((f) => f.toLowerCase().endsWith(".pptx"))
    .sort((a, b) => {
      const score = (n) =>
        /pr[eé]sentation\s*1/i.test(n) || (/1/.test(n) && !/2/.test(n)) ? 0 : 1;
      return score(a) - score(b) || a.localeCompare(b, "fr");
    });
  const docxFiles = files.filter((f) => f.toLowerCase().endsWith(".docx"));
  const sources = {
    presentation1: pptx[0],
    presentation2: pptx[1],
    rapport: docxFiles[0],
  };
  console.log("Sources:", sources);

  const p1 = await extractPptx(path.join(SOURCE_DIR, sources.presentation1));
  const p2 = await extractPptx(path.join(SOURCE_DIR, sources.presentation2));
  const rapport = await extractDocx(path.join(SOURCE_DIR, sources.rapport));

  await fs.writeFile(path.join(OUT_DIR, "presentation-1-extracted.md"), mdPptx(sources.presentation1, p1));
  await fs.writeFile(path.join(OUT_DIR, "presentation-2-extracted.md"), mdPptx(sources.presentation2, p2));
  await fs.writeFile(path.join(OUT_DIR, "rapport-extracted.md"), mdDocx(sources.rapport, rapport));
  await fs.writeFile(path.join(OUT_DIR, "presentation-1-extracted.raw.json"), JSON.stringify({ source: sources.presentation1, ...p1 }, null, 2));
  await fs.writeFile(path.join(OUT_DIR, "presentation-2-extracted.raw.json"), JSON.stringify({ source: sources.presentation2, ...p2 }, null, 2));
  await fs.writeFile(path.join(OUT_DIR, "rapport-extracted.raw.json"), JSON.stringify({ source: sources.rapport, ...rapport }, null, 2));

  const recMap = new Map(EXPECTED_REFS.map((r) => [r, emptyRecord(r)]));
  for (const slide of p1.slides) {
    absorbSlide(recMap, slide, sources.presentation1, "portfolio-source / fiches et pièces initiales");
  }
  for (const slide of p2.slides) {
    absorbSlide(recMap, slide, sources.presentation2, "portfolio-presentation / synthèse");
  }
  absorbRapport(recMap, rapport.paragraphs, rapport.tables, sources.rapport);

  for (const rec of recMap.values()) {
    for (const field of ["propertyName", "location", "surface", "seller", "buyer", "judicialStatus"]) {
      if (rec[field] == null) {
        rec[field] = "À confirmer";
        rec.uncertainties.push({
          field,
          value: "À confirmer",
          reason: "Not extracted with high confidence from sources",
        });
      }
    }
  }

  const crossSourceConflicts = [];
  for (const rec of recMap.values()) {
    for (const u of rec.uncertainties) {
      if (u.type === "conflict") {
        crossSourceConflicts.push({ reference: rec.reference, ...u });
      }
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    extractor: "JSZip + fast-xml-parser OOXML (python-pptx/python-docx unavailable)",
    sourceFiles: [
      {
        filename: sources.presentation1,
        classification: "Portfolio source / fiches et pièces initiales",
        slides: p1.slides.length,
        textSlides: p1.slides.filter((s) => s.paragraphs.length).length,
      },
      {
        filename: sources.presentation2,
        classification: "Portfolio presentation / synthèse",
        slides: p2.slides.length,
        textSlides: p2.slides.filter((s) => s.paragraphs.length).length,
        extractorNote: p2.slides.every((s) => !s.paragraphs.length)
          ? "No extractable text — likely image-only slides"
          : undefined,
      },
      {
        filename: sources.rapport,
        classification:
          "Portfolio report / rapport stratégique (ADMIN-uploaded portfolio report; not tied to a single requisition)",
        paragraphs: rapport.paragraphs.length,
        tableRows: rapport.tables.length,
      },
    ],
    requisitions: EXPECTED_REFS.map((ref) => recMap.get(ref)),
    crossSourceConflicts,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log("Wrote", MANIFEST_PATH);

  console.log("Comparing with Neon...");
  const { pool, requisitions: neonReqs } = await readNeon();
  try {
    const comparison = compare(manifest, neonReqs);
    await fs.writeFile(REVIEW_PATH, buildReview(manifest, comparison, neonReqs), "utf8");
    console.log("Wrote", REVIEW_PATH);
    console.log(
      `correct=${comparison.correct.length} missing=${comparison.missing.length} conflicts=${comparison.conflicts.length} noAuto=${comparison.noAuto.length}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
