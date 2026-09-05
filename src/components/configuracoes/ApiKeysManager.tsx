import { useState, useEffect } from 'react';
import { IconAdd, IconDelete, IconKey, IconCopy } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

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

const PERMISSOES_DISPONIVEIS: { value: string; labelKey: string }[] = [
  { value: 'riscos:read', labelKey: 'riscosRead' },
  { value: 'riscos:write', labelKey: 'riscosWrite' },
  { value: 'controles:read', labelKey: 'controlesRead' },
  { value: 'controles:write', labelKey: 'controlesWrite' },
  { value: 'incidentes:read', labelKey: 'incidentesRead' },
  { value: 'incidentes:write', labelKey: 'incidentesWrite' },
  { value: 'auditorias:read', labelKey: 'auditoriasRead' },
  { value: 'documentos:read', labelKey: 'documentosRead' },
  { value: 'ativos:read', labelKey: 'ativosRead' },
  { value: 'ativos:write', labelKey: 'ativosWrite' },
];

/**
 * Base da API pública. Vem da mesma variável que configura o cliente Supabase —
 * antes era uma expressão que trocava "://" pelo domínio do projeto e produzia
 * `http://<projeto>.supabase.co/functions/v1/localhost:3000/...`, ou seja, a
 * documentação entregava ao cliente um curl que não funciona em lado nenhum.
 */
const API_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://lnlkahtugwmkznasapfd.supabase.co'}/functions/v1`;

