// Regras puras: converte um nó do MeshCentral (+ sysinfo) em campos de ativo.

export type NoMesh = { _id: string; name?: string; host?: string; osdesc?: string; ip?: string; conn?: number; agct?: number; users?: string[] };

export const DIAS_SEM_CONTATO = 7;

const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function ativoDoNo(no: NoMesh, sysinfo: any, agora = new Date()) {
  const hw = sysinfo?.hardware ?? {};
  const id = hw.identifiers ?? {};
  const win = hw.windows ?? {};
  const online = typeof no.conn === 'number' && (no.conn & 1) === 1;
  const ultimo = online ? agora.toISOString() : (no.agct ? new Date(no.agct).toISOString() : null);
  const discos = Array.isArray(win.drives) ? win.drives.map((d: any) => ({ nome: txt(d.Caption) ?? txt(d.Name), tamanho: d.Size ?? null, livre: d.FreeSpace ?? null })) : [];
  const memoria = Array.isArray(win.memory) ? win.memory.reduce((s: number, m: any) => s + (Number(m.Capacity) || 0), 0) : null;
  const programas = Array.isArray(sysinfo?.software) ? sysinfo.software.slice(0, 500).map((s: any) => txt(s.name) ?? txt(s.DisplayName)).filter(Boolean) : [];
  return {
    nome: txt(no.name) ?? txt(no.host) ?? no._id,
    tipo: 'Hardware',
    versao: txt(no.osdesc),
    mesh_node_id: no._id,
    agente_online: online,
    agente_ultimo_contato: ultimo,
    atributos: {
      origem: 'agente_akuris',
      sistema_operacional: txt(no.osdesc),
      ip: txt(no.ip),
      processador: txt(id.cpu_name),
      fabricante: txt(id.board_vendor) ?? txt(id.product_vendor),
      modelo: txt(id.product_name),
      numero_serie: txt(id.product_serial) ?? txt(id.board_serial),
      memoria_bytes: memoria || null,
      discos,
      utilizadores: Array.isArray(no.users) ? no.users : [],
      programas,
    },
  };
}

export function semContato(ultimo: string | null, agora = new Date(), dias = DIAS_SEM_CONTATO) {
  if (!ultimo) return false;
  return agora.getTime() - new Date(ultimo).getTime() > dias * 86400000;
}
