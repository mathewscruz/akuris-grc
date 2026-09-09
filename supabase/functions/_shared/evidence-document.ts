import { strFromU8, unzipSync } from "npm:fflate@0.8.3";

export const EVIDENCE_READER_VERSION = "2026-09-09.1";
export const MAX_EVIDENCE_BYTES = 12 * 1024 * 1024;
export interface EvidenceSource {
  id: string;
  label: string;
  text: string;
  method: "text" | "ocr";
}
export interface EvidenceDocument {
  sources: EvidenceSource[];
  warnings: string[];
  complete: boolean;
  reader_version: string;
}
export type ImageReader = (bytes: Uint8Array, mime: string) => Promise<string>;

export function storageReference(
  value: string,
  projectUrl: string,
  tenant: string,
  defaultBucket = "documentos",
) {
  let bucket = defaultBucket;
  let path = value;
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (
      url.origin !== new URL(projectUrl).origin || url.username || url.password
    ) throw new Error("invalid_source");
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (!match) throw new Error("invalid_source");
    bucket = decodeURIComponent(match[1]);
    path = decodeURIComponent(match[2]);
  }
  if (
    !["documentos", "gap-evidence-library"].includes(bucket) ||
    !path.startsWith(`${tenant}/`) ||
    path.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\\\x00-\x1f%]/.test(path)
  ) throw new Error("invalid_source");
  return { bucket, path };
}

export async function boundedDownload(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.body) throw new Error("download_failed");
  if (Number(response.headers.get("content-length")) > MAX_EVIDENCE_BYTES) {
    throw new Error("file_too_large");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_EVIDENCE_BYTES) throw new Error("file_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

// Validate every ZIP entry before allocating decompressed content; no macro,
// executable, embedded object, external relationship or HTML is executed.
export function safeOfficeZip(bytes: Uint8Array) {
  let total = 0;
  let entries = 0;
  return unzipSync(bytes, {
    filter(file) {
      if (
        ++entries > 2000 || file.originalSize > 16 * 1024 * 1024 ||
        (total += file.originalSize) > 32 * 1024 * 1024
      ) {
        throw new Error("archive_limits");
      }
      if (/vbaProject|\/embeddings\//i.test(file.name)) {
        throw new Error("active_content");
      }
      return /^(word\/document\.xml|xl\/.*\.xml)$/.test(file.name);
    },
  });
}

const xmlText = (s: string) =>
  s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi, (entity) => {
    const named: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    if (named[entity]) return named[entity];
    const n = entity.startsWith("&#x")
      ? parseInt(entity.slice(3), 16)
      : parseInt(entity.slice(2), 10);
    return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });

