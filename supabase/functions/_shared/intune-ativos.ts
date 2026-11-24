// Regras puras: dispositivo do Intune (recurso coletado) -> campos de ativo.
import type { CollectedResource } from "./integration-model.ts";

const txt = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export function ativoDoIntune(r: CollectedResource) {
  if (r.kind !== "device") return null;
  const id = r.externalId.replace(/^device:/, "");
  if (!id) return null;
  const s = r.signals;
  return {
    intune_device_id: id,
    nome: txt(r.name) ?? id,
    tipo: "Hardware",
    versao: [txt(s.os), txt(s.version)].filter(Boolean).join(" ") || null,
    atributos: {
      origem_intune: true,
      sistema_operacional: txt(s.os),
      fabricante: txt(s.manufacturer),
      modelo: txt(s.model),
      numero_serie: txt(s.serial_number),
      usuario_principal: txt(s.owner_email),
      conformidade_intune: txt(s.compliance),
      criptografado: typeof s.encrypted === "boolean" ? s.encrypted : null,
      intune_ultima_sincronizacao: txt(s.provider_last_sync),
    },
  };
}

/** Serial numbers that vendors ship as placeholders must never merge assets. */
export function serialConfiavel(v: unknown): string | null {
  const s = txt(v);
  if (!s || s.length < 4) return null;
  if (/^(0+|default string|to be filled.*|system serial number|none|n\/a)$/i.test(s)) return null;
  return s;
}
