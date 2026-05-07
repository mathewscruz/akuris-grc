import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmDialog from '@/components/ConfirmDialog';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface ApiKey {
  id: string;
  nome: string;
  api_key?: string;
  prefixo: string;
  permissoes: string[];
  rate_limit_por_minuto: number;
  ativo: boolean;
  ultimo_uso: string | null;
  total_requisicoes: number;
  created_at: string;
  expires_at: string | null;
}

const PERMISSOES_DISPONIVEIS = [
  { value: 'riscos:read', label: 'Riscos (Leitura)' },
  { value: 'riscos:write', label: 'Riscos (Escrita)' },
  { value: 'controles:read', label: 'Controles (Leitura)' },
  { value: 'controles:write', label: 'Controles (Escrita)' },
  { value: 'incidentes:read', label: 'Incidentes (Leitura)' },
  { value: 'incidentes:write', label: 'Incidentes (Escrita)' },
  { value: 'auditorias:read', label: 'Auditorias (Leitura)' },
  { value: 'documentos:read', label: 'Documentos (Leitura)' },
  { value: 'ativos:read', label: 'Ativos (Leitura)' },
  { value: 'ativos:write', label: 'Ativos (Escrita)' },
];

function generateApiKey(): { key: string; prefix: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'gai_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return { key, prefix: key.substring(0, 12) };
}

export function ApiKeysManager() {
  const { empresaId } = useEmpresaId();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Map<string, string>>(new Map());
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState('60');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empresaId) fetchKeys();
  }, [empresaId]);

  const fetchKeys = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKeys((data || []) as ApiKey[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!empresaId || !nome.trim()) return;
    setSaving(true);
    try {
      const { key, prefix } = generateApiKey();
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('api_keys').insert({
        empresa_id: empresaId,
        nome: nome.trim(),
        api_key: key,
        prefixo: prefix,
        permissoes,
        rate_limit_por_minuto: parseInt(rateLimit) || 60,
        created_by: userData.user?.id,
      });

      if (error) throw error;

      setNewKeyRevealed(key);
      toast.success('API Key criada', { description: 'Copie a chave agora — ela não será exibida novamente.' });
      setDialogOpen(false);
      setNome('');
      setPermissoes([]);
      setRateLimit('60');
      fetchKeys();
    } catch (err: any) {
      toast.error('Erro ao criar API Key', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await supabase.from('api_keys').update({ ativo }).eq('id', id);
      fetchKeys();
      toast.success(ativo ? 'API Key ativada' : 'API Key desativada');
    } catch (err: any) {
      toast.error('Erro ao alterar status', { description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('api_keys').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchKeys();
    toast.success('API Key removida');
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.info('Chave copiada!');
  };

  const togglePermissao = (perm: string) => {
    setPermissoes(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const maskKey = (key: string) => key.substring(0, 12) + '••••••••••••••••••••';

  return (
    <div className="space-y-6">
      {/* New key revealed banner */}
      {newKeyRevealed && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">🔑 Nova API Key gerada — copie agora!</p>
                <code className="text-xs bg-muted p-1 rounded mt-1 block break-all">{newKeyRevealed}</code>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copyKey(newKeyRevealed)}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewKeyRevealed(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Documentation */}
      <Card className="border-dashed">
        <CardContent className="py-4 space-y-3">
          <h4 className="font-medium text-sm">📖 Como usar a API</h4>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>Envie requisições para a Edge Function <code className="bg-muted px-1 rounded">api-public</code> com o header <code className="bg-muted px-1 rounded">X-API-Key</code>.</p>
            <div className="bg-muted rounded p-3 font-mono text-[11px] overflow-x-auto whitespace-pre">{`# Listar riscos
curl -H "X-API-Key: gai_sua_chave_aqui" \\
  "${window.location.origin.replace('://','://lnlkahtugwmkznasapfd.supabase.co/functions/v1/')?.split('.lovable')[0] || 'https://lnlkahtugwmkznasapfd.supabase.co/functions/v1'}/api-public/riscos"

# Criar incidente
curl -X POST -H "X-API-Key: gai_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{"titulo":"Teste","tipo":"seguranca","gravidade":"media"}' \\
  "https://lnlkahtugwmkznasapfd.supabase.co/functions/v1/api-public/incidentes"`}</div>
            <p>Módulos disponíveis: <code className="bg-muted px-1 rounded">riscos</code>, <code className="bg-muted px-1 rounded">controles</code>, <code className="bg-muted px-1 rounded">incidentes</code>, <code className="bg-muted px-1 rounded">auditorias</code>, <code className="bg-muted px-1 rounded">documentos</code>, <code className="bg-muted px-1 rounded">ativos</code></p>
            <p>Paginação: <code className="bg-muted px-1 rounded">?page=1&limit=50</code> (máx 100 por página)</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">Gerencie as chaves de acesso à API pública do Akuris.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova API Key
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><AkurisPulse size={24} /></div>
      ) : keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma API Key criada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Requisições</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(key => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {revealedKeys.get(key.id) ? revealedKeys.get(key.id) : `${key.prefixo}••••••••••••••••••••`}
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                        if (revealedKeys.has(key.id)) {
                          setRevealedKeys(prev => {
                            const next = new Map(prev);
                            next.delete(key.id);
                            return next;
                          });
                          return;
                        }
                        const { data, error } = await supabase.rpc('get_api_key_full', { _id: key.id });
                        if (error || !data) {
                          toast.error('Não foi possível revelar a chave');
                          return;
                        }
                        setRevealedKeys(prev => new Map(prev).set(key.id, data as string));
                      }}>
                        {revealedKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                        const cached = revealedKeys.get(key.id);
                        if (cached) { copyKey(cached); return; }
                        const { data, error } = await supabase.rpc('get_api_key_full', { _id: key.id });
                        if (error || !data) { toast.error('Não foi possível copiar a chave'); return; }
                        copyKey(data as string);
                      }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(key.permissoes || []).slice(0, 3).map(p => (
                        <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                      ))}
                      {(key.permissoes || []).length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{key.permissoes.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{key.rate_limit_por_minuto}/min</TableCell>
                  <TableCell className="text-sm">{key.total_requisicoes?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Switch checked={key.ativo} onCheckedChange={v => handleToggle(key.id, v)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(key.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <DialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nova API Key"
        icon={Key}
        size="md"
        onSubmit={handleCreate}
        submitLabel="Gerar API Key"
        submitDisabled={!nome.trim() || saving}
        isSubmitting={saving}
        isDirty={!!nome || permissoes.length > 0}
      >
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Integração SIEM" />
          </div>
          <div>
            <Label>Rate Limit (req/min)</Label>
            <Select value={rateLimit} onValueChange={setRateLimit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/min</SelectItem>
                <SelectItem value="30">30/min</SelectItem>
                <SelectItem value="60">60/min</SelectItem>
                <SelectItem value="120">120/min</SelectItem>
                <SelectItem value="300">300/min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded border hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={permissoes.includes(p.value)}
                    onChange={() => togglePermissao(p.value)}
                    className="rounded"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogShell>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Excluir API Key"
        description="Esta ação é irreversível. Qualquer sistema que use esta chave perderá acesso."
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}
