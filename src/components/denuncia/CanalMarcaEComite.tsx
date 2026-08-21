/**
 * CanalMarcaEComite — o que faz do canal um produto que se revende.
 *
 * Três coisas que não existiam e sem as quais não se vende:
 *
 *  · **Marca.** A configuração tinha oito colunas e nenhuma era logótipo, cor
 *    ou idioma. O logótipo da empresa já era usado no canal (vem de
 *    `empresas.logo_url`), mas não havia como dar-lhe cor própria, nome de
 *    exibição diferente da razão social, nem escolher o idioma de abertura.
 *
 *  · **Prazos.** A Diretiva (UE) 2019/1937 fala de 7 dias e 3 meses; a regra
 *    muda com a jurisdição, por isso é campo e não constante.
 *
 *  · **Comité de ética.** A política do banco deixou de dar denúncia a toda a
 *    administração — passou a ser quem está aqui. Sem esta tela, a estrutura
 *    existia e ninguém conseguia mexer nela.
 *
 * E o código QR, que o concorrente anuncia: é o que resolve o cartaz na parede
 * da fábrica, onde não há quem digite uma URL.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconDownload, IconDelete, IconAdd } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Config {
  id: string;
  cor_destaque: string | null;
  nome_exibicao: string | null;
  idioma_padrao: string;
  prazo_acusacao_dias: number;
  prazo_retorno_dias: number;
  orgao_externo_nome: string | null;
  orgao_externo_url: string | null;
  texto_retaliacao: string | null;
  retencao_meses: number;
}

interface Membro {
  id: string;
  user_id: string;
  papel: string;
  nome: string | null;
  email: string | null;
}

export function CanalMarcaEComite() {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [novoMembro, setNovoMembro] = useState('');

  const { data: empresa } = useQuery({
    queryKey: ['empresa-slug', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from('empresas').select('slug, nome').eq('id', empresaId!).single();
      return data;
    },
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['denuncia-config-marca', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denuncias_configuracoes')
        .select('id, cor_destaque, nome_exibicao, idioma_padrao, prazo_acusacao_dias, prazo_retorno_dias, orgao_externo_nome, orgao_externo_url, texto_retaliacao, retencao_meses')
        .eq('empresa_id', empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data as Config | null;
    },
  });

  const [rascunho, setRascunho] = useState<Partial<Config>>({});
  const valor = <K extends keyof Config>(campo: K): Config[K] | undefined =>
    (rascunho[campo] ?? config?.[campo]) as Config[K] | undefined;

  const { data: comite = [] } = useQuery({
    queryKey: ['denuncia-comite', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: membros } = await supabase
        .from('denuncias_comite')
        .select('id, user_id, papel')
        .eq('empresa_id', empresaId!);
      if (!membros?.length) return [] as Membro[];

      const { data: perfis } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .in('user_id', membros.map((m) => m.user_id));

      return membros.map((m) => {
        const p = perfis?.find((x) => x.user_id === m.user_id);
        return { ...m, nome: p?.nome ?? null, email: p?.email ?? null };
      }) as Membro[];
    },
  });

  /* Quem pode entrar: gente da empresa que ainda não está no comité. */
  const { data: candidatos = [] } = useQuery({
    queryKey: ['denuncia-candidatos', empresaId, comite.length],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', empresaId!);
      const dentro = new Set(comite.map((m) => m.user_id));
      return (data ?? []).filter((p) => !dentro.has(p.user_id));
    },
  });

  const salvar = async () => {
    if (!config?.id) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('denuncias_configuracoes')
        .update({
          cor_destaque: valor('cor_destaque') || null,
          nome_exibicao: valor('nome_exibicao') || null,
          idioma_padrao: valor('idioma_padrao') ?? 'pt',
          prazo_acusacao_dias: Number(valor('prazo_acusacao_dias') ?? 7),
          prazo_retorno_dias: Number(valor('prazo_retorno_dias') ?? 90),
          orgao_externo_nome: valor('orgao_externo_nome') || null,
          orgao_externo_url: valor('orgao_externo_url') || null,
          texto_retaliacao: valor('texto_retaliacao') || null,
          retencao_meses: Number(valor('retencao_meses') ?? 60),
        })
        .eq('id', config.id);
      if (error) throw error;
      setRascunho({});
      queryClient.invalidateQueries({ queryKey: ['denuncia-config-marca', empresaId] });
      toast.success(t('denunciasAdmin.marca.salvo'));
    } catch {
      toast.error(t('denunciasAdmin.marca.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  };

  const adicionarMembro = async () => {
    if (!novoMembro || !empresaId) return;
    const { error } = await supabase
      .from('denuncias_comite')
      .insert({ empresa_id: empresaId, user_id: novoMembro, papel: 'gestor' });
    if (error) return toast.error(t('denunciasAdmin.marca.erroComite'));
    setNovoMembro('');
    queryClient.invalidateQueries({ queryKey: ['denuncia-comite', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['denuncia-candidatos', empresaId] });
  };

  const removerMembro = async (id: string) => {
    const { error } = await supabase.from('denuncias_comite').delete().eq('id', id);
    if (error) return toast.error(t('denunciasAdmin.marca.erroComite'));
    queryClient.invalidateQueries({ queryKey: ['denuncia-comite', empresaId] });
    queryClient.invalidateQueries({ queryKey: ['denuncia-candidatos', empresaId] });
  };

  const urlCanal = empresa?.slug ? `${window.location.origin}/${empresa.slug}/denuncia` : '';

  const baixarQr = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-canal canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `canal-denuncia-${empresa?.slug ?? 'qr'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <AkurisPulse size={32} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('denunciasAdmin.marca.tituloMarca')}</CardTitle>
          <CardDescription>{t('denunciasAdmin.marca.descricaoMarca')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="nome_exibicao">{t('denunciasAdmin.marca.nomeExibicao')}</Label>
              <Input
                id="nome_exibicao"
                value={valor('nome_exibicao') ?? ''}
                onChange={(e) => setRascunho({ ...rascunho, nome_exibicao: e.target.value })}
                placeholder={empresa?.nome ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cor_destaque">{t('denunciasAdmin.marca.corDestaque')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cor_destaque"
                  type="color"
                  className="h-9 w-14 p-1"
                  value={valor('cor_destaque') ?? '#7452FF'}
                  onChange={(e) => setRascunho({ ...rascunho, cor_destaque: e.target.value })}
                />
                <Input
                  value={valor('cor_destaque') ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, cor_destaque: e.target.value })}
                  placeholder="#7452FF"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idioma">{t('denunciasAdmin.marca.idioma')}</Label>
              <Select
                value={valor('idioma_padrao') ?? 'pt'}
                onValueChange={(v) => setRascunho({ ...rascunho, idioma_padrao: v })}
              >
                <SelectTrigger id="idioma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prazos legais: campo e não constante, porque a regra muda com a jurisdição. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prazo_acusacao">{t('denunciasAdmin.marca.prazoAcusacao')}</Label>
              <Input
                id="prazo_acusacao"
                type="number"
                min={1}
                value={valor('prazo_acusacao_dias') ?? 7}
                onChange={(e) => setRascunho({ ...rascunho, prazo_acusacao_dias: Number(e.target.value) })}
              />
              <p className="text-micro text-muted-foreground">{t('denunciasAdmin.marca.prazoAcusacaoAjuda')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo_retorno">{t('denunciasAdmin.marca.prazoRetorno')}</Label>
              <Input
                id="prazo_retorno"
                type="number"
                min={1}
                value={valor('prazo_retorno_dias') ?? 90}
                onChange={(e) => setRascunho({ ...rascunho, prazo_retorno_dias: Number(e.target.value) })}
              />
              <p className="text-micro text-muted-foreground">{t('denunciasAdmin.marca.prazoRetornoAjuda')}</p>
            </div>
          </div>

          {/*
            O que a Diretiva (UE) 2019/1937 obriga a INFORMAR — e que aparece
            no rodapé das três telas públicas. Não é aviso legal: é o que faz
            alguém decidir falar.
          */}
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
              {t('denunciasAdmin.marca.tituloDireitos')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orgao_nome">{t('denunciasAdmin.marca.orgaoNome')}</Label>
                <Input
                  id="orgao_nome"
                  value={valor('orgao_externo_nome') ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, orgao_externo_nome: e.target.value })}
                  placeholder={t('denunciasAdmin.marca.orgaoNomePlaceholder')}
                />
                <p className="text-micro text-muted-foreground">{t('denunciasAdmin.marca.orgaoAjuda')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgao_url">{t('denunciasAdmin.marca.orgaoUrl')}</Label>
                <Input
                  id="orgao_url"
                  value={valor('orgao_externo_url') ?? ''}
                  onChange={(e) => setRascunho({ ...rascunho, orgao_externo_url: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retaliacao">{t('denunciasAdmin.marca.retaliacao')}</Label>
              <Textarea
                id="retaliacao"
                rows={3}
                value={valor('texto_retaliacao') ?? ''}
                onChange={(e) => setRascunho({ ...rascunho, texto_retaliacao: e.target.value })}
                placeholder={t('denunciasAdmin.marca.retaliacaoPlaceholder')}
              />
              <p className="text-micro text-muted-foreground">{t('denunciasAdmin.marca.retaliacaoAjuda')}</p>
            </div>

            <div className="max-w-[16rem] space-y-2">
              <Label htmlFor="retencao">{t('denunciasAdmin.marca.retencao')}</Label>
              <Input
                id="retencao"
                type="number"
                min={1}
                value={valor('retencao_meses') ?? 60}
                onChange={(e) => setRascunho({ ...rascunho, retencao_meses: Number(e.target.value) })}
              />
              <p className="text-micro text-muted-foreground">{t('denunciasAdmin.marca.retencaoAjuda')}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={salvar} disabled={salvando}>{t('denunciasAdmin.marca.salvar')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('denunciasAdmin.marca.tituloQr')}</CardTitle>
          <CardDescription>{t('denunciasAdmin.marca.descricaoQr')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div id="qr-canal" className="rounded-lg border border-border bg-white p-3">
            {urlCanal && <QRCodeCanvas value={urlCanal} size={148} level="M" includeMargin={false} />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all text-xs text-muted-foreground">{urlCanal}</p>
            <Button variant="outline" size="sm" onClick={baixarQr}>
              <IconDownload className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('denunciasAdmin.marca.baixarQr')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('denunciasAdmin.marca.tituloComite')}</CardTitle>
          <CardDescription>{t('denunciasAdmin.marca.descricaoComite')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {comite.length === 0 ? (
            <p className="text-sm text-severity-critical">{t('denunciasAdmin.marca.comiteVazio')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {comite.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{m.nome ?? m.user_id}</span>
                    <span className="block truncate text-micro text-muted-foreground">{m.email ?? ''}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => removerMembro(m.id)}>
                    <IconDelete className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="novo-membro">{t('denunciasAdmin.marca.adicionarMembro')}</Label>
              <Select value={novoMembro} onValueChange={setNovoMembro}>
                <SelectTrigger id="novo-membro">
                  <SelectValue placeholder={t('denunciasAdmin.marca.escolherPessoa')} />
                </SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.nome ?? c.email ?? c.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={adicionarMembro} disabled={!novoMembro}>
              <IconAdd className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('denunciasAdmin.marca.adicionar')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
