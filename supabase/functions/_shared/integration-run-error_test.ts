import { assertEquals } from "jsr:@std/assert@1";
import { ProviderError } from "./integration-providers.ts";
import { runErrorCode } from "./integration-runner.ts";

Deno.test("403 genérico vira acesso recusado, não permissão ausente", () => {
  assertEquals(runErrorCode(new ProviderError("permission_missing")), "provider_access_denied");
});
Deno.test("403 com licença explícita vira license_missing", () => {
  assertEquals(runErrorCode(new ProviderError("permission_missing", false, null, "license_missing")), "license_missing");
});
Deno.test("401 e outros códigos ficam iguais", () => {
  assertEquals(runErrorCode(new ProviderError("authorization_expired")), "authorization_expired");
});
