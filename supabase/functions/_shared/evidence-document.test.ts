import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { strToU8, zipSync } from "npm:fflate@0.8.3";
import {
  extractEvidence,
  groundedVerdict,
  safeOfficeZip,
  storageReference,
} from "./evidence-document.ts";
const tenant = "11111111-1111-4111-8111-111111111111";
Deno.test("storage references reject foreign tenants, hosts, traversal and unsupported buckets", () => {
  assertEquals(
    storageReference(
      `${tenant}/proof.txt`,
      "https://project.supabase.co",
      tenant,
    ),
    { bucket: "documentos", path: `${tenant}/proof.txt` },
  );
  assertEquals(
    storageReference(
      `https://project.supabase.co/storage/v1/object/sign/documentos/${tenant}/proof.txt?token=not-reused`,
      "https://project.supabase.co",
      tenant,
    ).path,
    `${tenant}/proof.txt`,
  );
  for (
    const input of [
      `other/file.txt`,
      `${tenant}/../other/file`,
      `${tenant}/%2e%2e/file`,
      `https://evil.example/${tenant}/file`,
      `https://project.supabase.co/storage/v1/object/sign/private/${tenant}/file`,
    ]
  ) {
    assertThrows(() =>
      storageReference(input, "https://project.supabase.co", tenant)
    );
  }
});
Deno.test("text extraction retains source lines and truncation is explicit", async () => {
  const doc = await extractEvidence(
    strToU8("Política de acesso\nA revisão foi executada em setembro."),
    "prova.txt",
  );
  assertEquals(doc.sources[1].label, "Linha 2");
  assert(doc.complete);
  const partial = await extractEvidence(
    strToU8("a\n".repeat(1000)),
    "prova.txt",
  );
  assertEquals(partial.sources.length, 600);
  assertEquals(partial.complete, false);
});
Deno.test("DOCX reads paragraphs and table text, not HTML or external resources", async () => {
  const xml =
    "<w:document><w:p><w:r><w:t>Política &amp; registro</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Revisão trimestral executada</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:document>";
  const bytes = zipSync({ "word/document.xml": strToU8(xml) });
  const doc = await extractEvidence(bytes, "prova.docx");
  assertEquals(doc.sources[0].text, "Política & registro");
  assertEquals(doc.sources[1].label, "Parágrafo 2");
});
Deno.test("active Office content and oversized archives are rejected", () => {
  assertThrows(() =>
    safeOfficeZip(zipSync({ "word/vbaProject.bin": new Uint8Array([1]) }))
  );
  assertThrows(() =>
    safeOfficeZip(
      zipSync({ "word/document.xml": new Uint8Array(17 * 1024 * 1024) }),
    )
  );
});
Deno.test("unknown binary is not sent as metadata for AI evaluation", async () => {
  await assertRejects(() =>
    extractEvidence(new Uint8Array([0, 1, 2]), "arquivo.exe")
  );
  await assertRejects(() => extractEvidence(strToU8(""), "vazio.txt"));
});
Deno.test("PDF keeps page references", async () => {
  const { PDFDocument, StandardFonts } = await import("npm:pdf-lib@1.17.1");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Quarterly access review executed and documented.", {
    font,
  });
  pdf.addPage().drawText("Evidence approved by the assigned control owner.", {
    font,
  });
  const doc = await extractEvidence(await pdf.save(), "evidence.pdf");
  assertEquals(doc.sources.length, 2);
  assertEquals(doc.sources[1].label, "Página 2");
  assert(doc.complete);
});
Deno.test("XLSX retains sheet and actual row references", async () => {
  const XLSX = await import(
    "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Responsável", "Revisão"], [
      "Equipe",
      "Concluída",
    ]]),
    "Acessos",
  );
  const doc = await extractEvidence(
    new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })),
    "prova.xlsx",
  );
  assert(
    doc.sources.some((s) =>
      s.label === "Planilha Acessos · linha 2" && s.text.includes("Concluída")
    ),
  );
});
Deno.test("OCR is clearly partial and never yields automatic compliance", async () => {
  const doc = await extractEvidence(
    new Uint8Array([0x89, 80, 78, 71, 13, 10, 26, 10]),
    "scan.png",
    async () => "Texto transcrito para revisão humana",
  );
  assertEquals(doc.sources[0].method, "ocr");
  assertEquals(doc.complete, false);
  const result = groundedVerdict({
    verdict: "conforme",
    citations: [{
      source_id: "S1",
      quote: "Texto transcrito para revisão humana",
    }],
  }, doc);
  assertEquals(result.verdict, "indeterminado");
  assertEquals(result.score, null);
});
Deno.test("fabricated quotes and unknown sources cannot support a verdict", async () => {
  const doc = await extractEvidence(
    strToU8("A revisão deve ser feita trimestralmente."),
    "policy.txt",
  );
  assertEquals(
    groundedVerdict({
      verdict: "conforme",
      citations: [{
        source_id: "S1",
        quote: "A revisão foi feita trimestralmente.",
      }],
    }, doc).verdict,
    "indeterminado",
  );
  assertEquals(
    groundedVerdict({
      verdict: "conforme",
      citations: [{
        source_id: "S2",
        quote: "A revisão deve ser feita trimestralmente.",
      }],
    }, doc).verdict,
    "indeterminado",
  );
  const valid = groundedVerdict({
    verdict: "parcial",
    score: 99,
    citations: [{
      source_id: "S1",
      quote: "A revisão deve ser feita trimestralmente.",
    }],
    evidence_kind: "policy",
  }, doc);
  assertEquals(valid.verdict, "parcial");
  assertEquals(valid.score, null);
  assertEquals(valid.evidence_kind, "policy");
  assertEquals(
    groundedVerdict({
      verdict: "conforme",
      citations: [{
        source_id: "S1",
        quote: "A revisão deve ser feita trimestralmente.",
      }, { source_id: "S1", quote: "Auditoria comprovou execução diária." }],
    }, doc).verdict,
    "indeterminado",
  );
});
