/**
 * Biblioteca de riscos — catálogo global de cenários pré-construídos.
 *
 * A importação corre na RPC `importar_riscos_biblioteca`, que resolve a empresa
 * do utilizador autenticado no servidor (isolamento multi-tenant garantido em
 * base de dados, não no cliente).
 */
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { akurisToast } from '@/lib/akuris-toast';
import { logger } from '@/lib/logger';
import { IconCheck, IconBook, IconSearch } from '@/components/icons';
import {
  useRiscosBiblioteca,
  useRiscosBibliotecaImportados,
  useImportarBiblioteca,
  type RiscoBiblioteca,
} from '@/hooks/useRiscosBiblioteca';

interface BibliotecaRiscosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após uma importação com sucesso (refetch da lista de riscos). */
  onSuccess: () => void | Promise<void>;
}

const CATEGORIA_LABEL: Record<string, { pt: string; en: string }> = {
  Organizacional: { pt: 'Organizacional', en: 'Organizational' },
  Pessoas: { pt: 'Pessoas', en: 'People' },
  Fisico: { pt: 'Físico', en: 'Physical' },
  Tecnologico: { pt: 'Tecnológico', en: 'Technological' },
  Privacidade: { pt: 'Privacidade', en: 'Privacy' },
};

/**
 * Tipos de ativo: os mesmos valores usados na Gestão de Ativos, com os rótulos
 * oficiais do dicionário `contratosAtivos.ativoDialog.*` (sem tradutor no meio).
 */