export async function extractEvidence(
  bytes: Uint8Array,
  name: string,
  readImage?: ImageReader,
): Promise<EvidenceDocument> {
  if (!bytes.length || bytes.length > MAX_EVIDENCE_BYTES) {
    throw new Error("file_too_large");
  }
  const doc: EvidenceDocument = {
    sources: [],
    warnings: [],
    complete: true,
    reader_version: EVIDENCE_READER_VERSION,
  };
  let length = 0;
  const add = (
    label: string,
    text: string,
    method: "text" | "ocr" = "text",
  ) => {
    const clean = text.replace(/\x00/g, "").trim();
    if (!clean) return;
    if (doc.sources.length >= 600) {
      doc.complete = false;
      return;
    }
    const remaining = 90000 - length;
    if (remaining <= 0) {
      doc.complete = false;
      return;
    }
    if (clean.length > remaining) doc.complete = false;
    const content = clean.slice(0, remaining);
    length += content.length;
    doc.sources.push({
      id: `S${doc.sources.length + 1}`,
      label,
      text: content,
      method,
    });
  };
  const signature = new TextDecoder("latin1").decode(bytes.slice(0, 12));
  const ext = name.toLowerCase().split(".").pop();
  if (signature.startsWith("%PDF-")) {
    const { getDocumentProxy, extractImages } = await import("npm:unpdf@1.8.1");
    const pdf = await getDocumentProxy(bytes, {
      maxImageSize: 4000000,
      useSystemFonts: false,
      disableFontFace: true,
    });
    try {
      if (pdf.numPages > 40) doc.complete = false;
      let ocrPages = 0;
      for (let n = 1; n <= Math.min(pdf.numPages, 40) && length < 90000; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""
        ).join("");
        if (text.trim().length > 40) add(`Página ${n}`, text);
        else if (readImage && ocrPages < 2) {
          const images = await extractImages(pdf, n);
          // Embedded scans only. Multiple images/overlays are not a faithful full-page rendering.
          const scan = images.length === 1 ? images[0] : null;
          if (
            scan && scan.width * scan.height <= 4000000 &&
            scan.width * scan.height >= 10000
          ) {
            const { encode } = await import("npm:fast-png@8.0.0");
            const png = encode({
              width: scan.width,
              height: scan.height,
              data: scan.data,
              channels: scan.channels,
            });
            add(
              `Página ${n} · transcrição da imagem`,
              await readImage(png, "image/png"),
              "ocr",
            );
            ocrPages++;
          }
          doc.complete = false;
        } else doc.complete = false;
        page.cleanup();
      }
    } finally {
      await pdf.cleanup();
    }
  } else if (signature.startsWith("PK") && ext === "docx") {
    const entries = safeOfficeZip(bytes);
    if (!entries["word/document.xml"]) throw new Error("unsupported_format");
    const xml = strFromU8(entries["word/document.xml"]);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("active_content");
    const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
    paragraphs.forEach((paragraph, index) =>
      add(
        `Parágrafo ${index + 1}`,
        (paragraph.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g) || []).map((t) =>
          xmlText(t.replace(/^<w:t\b[^>]*>|<\/w:t>$/g, ""))
        ).join(" "),
      )
    );
    if (/<w:drawing|<w:pict|<w:altChunk/i.test(xml)) doc.complete = false;
  } else if (signature.startsWith("PK") && ext === "xlsx") {
    const entries = safeOfficeZip(bytes);
    // SheetJS parses values only; formulas and external references are never evaluated.
    const XLSX = await import(
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
    );
    const workbook = XLSX.read(bytes, {
      type: "array",
      cellFormula: false,
      cellHTML: false,
      sheetRows: 501,
    });
    if (
      workbook.SheetNames.length > 10 ||
      Object.keys(entries).some((k) => /externalLinks|drawings/i.test(k))
    ) doc.complete = false;
    for (const sheetName of workbook.SheetNames.slice(0, 10)) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet["!fullref"]) doc.complete = false;
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      if (range.e.c > 49 || range.e.r > 499) doc.complete = false;
      range.e.c = Math.min(range.e.c, 49);
      range.e.r = Math.min(range.e.r, 499);
      for (let row = range.s.r; row <= range.e.r; row++) {
        add(
          `Planilha ${sheetName} · linha ${row + 1}`,
          XLSX.utils.sheet_to_csv(sheet, {
            range: XLSX.utils.encode_range({
              s: { r: row, c: range.s.c },
              e: { r: row, c: range.e.c },
            }),
          }),
        );
      }
    }
  } else if (
    bytes[0] === 0x89 && signature.slice(1, 4) === "PNG" ||
    bytes[0] === 0xff && bytes[1] === 0xd8
  ) {
    if (!readImage) throw new Error("ocr_unavailable");
    add(
      "Imagem · transcrição para revisão",
      await readImage(bytes, bytes[0] === 0x89 ? "image/png" : "image/jpeg"),
      "ocr",
    );
    doc.complete = false;
  } else if (["txt", "csv", "md", "json", "log"].includes(ext || "")) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("unsupported_format");
    text.split(/\r?\n/).forEach((line, i) => add(`Linha ${i + 1}`, line));
  } else throw new Error("unsupported_format");
  if (!doc.sources.length) throw new Error("unreadable_document");
  if (length >= 90000) doc.complete = false;
  if (!doc.complete) {
    doc.warnings.push(
      "Leitura parcial ou transcrição visual: confira o arquivo original. Não é possível concluir conformidade automaticamente.",
    );
  }
  return doc;
}

export function groundedVerdict(raw: unknown, document: EvidenceDocument) {
  if (!raw || typeof raw !== "object") throw new Error("invalid_ai_response");
  const input = raw as Record<string, unknown>;
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string").slice(0, 12).map(
        (s) => s.slice(0, 1200),
      )
      : [];
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const citations = (Array.isArray(input.citations) ? input.citations : [])
    .flatMap((c) => {
      if (
        !c || typeof c.source_id !== "string" || typeof c.quote !== "string"
      ) return [];
      const source = document.sources.find((s) => s.id === c.source_id);
      const quote = normalize(c.quote).slice(0, 600);
      if (
        !source || quote.length < 12 || !normalize(source.text).includes(quote)
      ) return [];
      return [{
        source_id: source.id,
        label: source.label,
        quote,
        method: source.method,
      }];
    }).slice(0, 8);
  const valid = ["conforme", "parcial", "nao_conforme", "indeterminado"]
    .includes(String(input.verdict));
  const grounded = citations.length > 0 && Array.isArray(input.citations) &&
    citations.length === input.citations.length && valid && document.complete;
  return {
    verdict: grounded ? input.verdict : "indeterminado",
    score: null,
    justification: grounded && typeof input.justification === "string"
      ? input.justification.slice(0, 1800)
      : "A leitura ou as referências não sustentam uma conclusão completa. Revise as fontes e os pontos sugeridos.",
    missing: strings(input.missing),
    next_steps: strings(input.next_steps),
    completion_criteria: strings(input.completion_criteria),
    evidence_kind:
      ["policy", "execution", "mixed"].includes(String(input.evidence_kind))
        ? input.evidence_kind
        : "unknown",
    citations,
    warnings: document.warnings,
    complete: document.complete,
    requires_human_review: true,
  };
}
