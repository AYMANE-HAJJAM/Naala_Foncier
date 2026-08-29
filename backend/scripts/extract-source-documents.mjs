/**
 * Extract text/tables from PPTX and DOCX source documents (Office Open XML).
 * Python (python-pptx / python-docx) is unavailable in this environment;
 * JSZip + fast-xml-parser provide equivalent OOXML text extraction.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "private-import", "source-documents");
const OUT_DIR = path.join(ROOT, "private-import", "extracted");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  ignoreDeclaration: true,
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
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
  for (const [key, value] of Object.entries(node)) {
    if (key === "#text" || key.startsWith("@_")) continue;
    collectText(value, out);
  }
  return out;
}

function joinRuns(texts) {
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

function extractTableRows(node, rows = []) {
  if (node == null || typeof node !== "object") return rows;
  for (const [key, value] of Object.entries(node)) {
    if (key === "a:tr" || key === "w:tr") {
      for (const tr of asArray(value)) {
        const cells = [];
        for (const [ck, cv] of Object.entries(tr)) {
          if (ck === "a:tc" || ck === "w:tc") {
            for (const tc of asArray(cv)) {
              cells.push(joinRuns(collectText(tc)));
            }
          }
        }
        if (cells.some((c) => c)) rows.push(cells);
      }
    } else if (!key.startsWith("@_")) {
      extractTableRows(value, rows);
    }
  }
  return rows;
}

function extractDocxParagraphs(node, paragraphs = []) {
  if (node == null || typeof node !== "object") return paragraphs;
  for (const [key, value] of Object.entries(node)) {
    if (key === "w:p") {
      for (const p of asArray(value)) {
        const text = joinRuns(collectText(p));
        if (text) paragraphs.push(text);
      }
    } else if (!key.startsWith("@_")) {
      extractDocxParagraphs(value, paragraphs);
    }
  }
  return paragraphs;
}

async function extractPptx(filePath) {
  const buf = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0);
      return na - nb;
    });

  const slides = [];
  for (const slidePath of slideFiles) {
    const num = Number(slidePath.match(/slide(\d+)/i)?.[1] ?? 0);
    const xml = await zip.file(slidePath).async("string");
    const parsed = parser.parse(xml);
    const paragraphs = collectText(parsed);
    const tables = extractTableRows(parsed);
    slides.push({
      slideNumber: num,
      title: paragraphs[0] ?? `(Slide ${num})`,
      paragraphs,
      tables,
      sourcePath: slidePath,
    });
  }
  return { kind: "pptx", slides };
}

async function extractDocx(filePath) {
  const buf = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml").async("string");
  const parsed = parser.parse(docXml);
  return {
    kind: "docx",
    paragraphs: extractDocxParagraphs(parsed),
    tables: extractTableRows(parsed),
  };
}

function toMarkdownPptx(sourceName, extracted) {
  const lines = [
    `# Extraction — ${sourceName}`,
    "",
    `- Source filename: \`${sourceName}\``,
    `- Format: PPTX`,
    `- Slide count: ${extracted.slides.length}`,
    `- Extractor: JSZip + fast-xml-parser (OOXML; python-pptx unavailable)`,
    "",
    "---",
    "",
  ];
  for (const slide of extracted.slides) {
    lines.push(`## Slide ${slide.slideNumber}`);
    lines.push("");
    lines.push(`- Source location: \`${slide.sourcePath}\``);
    lines.push(`- Slide title (first text run): ${slide.title}`);
    lines.push("");
    lines.push("### Paragraphs / text runs");
    lines.push("");
    for (const [i, p] of slide.paragraphs.entries()) {
      lines.push(`${i + 1}. ${p}`);
    }
    if (slide.tables.length) {
      lines.push("");
      lines.push("### Tables");
      lines.push("");
      for (const [i, row] of slide.tables.entries()) {
        lines.push(`- Row ${i + 1}: ${row.map((c) => JSON.stringify(c)).join(" | ")}`);
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function toMarkdownDocx(sourceName, extracted) {
  const lines = [
    `# Extraction — ${sourceName}`,
    "",
    `- Source filename: \`${sourceName}\``,
    `- Format: DOCX`,
    `- Paragraph count: ${extracted.paragraphs.length}`,
    `- Table row count: ${extracted.tables.length}`,
    `- Extractor: JSZip + fast-xml-parser (OOXML; python-docx unavailable)`,
    "",
    "---",
    "",
    "## Paragraphs",
    "",
  ];
  for (const [i, p] of extracted.paragraphs.entries()) {
    lines.push(`### Paragraph ${i + 1}`);
    lines.push("");
    lines.push(p);
    lines.push("");
  }
  if (extracted.tables.length) {
    lines.push("---");
    lines.push("");
    lines.push("## Tables");
    lines.push("");
    for (const [i, row] of extracted.tables.entries()) {
      lines.push(`### Table row ${i + 1}`);
      lines.push("");
      lines.push("| " + row.map((c) => c.replace(/\|/g, "\\|")).join(" | ") + " |");
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = await fs.readdir(SOURCE_DIR);

  const pptx = files
    .filter((f) => f.toLowerCase().endsWith(".pptx"))
    .sort((a, b) => {
      const score = (n) =>
        /pr[eé]sentation\s*1/i.test(n) || (/1/.test(n) && !/\s*2/.test(n))
          ? 0
          : 1;
      return score(a) - score(b) || a.localeCompare(b, "fr");
    });
  const docx = files.filter((f) => f.toLowerCase().endsWith(".docx"));

  console.log("Sources PPTX:", pptx);
  console.log("Sources DOCX:", docx);

  const mapping = [
    { source: pptx[0], out: "presentation-1-extracted.md", label: "Presentation1" },
    { source: pptx[1], out: "presentation-2-extracted.md", label: "Presentation2" },
    { source: docx[0], out: "rapport-extracted.md", label: "Rapport" },
  ];

  const index = [];
  for (const item of mapping) {
    if (!item.source) {
      console.error(`Missing source for ${item.label}`);
      continue;
    }
    const full = path.join(SOURCE_DIR, item.source);
    console.log(`Extracting ${item.source} ...`);
    let extracted;
    let md;
    if (item.source.toLowerCase().endsWith(".pptx")) {
      extracted = await extractPptx(full);
      md = toMarkdownPptx(item.source, extracted);
    } else {
      extracted = await extractDocx(full);
      md = toMarkdownDocx(item.source, extracted);
    }
    await fs.writeFile(path.join(OUT_DIR, item.out), md, "utf8");
    await fs.writeFile(
      path.join(OUT_DIR, item.out.replace(".md", ".raw.json")),
      JSON.stringify({ source: item.source, label: item.label, ...extracted }, null, 2),
      "utf8",
    );
    index.push({
      label: item.label,
      source: item.source,
      out: item.out,
      kind: extracted.kind,
      slides: extracted.slides?.length ?? null,
      paragraphs: extracted.paragraphs?.length ?? null,
      tableRows: extracted.tables?.length ?? null,
    });
    console.log(
      `Wrote ${item.out} (${extracted.kind}, slides=${extracted.slides?.length ?? "-"}, paragraphs=${extracted.paragraphs?.length ?? "-"})`,
    );
  }

  await fs.writeFile(
    path.join(OUT_DIR, "_extraction-index.json"),
    JSON.stringify(index, null, 2),
    "utf8",
  );
  console.log("Extraction complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
