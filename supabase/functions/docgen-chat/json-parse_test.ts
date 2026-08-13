/**
 * Testes do parsing tolerante do JSON do DocGen.
 *
 * Antes desta camada, qualquer resposta truncada ou com texto fora do JSON
 * derrubava o documento inteiro para um bloco de texto cru, sem capa nem
 * seções. Estes casos reproduzem as falhas reais observadas em produção.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseDocumentJson, isValidDocument } from "../_shared/docgen-json.ts";

const section = (nome: string) => ({
  nome,
  conteudo: `Conteúdo substantivo da seção ${nome}. `.repeat(6),
});

const validDoc = {
  titulo: "Política de Segurança",
  versao: "1.0",
  secoes: [section("Objetivo"), section("Escopo"), section("Vigência")],
};

Deno.test("parseDocumentJson — JSON limpo", () => {
  const parsed = parseDocumentJson(JSON.stringify(validDoc));
  assertEquals(parsed.titulo, "Política de Segurança");
  assertEquals(parsed.secoes.length, 3);
});

Deno.test("parseDocumentJson — JSON dentro de cercas de código", () => {
  const raw = "```json\n" + JSON.stringify(validDoc) + "\n```";
  const parsed = parseDocumentJson(raw);
  assertEquals(parsed.titulo, "Política de Segurança");
});

Deno.test("parseDocumentJson — texto antes e depois do JSON", () => {
  const raw = `Claro! Segue o documento:\n${JSON.stringify(validDoc)}\nEspero ter ajudado.`;
  const parsed = parseDocumentJson(raw);
  assertEquals(parsed.secoes.length, 3);
});

Deno.test("parseDocumentJson — truncado no meio de uma string", () => {
  const full = JSON.stringify(validDoc);
  const cut = full.slice(0, full.length - 120);
  const parsed = parseDocumentJson(cut);
  assert(parsed !== null, "deveria reparar o truncamento");
  assertEquals(parsed.titulo, "Política de Segurança");
  assert(Array.isArray(parsed.secoes));
});

Deno.test("parseDocumentJson — truncado no meio do array de seções", () => {
  const raw = '{"titulo":"X","secoes":[{"nome":"A","conteudo":"aaa"},{"nome":"B","conte';
  const parsed = parseDocumentJson(raw);
  assert(parsed !== null);
  assertEquals(parsed.titulo, "X");
  assert(parsed.secoes.length >= 1);
});

Deno.test("parseDocumentJson — entrada sem JSON devolve null", () => {
  assertEquals(parseDocumentJson("desculpe, não consegui gerar"), null);
  assertEquals(parseDocumentJson(""), null);
});

Deno.test("isValidDocument — aceita documento com 3 seções substantivas", () => {
  assertEquals(isValidDocument(validDoc), true);
});

Deno.test("isValidDocument — rejeita seções vazias, curtas ou ausentes", () => {
  assertEquals(isValidDocument(null), false);
  assertEquals(isValidDocument({ titulo: "X" }), false);
  assertEquals(isValidDocument({ secoes: [] }), false);
  assertEquals(
    isValidDocument({ secoes: [{ nome: "A", conteudo: "curto" }, section("B"), section("C")] }),
    false,
    "seção curta não conta para o mínimo de 3",
  );
});