const TIPO_ATIVO_I18N: Record<string, string> = {
  servidor: 'typeServidor',
  aplicacao: 'typeAplicacao',
  banco_dados: 'typeBancoDados',
  rede: 'typeRede',
  endpoint: 'typeEndpoint',
  dispositivo_movel: 'typeDispositivoMovel',
  armazenamento: 'typeArmazenamento',
  software: 'typeSoftware',
  hardware: 'typeHardware',
  estrutura_fisica: 'typeEstruturaFisica',
  controle_acesso: 'typeControleAcesso',
  equipamento_seguranca: 'typeEquipamentoSeguranca',
  sistema_monitoramento: 'typeSistemaMonitoramento',
  mobiliario: 'typeMobiliario',
  equipamento_escritorio: 'typeEquipamentoEscritorio',
  equipamento_comunicacao: 'typeEquipamentoComunicacao',
  imovel: 'typeImovel',
  outros: 'typeOutros',
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function BibliotecaRiscosDialog({
  open,
  onOpenChange,
  onSuccess,
}: BibliotecaRiscosDialogProps) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'pt';

  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [origem, setOrigem] = useState('todas');
  const [ocultarImportados, setOcultarImportados] = useState(true);
  const [mapearControlos, setMapearControlos] = useState(true);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const { data: cenarios = [], isLoading } = useRiscosBiblioteca(open);
  const { data: importados = new Set<string>() } = useRiscosBibliotecaImportados(open);
  const importar = useImportarBiblioteca();

  const categorias = useMemo(
    () => Array.from(new Set(cenarios.map((c) => c.categoria))).sort(),
    [cenarios],
  );
  const origens = useMemo(
    () => Array.from(new Set(cenarios.map((c) => c.origem).filter(Boolean) as string[])).sort(),
    [cenarios],
  );

  const filtrados = useMemo(() => {
    const termo = normalize(busca.trim());
    return cenarios.filter((c) => {
      if (categoria !== 'todas' && c.categoria !== categoria) return false;
      if (origem !== 'todas' && c.origem !== origem) return false;
      if (ocultarImportados && importados.has(c.codigo) && !selecionados.has(c.codigo)) return false;
      if (!termo) return true;
      const haystack = normalize(
        [
          c.codigo,
          c.titulo,
          c.descricao,
          ...(c.causas ?? []),
          ...(c.consequencias ?? []),
          ...(c.tags ?? []),
          ...(c.controlos_recomendados ?? []),
          ...(c.tipos_ativo ?? []),
        ].join(' '),
      );
      return haystack.includes(termo);
    });
  }, [cenarios, busca, categoria, origem, ocultarImportados, importados, selecionados]);

  const toggle = (codigo: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const selecionarVisiveis = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      filtrados.forEach((c) => {
        if (!importados.has(c.codigo)) next.add(c.codigo);
      });
      return next;
    });
  };

  const handleImportar = async () => {
    const codigos = Array.from(selecionados);
    if (codigos.length === 0) return;
    try {
      const res = await importar.mutateAsync({ codigos, mapearControlos });
      await onSuccess();
      setSelecionados(new Set());
      if (!res?.criados) {
        akurisToast({
          module: 'riscos',
          tone: 'info',
          title: t('riscosBiblioteca.sucessoTitulo'),
          description: t('riscosBiblioteca.nadaCriado'),
        });
      } else {
        akurisToast({
          module: 'riscos',
          tone: 'success',
          title: t('riscosBiblioteca.sucessoTitulo'),
          description: t('riscosBiblioteca.sucessoDesc', {
            criados: res.criados,
            ligacoes: res.ligacoes_criadas ?? 0,
            duplicados: res.ignorados_duplicados ?? 0,
          }),
        });
        onOpenChange(false);
      }
    } catch (error) {
      logger.error('Falha ao importar cenários da biblioteca de riscos', error);
      akurisToast({
        module: 'riscos',
        tone: 'destructive',
        title: t('riscosBiblioteca.erroTitulo'),
        description: t('riscosBiblioteca.erroDesc'),
      });
    }
  };

  const renderCard = (c: RiscoBiblioteca) => {
    const jaImportado = importados.has(c.codigo);
    const marcado = selecionados.has(c.codigo);
    return (
      <li
        key={c.codigo}
        className={`rounded-lg border p-4 transition-colors ${
          marcado ? 'border-primary/60 bg-primary/5' : 'border-border bg-card'
        }`}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-1"
            checked={marcado}
            disabled={jaImportado}
            onCheckedChange={() => toggle(c.codigo)}
            aria-label={c.titulo}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {c.codigo}
              </span>
              <Badge variant="outline" className="text-micro">
                {CATEGORIA_LABEL[c.categoria]?.[lang] ?? c.categoria}
              </Badge>
              {c.origem && (
                <Badge variant="secondary" className="text-micro">
                  {c.origem}
                </Badge>
              )}
              <span className="text-micro text-muted-foreground">
                {t('riscosBiblioteca.sugestao', {
                  p: c.probabilidade_sugerida,
                  i: c.impacto_sugerido,
                })}
              </span>
              {jaImportado && (
                <span className="inline-flex items-center gap-1 text-micro text-success">
                  <IconCheck className="h-3 w-3" strokeWidth={2} />
                  {t('riscosBiblioteca.jaImportado')}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm font-semibold leading-tight text-foreground">{c.titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.descricao}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!!c.causas?.length && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('riscosBiblioteca.causas')}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                    {c.causas.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!c.consequencias?.length && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('riscosBiblioteca.consequencias')}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                    {c.consequencias.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {!!c.tipos_ativo?.length && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('riscosBiblioteca.tiposAtivo')}
                </span>
                {c.tipos_ativo.map((tipo) => (
                  <Badge key={tipo} variant="secondary" className="text-micro">
                    {TIPO_ATIVO_I18N[tipo]
                      ? t(`contratosAtivos.ativoDialog.${TIPO_ATIVO_I18N[tipo]}`)
                      : tipo}
                  </Badge>
                ))}
              </div>
            )}

            {!!c.controlos_recomendados?.length && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('riscosBiblioteca.controlos')}
                </span>
                {c.controlos_recomendados.map((code) => (
                  <Badge key={code} variant="outline" className="text-micro">
                    {code}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-5xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center text-primary shrink-0">
              <IconBook className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('riscos.page.newRiskAria')}
              </span>
              <span className="text-base font-semibold leading-tight">
                {t('riscosBiblioteca.titulo')}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="pl-12">
            {t('riscosBiblioteca.descricao')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-shrink-0 border-b px-6 py-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t('riscosBiblioteca.pesquisar')}
                className="pl-9"
              />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="sm:w-[190px]">
                <SelectValue placeholder={t('riscosBiblioteca.categoria')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">{t('riscosBiblioteca.todasCategorias')}</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIA_LABEL[c]?.[lang] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder={t('riscosBiblioteca.origem')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">{t('riscosBiblioteca.todasOrigens')}</SelectItem>
                {origens.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="ocultar-importados"
                checked={ocultarImportados}
                onCheckedChange={setOcultarImportados}
              />
              <Label htmlFor="ocultar-importados" className="text-sm font-normal">
                {t('riscosBiblioteca.apenasNaoImportados')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="mapear-controlos"
                checked={mapearControlos}
                onCheckedChange={setMapearControlos}
              />
              <Label
                htmlFor="mapear-controlos"
                className="text-sm font-normal"
                title={t('riscosBiblioteca.mapearControlosAjuda')}
              >
                {t('riscosBiblioteca.mapearControlos')}
              </Label>
            </div>
            <Button variant="ghost" size="sm" onClick={selecionarVisiveis}>
              {t('riscosBiblioteca.selecionarTodos')}
            </Button>
            {selecionados.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
                {t('riscosBiblioteca.limparSelecao')}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-16">
              <AkurisPulse />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
              {t('riscosBiblioteca.semResultados')}
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <ul className="space-y-3 px-6 py-4">{filtrados.map(renderCard)}</ul>
            </ScrollArea>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t('riscosBiblioteca.selecionados', { count: selecionados.size })} ·{' '}
            {t('riscosBiblioteca.revisao')}
          </p>
          <Button
            onClick={handleImportar}
            disabled={selecionados.size === 0 || importar.isPending}
          >
            {importar.isPending
              ? t('riscosBiblioteca.importando')
              : t('riscosBiblioteca.importar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
