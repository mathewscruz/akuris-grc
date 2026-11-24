import { assertEquals } from "jsr:@std/assert@1";
import { ativoDoIntune, serialConfiavel } from "./intune-ativos.ts";

Deno.test("dispositivo do Intune vira ativo com id e serial", () => {
  const a = ativoDoIntune({
    externalId: "device:abc-1", kind: "device", name: "NB-01",
    signals: { os: "Windows", version: "11", serial_number: "SN123", compliance: "compliant", encrypted: true },
  })!;
  assertEquals(a.intune_device_id, "abc-1");
  assertEquals(a.versao, "Windows 11");
  assertEquals(a.atributos.numero_serie, "SN123");
  assertEquals(a.atributos.criptografado, true);
});

Deno.test("identidade não vira ativo", () => {
  assertEquals(ativoDoIntune({ externalId: "user:1", kind: "identity", name: "x", signals: {} }), null);
});

Deno.test("serial genérico não é usado para casar ativos", () => {
  assertEquals(serialConfiavel("Default string"), null);
  assertEquals(serialConfiavel("0000000"), null);
  assertEquals(serialConfiavel("PF2ABC9"), "PF2ABC9");
});