export function ApiKeysManager() {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
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
      // O segredo nunca desce na listagem. O servidor só o devolve uma vez,
      // no instante da criação; no banco permanece apenas o SHA-256.
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, nome, prefixo, permissoes, rate_limit_por_minuto, ativo, ultimo_uso, total_requisicoes, created_at, expires_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setKeys((data || []) as ApiKey[]);
    } catch (err: any) {
      toast.error(t('configPlanos.apiKeys.toastLoadError'), { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!empresaId || !nome.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_api_key_secure', {
        p_nome: nome.trim(),
        p_permissoes: permissoes,
        p_rate_limit: parseInt(rateLimit, 10) || 60,
      });

      if (error) throw error;
      const created = Array.isArray(data) ? data[0] : data;
      const key = created?.api_key;
      if (!key) throw new Error('A chave não foi devolvida pelo servidor.');

      setNewKeyRevealed(key);
      toast.success(t('configPlanos.apiKeys.toastCreatedTitle'), { description: t('configPlanos.apiKeys.toastCreatedDesc') });
      setDialogOpen(false);
      setNome('');
      setPermissoes([]);
      setRateLimit('60');
      fetchKeys();
    } catch (err: any) {
      toast.error(t('configPlanos.apiKeys.toastCreateError'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /**
   * O cliente Supabase devolve `{ error }`; não lança. Com o `await` dentro de
   * um try/catch, o catch era código morto e o toast de sucesso disparava
   * mesmo quando a RLS recusava — a chave continuava ativa na tela seguinte,
   * depois do utilizador já ter lido "desativada com sucesso".
   */
  const handleToggle = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('api_keys').update({ ativo }).eq('id', id);
    if (error) {
      toast.error(t('configPlanos.apiKeys.toastToggleError'), { description: error.message });
      fetchKeys();
      return;
    }
    fetchKeys();
    toast.success(ativo ? t('configPlanos.apiKeys.toastToggleOn') : t('configPlanos.apiKeys.toastToggleOff'));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchKeys();
    if (error) {
      toast.error(t('configPlanos.apiKeys.toastRemoveError'), { description: error.message });
      return;
    }
    toast.success(t('configPlanos.apiKeys.toastRemoved'));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.info(t('configPlanos.apiKeys.keyCopied'));
  };

  const togglePermissao = (perm: string) => {
    setPermissoes(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  return (
    <div className="space-y-6">
      {/* New key revealed banner */}
      {newKeyRevealed && (
        <Card className="border-warning/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('configPlanos.apiKeys.newKeyBanner')}</p>
                <code className="text-xs bg-muted p-1 rounded mt-1 block break-all">{newKeyRevealed}</code>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copyKey(newKeyRevealed)}>
                  <IconCopy className="h-4 w-4 mr-1" /> {t('configPlanos.apiKeys.copy')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewKeyRevealed(null)}>
                  {t('configPlanos.apiKeys.close')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Documentation */}
      <Card className="border-dashed">
        <CardContent className="py-4 space-y-3">
          <h4 className="font-medium text-sm">{t('configPlanos.apiKeys.docTitle')}</h4>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>{t('configPlanos.apiKeys.docIntro').split('{func}')[0]}<code className="bg-muted px-1 rounded">api-public</code>{t('configPlanos.apiKeys.docIntro').split('{func}')[1].split('{header}')[0]}<code className="bg-muted px-1 rounded">X-API-Key</code>{t('configPlanos.apiKeys.docIntro').split('{header}')[1]}</p>
            <div className="bg-muted rounded p-3 font-mono text-micro overflow-x-auto whitespace-pre">{`# Listar riscos
curl -H "X-API-Key: gai_sua_chave_aqui" \\
  "${API_BASE}/api-public/riscos"

# Criar incidente
curl -X POST -H "X-API-Key: gai_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{"titulo":"Teste","tipo_incidente":"seguranca","criticidade":"media"}' \\
  "${API_BASE}/api-public/incidentes"`}</div>
            <p>{t('configPlanos.apiKeys.docModulos').split('{modulos}')[0]}<code className="bg-muted px-1 rounded">riscos</code>, <code className="bg-muted px-1 rounded">controles</code>, <code className="bg-muted px-1 rounded">incidentes</code>, <code className="bg-muted px-1 rounded">auditorias</code>, <code className="bg-muted px-1 rounded">documentos</code>, <code className="bg-muted px-1 rounded">ativos</code></p>
            <p>{t('configPlanos.apiKeys.docPaginacao').split('{exemplo}')[0]}<code className="bg-muted px-1 rounded">?page=1&limit=50</code>{t('configPlanos.apiKeys.docPaginacao').split('{exemplo}')[1]}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('configPlanos.apiKeys.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('configPlanos.apiKeys.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <IconAdd className="h-4 w-4" /> {t('configPlanos.apiKeys.newButton')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><AkurisPulse size={24} /></div>
      ) : keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <IconKey className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t('configPlanos.apiKeys.emptyState')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('configPlanos.apiKeys.colNome')}</TableHead>
                <TableHead>{t('configPlanos.apiKeys.colChave')}</TableHead>
                <TableHead>{t('configPlanos.apiKeys.colPermissoes')}</TableHead>
                <TableHead>{t('configPlanos.apiKeys.colRateLimit')}</TableHead>
                <TableHead>{t('configPlanos.apiKeys.colRequisicoes')}</TableHead>
                <TableHead>{t('configPlanos.apiKeys.colStatus')}</TableHead>
                <TableHead className="w-[100px]">{t('configPlanos.apiKeys.colAcoes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(key => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.nome}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded" title="O segredo só é exibido na criação">
                      {`${key.prefixo}••••••••••••••••••••`}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(key.permissoes || []).slice(0, 3).map(p => (
                        <Badge key={p} variant="outline" className="text-micro">{p}</Badge>
                      ))}
                      {(key.permissoes || []).length > 3 && (
                        <Badge variant="outline" className="text-micro">+{key.permissoes.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{key.rate_limit_por_minuto}/min</TableCell>
                  <TableCell className="text-sm">{key.total_requisicoes?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Switch checked={key.ativo} onCheckedChange={v => handleToggle(key.id, v)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleteConfirm(key.id)}>
                      <IconDelete className="h-4 w-4" />
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
        title={t('configPlanos.apiKeys.dialogTitle')}
        icon={IconKey}
        size="md"
        onSubmit={handleCreate}
        submitLabel={t('configPlanos.apiKeys.submitLabel')}
        submitDisabled={!nome.trim() || saving}
        isSubmitting={saving}
        isDirty={!!nome || permissoes.length > 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">{t('configPlanos.apiKeys.fieldNome')}</Label>
            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={t('configPlanos.apiKeys.fieldNomePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('configPlanos.apiKeys.fieldRateLimit')}</Label>
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
          <div className="space-y-2">
            <Label>{t('configPlanos.apiKeys.fieldPermissoes')}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded border hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={permissoes.includes(p.value)}
                    onChange={() => togglePermissao(p.value)}
                    className="rounded"
                  />
                  {t(`configPlanos.apiKeys.permissoes.${p.labelKey}`)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogShell>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title={t('configPlanos.apiKeys.deleteTitle')}
        description={t('configPlanos.apiKeys.deleteDescription')}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}
