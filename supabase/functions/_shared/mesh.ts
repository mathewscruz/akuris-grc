// Cliente mínimo da API de controlo do MeshCentral (websocket /control.ashx).
// Credenciais: MESH_URL, MESH_USER, MESH_PASSWORD (utilizador de serviço do Akuris).

export function meshConfig() {
  const url = Deno.env.get('MESH_URL')?.replace(/\/+$/, '');
  const user = Deno.env.get('MESH_USER');
  const pass = Deno.env.get('MESH_PASSWORD');
  if (!url || !user || !pass || !url.startsWith('https://')) return null;
  return { url, user, pass };
}

export type MeshConn = {
  pedir: (cmd: Record<string, unknown>, esperar?: string) => Promise<any>;
  fechar: () => void;
};

export async function abrirMesh(cfg: { url: string; user: string; pass: string }): Promise<MeshConn> {
  const wsUrl = cfg.url.replace(/^https:/, 'wss:') + '/control.ashx';
  const auth = `${btoa(cfg.user)},${btoa(cfg.pass)}`;
  // Deno aceita cabeçalhos no construtor do WebSocket.
  const ws = new (WebSocket as any)(wsUrl, { headers: { 'x-meshauth': auth } }) as WebSocket;
  const pendentes = new Map<string, (m: any) => void>();
  let seq = 0;
  await new Promise<void>((ok, falha) => {
    const t = setTimeout(() => falha(new Error('mesh_timeout')), 10000);
    ws.onopen = () => { clearTimeout(t); ok(); };
    ws.onerror = () => { clearTimeout(t); falha(new Error('mesh_conexao_falhou')); };
  });
  ws.onmessage = (ev) => {
    let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
    const chave = m.responseid ?? m.tag;
    if (chave && pendentes.has(chave)) { pendentes.get(chave)!(m); pendentes.delete(chave); }
  };
  return {
    pedir: (cmd) => new Promise((ok, falha) => {
      const id = `ak${++seq}`;
      const t = setTimeout(() => { pendentes.delete(id); falha(new Error(`mesh_timeout_${cmd.action}`)); }, 15000);
      pendentes.set(id, (m) => { clearTimeout(t); ok(m); });
      ws.send(JSON.stringify({ ...cmd, responseid: id, tag: id }));
    }),
    fechar: () => { try { ws.close(); } catch { /* já fechado */ } },
  };
}

/** Links de download do agente para um grupo (id curto sem o prefixo mesh//). */
export function linksInstalador(base: string, meshId: string) {
  const id = encodeURIComponent(meshId.split('/').pop() ?? meshId);
  return {
    windows: `${base}/meshagents?id=4&meshid=${id}&installflags=0`,
    macos: `${base}/meshagents?id=16&meshid=${id}&installflags=0`,
    linux: `${base}/meshagents?script=1`,
    linuxComando: `wget -q "${base}/meshagents?script=1" -O ./meshinstall.sh && chmod 755 ./meshinstall.sh && sudo ./meshinstall.sh ${base} '${id}'`,
  };
}
