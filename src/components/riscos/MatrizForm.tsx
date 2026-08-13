import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, Trash2, Edit, Grid3X3, AlertTriangle, X as XIcon, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const COLOR_PALETTE = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#dc2626', '#6b7280', '#3b82f6', '#7552ff'];

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('fin.riscos.matrizForm.selecionarCor')}
          className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                'h-7 w-7 rounded-md border transition-all hover:scale-110',
                value === c ? 'border-foreground ring-2 ring-foreground/20' : 'border-border'
              )}
              style={{ backgroundColor: c }}
              aria-label={t('sweepRiscos.riscos.matrizForm.corAria', { cor: c })}
            />
          ))}
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono"
          placeholder="#hex"
        />
      </PopoverContent>
    </Popover>
  );
}

const makeMatrizSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('fin.validacao.nomeObrigatorio')),
  descricao: z.string().optional(),
});

const makeCategoriaSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('fin.validacao.nomeObrigatorio')),
  descricao: z.string().optional(),
  cor: z.string().optional(),
});

type MatrizForm = z.infer<ReturnType<typeof makeMatrizSchema>>;
type CategoriaForm = z.infer<ReturnType<typeof makeCategoriaSchema>>;

interface EscalaItem {
  valor: string;
  descricao: string;
}

interface NivelRisco {
  min: number;
  max: number;
  nivel: string;
  cor: string;
  /** Marca o nível como limite de apetite: riscos acima do seu `max` ficam "acima do apetite". */
  apetite?: boolean;
}

interface Matriz {
  id: string;
  nome: string;
  descricao?: string;
  configuracao?: {
    escala_probabilidade: EscalaItem[];
    escala_impacto: EscalaItem[];
    niveis_risco: NivelRisco[];
    metodo_calculo?: string;
  };
}


interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor?: string;
}

interface Props {
  onSuccess: () => void;
}

export function MatrizForm({ onSuccess }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingMatriz, setEditingMatriz] = useState<Matriz | null>(null);
  // Modo explícito de criação: só entra aqui via botão "Nova matriz".
  // Sem isto o modal reabre num formulário vazio e induz a criação de duplicados.
  const [modoNovo, setModoNovo] = useState(false);

  
  // Estado para ConfirmDialog de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [matrizToDelete, setMatrizToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Estado para erros de validação de faixas
  const [faixasError, setFaixasError] = useState<string | null>(null);
  
  // Escalas para configuração da matriz
  const [escalaProbabilidade, setEscalaProbabilidade] = useState<EscalaItem[]>([
    { valor: '1', descricao: 'Muito Raro' },
    { valor: '2', descricao: 'Raro' },
    { valor: '3', descricao: 'Ocasional' },
    { valor: '4', descricao: 'Provável' },
    { valor: '5', descricao: 'Muito Provável' }
  ]);
  
  const [escalaImpacto, setEscalaImpacto] = useState<EscalaItem[]>([
    { valor: '1', descricao: 'Insignificante' },
    { valor: '2', descricao: 'Menor' },
    { valor: '3', descricao: 'Moderado' },
    { valor: '4', descricao: 'Maior' },
    { valor: '5', descricao: 'Catastrófico' }
  ]);

  const [niveisRisco, setNiveisRisco] = useState<NivelRisco[]>([
    { min: 1, max: 4, nivel: 'Baixo', cor: '#22c55e' },
    { min: 5, max: 9, nivel: 'Médio', cor: '#eab308', apetite: true },
    { min: 10, max: 16, nivel: 'Alto', cor: '#f97316' },
    { min: 17, max: 25, nivel: 'Crítico', cor: '#dc2626' }
  ]);

  const [metodoCalculo, setMetodoCalculo] = useState<'multiplicacao' | 'soma'>('multiplicacao');

  const matrizSchema = useMemo(() => makeMatrizSchema(t), [t]);
  const categoriaSchema = useMemo(() => makeCategoriaSchema(t), [t]);

  const matrizForm = useForm<MatrizForm>({
    resolver: zodResolver(matrizSchema),
    defaultValues: {
      nome: '',
      descricao: ''
    }
  });

  const categoriaForm = useForm<CategoriaForm>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      cor: '#3b82f6'
    }
  });

  useEffect(() => {
    fetchData(true);
  }, [profile?.empresa_id]);


  // Validar faixas sempre que niveisRisco mudar
  useEffect(() => {
    const error = validarFaixasNiveisRisco();
    setFaixasError(error);
  }, [niveisRisco]);

  const fetchData = async (autoCarregar = false) => {
    if (!profile?.empresa_id) return;
    try {
      // Buscar matrizes existentes com suas configurações
      const { data: matrizesData } = await supabase
        .from('riscos_matrizes')
        .select(`
          id, nome, descricao,
          configuracao:riscos_matriz_configuracao(
            escala_probabilidade,
            escala_impacto,
            niveis_risco,
            metodo_calculo
          )
        `)
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });

      const matrizesComConfig = matrizesData?.map(matriz => ({
        ...matriz,
        configuracao: matriz.configuracao?.[0] ? {
          escala_probabilidade: (matriz.configuracao[0].escala_probabilidade as unknown) as EscalaItem[],
          escala_impacto: (matriz.configuracao[0].escala_impacto as unknown) as EscalaItem[],
          niveis_risco: (matriz.configuracao[0].niveis_risco as unknown) as NivelRisco[],
          metodo_calculo: matriz.configuracao[0].metodo_calculo || 'multiplicacao'
        } : undefined
      })) || [];

      setMatrizes(matrizesComConfig);

      // UX: ao abrir com matriz já existente, editar a ativa em vez de um form vazio.
      if (autoCarregar) {
        const ativa = matrizesComConfig.find(m => m.configuracao) || matrizesComConfig[0];
        if (ativa) carregarMatrizParaEdicao(ativa);
        else setModoNovo(true);
      }

      // Buscar categorias existentes
      const { data: categoriasData } = await supabase
        .from('riscos_categorias')
        .select('id, nome, descricao, cor')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });

      setCategorias(categoriasData || []);
    } catch (error: any) {
      toast.error(t('fin.comum.erroCarregarDados', { mensagem: error.message }));
    }
  };

  const carregarMatrizParaEdicao = (matriz: Matriz) => {
    setEditingMatriz(matriz);
    setModoNovo(false);
    matrizForm.setValue('nome', matriz.nome);
    matrizForm.setValue('descricao', matriz.descricao || '');
    
    if (matriz.configuracao) {
      setEscalaProbabilidade(matriz.configuracao.escala_probabilidade);
      setEscalaImpacto(matriz.configuracao.escala_impacto);
      setNiveisRisco(matriz.configuracao.niveis_risco);
      setMetodoCalculo((matriz.configuracao.metodo_calculo as 'multiplicacao' | 'soma') || 'multiplicacao');
    }
  };

  /** Resumo curto para distinguir matrizes na lista e no seletor. */
  const resumoMatriz = (matriz: Matriz): string | null => {
    const cfg = matriz.configuracao;
    if (!cfg) return null;
    const metodo = cfg.metodo_calculo === 'soma' ? 'P + I' : 'P × I';
    const apetite = [...(cfg.niveis_risco || [])].find(n => n.apetite);
    const params = {
      p: cfg.escala_probabilidade?.length || 0,
      i: cfg.escala_impacto?.length || 0,
      metodo,
    };
    return apetite
      ? t('sweepRiscos.riscos.matrizForm.resumo', { ...params, apetite: apetite.max })
      : t('sweepRiscos.riscos.matrizForm.resumoSemApetite', params);
  };


  const limparFormularioMatriz = () => {
    setEditingMatriz(null);
    setModoNovo(false);

    matrizForm.reset();
    setEscalaProbabilidade([
      { valor: '1', descricao: 'Muito Raro' },
      { valor: '2', descricao: 'Raro' },
      { valor: '3', descricao: 'Ocasional' },
      { valor: '4', descricao: 'Provável' },
      { valor: '5', descricao: 'Muito Provável' }
    ]);
    setEscalaImpacto([
      { valor: '1', descricao: 'Insignificante' },
      { valor: '2', descricao: 'Menor' },
      { valor: '3', descricao: 'Moderado' },
      { valor: '4', descricao: 'Maior' },
      { valor: '5', descricao: 'Catastrófico' }
    ]);
    setNiveisRisco([
      { min: 1, max: 4, nivel: 'Baixo', cor: '#22c55e' },
      { min: 5, max: 9, nivel: 'Médio', cor: '#eab308' },
      { min: 10, max: 16, nivel: 'Alto', cor: '#f97316' },
      { min: 17, max: 25, nivel: 'Crítico', cor: '#dc2626' }
    ]);
    setMetodoCalculo('multiplicacao');
    setFaixasError(null);
  };

  /** Entrada explícita no modo de criação (evita duplicados acidentais). */
  const iniciarNovaMatriz = () => {
    limparFormularioMatriz();
    setModoNovo(true);
  };

  /** Cancelar edição: descarta alterações e volta à matriz carregada. */
  const cancelarEdicao = () => {
    if (editingMatriz) {
      carregarMatrizParaEdicao(editingMatriz);
      return;
    }
    limparFormularioMatriz();
    const ativa = matrizes.find(m => m.configuracao) || matrizes[0];
    if (ativa) carregarMatrizParaEdicao(ativa);
  };



  // Validação de sobreposição e gaps nas faixas de níveis de risco
  const validarFaixasNiveisRisco = (): string | null => {
    if (niveisRisco.length === 0) return null;
    
    // Ordenar por min
    const niveisOrdenados = [...niveisRisco].sort((a, b) => a.min - b.min);
    
    for (let i = 0; i < niveisOrdenados.length; i++) {
      const nivel = niveisOrdenados[i];
      
      // Validar que min <= max
      if (nivel.min > nivel.max) {
        return t('sweepRiscos.riscos.matrizForm.erroMinMaior', { nivel: nivel.nivel || `#${i + 1}` });
      }
      
      // Validar sobreposição com próximo nível
      if (i < niveisOrdenados.length - 1) {
        const proximoNivel = niveisOrdenados[i + 1];
        
        // Sobreposição
        if (nivel.max >= proximoNivel.min) {
          return t('sweepRiscos.riscos.matrizForm.erroSobreposicao', { nivelA: nivel.nivel || `#${i + 1}`, max: nivel.max, nivelB: proximoNivel.nivel || `#${i + 2}`, min: proximoNivel.min });
        }
        
        // Gap (valores não cobertos)
        if (nivel.max + 1 < proximoNivel.min) {
          return t('sweepRiscos.riscos.matrizForm.erroGap', { de: nivel.max + 1, ate: proximoNivel.min - 1 });
        }
      }
    }
    
    return null;
  };

  /** Traduz falhas do Postgres/PostgREST em mensagens compreensíveis (nunca o erro cru). */
  const mensagemErroMatriz = (error: any): string => {
    const raw = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
    if (raw.includes('riscos_matrizes_empresa_nome_uidx') || error?.code === '23505') {
      return t('sweepRiscos.riscos.matrizForm.erroNomeDuplicado');
    }
    if (raw.includes('NOME_OBRIGATORIO')) return t('sweepRiscos.riscos.matrizForm.erroNomeObrigatorio');
    if (raw.includes('MATRIZ_NAO_ENCONTRADA')) return t('sweepRiscos.riscos.matrizForm.erroMatrizNaoEncontrada');
    if (raw.includes('EMPRESA_NAO_ENCONTRADA') || error?.code === '42501') {
      return t('sweepRiscos.riscos.matrizForm.erroPermissao');
    }
    return t('sweepRiscos.riscos.matrizForm.erroGenerico');
  };

  const onSubmitMatriz = async (data: MatrizForm) => {
    if (!profile?.empresa_id) {
      toast.error(t('fin.riscos.wizard.erroEmpresa'));
      return;
    }

    // Validar faixas antes de salvar
    const faixasValidation = validarFaixasNiveisRisco();
    if (faixasValidation) {
      toast.error(faixasValidation);
      return;
    }

    setLoading(true);

    try {
      // Gravação atômica: matriz + configuração numa única transação no banco.
      // Se a configuração falhar, a matriz não fica gravada (sem matrizes órfãs).
      const { data: matrizId, error } = await supabase.rpc('criar_matriz_com_configuracao', {
        p_nome: data.nome.trim(),
        p_descricao: data.descricao || null,
        p_escala_probabilidade: escalaProbabilidade as any,
        p_escala_impacto: escalaImpacto as any,
        p_niveis_risco: niveisRisco as any,
        p_metodo_calculo: metodoCalculo,
        p_matriz_id: editingMatriz?.id ?? null,
      });

      if (error) throw error;
      if (!matrizId) throw new Error('SEM_RETORNO');

      toast.success(
        editingMatriz
          ? t('cardsKpi.sweep.riscos.matrizAtualizada')
          : t('cardsKpi.sweep.riscos.matrizCriada')
      );

      limparFormularioMatriz();
      fetchData(true);

      // Fecha o diálogo e propaga o refresh (matriz usada em todo o módulo).
      onSuccess();
    } catch (error: any) {
      toast.error(mensagemErroMatriz(error));
    } finally {
      setLoading(false);
    }

  };

  // Feedback quando o submit é bloqueado pela validação (ex.: nome vazio) —
  // o botão fica num rodapé fixo longe do campo, então sem isto "nada acontece".
  const onInvalidMatriz = (errors: Record<string, { message?: string }>) => {
    const primeiro = Object.values(errors)[0];
    toast.error(primeiro?.message || t('fin.comum.preenchaObrigatorios'));
  };

  const adicionarEscalaProbabilidade = () => {
    const proximoValor = (escalaProbabilidade.length + 1).toString();
    setEscalaProbabilidade([...escalaProbabilidade, { valor: proximoValor, descricao: '' }]);
  };

  const removerEscalaProbabilidade = (index: number) => {
    setEscalaProbabilidade(escalaProbabilidade.filter((_, i) => i !== index));
  };

  const adicionarEscalaImpacto = () => {
    const proximoValor = (escalaImpacto.length + 1).toString();
    setEscalaImpacto([...escalaImpacto, { valor: proximoValor, descricao: '' }]);
  };

  const removerEscalaImpacto = (index: number) => {
    setEscalaImpacto(escalaImpacto.filter((_, i) => i !== index));
  };

  const adicionarNivelRisco = () => {
    const ultimoMax = niveisRisco[niveisRisco.length - 1]?.max || 0;
    setNiveisRisco([...niveisRisco, { 
      min: ultimoMax + 1, 
      max: ultimoMax + 5, 
      nivel: '', 
      cor: '#6b7280' 
    }]);
  };

  const removerNivelRisco = (index: number) => {
    setNiveisRisco(niveisRisco.filter((_, i) => i !== index));
  };

  const atualizarEscalaProbabilidade = (index: number, field: keyof EscalaItem, value: string) => {
    const novaEscala = [...escalaProbabilidade];
    novaEscala[index] = { ...novaEscala[index], [field]: value };
    setEscalaProbabilidade(novaEscala);
  };

  const atualizarEscalaImpacto = (index: number, field: keyof EscalaItem, value: string) => {
    const novaEscala = [...escalaImpacto];
    novaEscala[index] = { ...novaEscala[index], [field]: value };
    setEscalaImpacto(novaEscala);
  };

  const atualizarNivelRisco = (index: number, field: keyof NivelRisco, value: string | number) => {
    const novosNiveis = [...niveisRisco];
    novosNiveis[index] = { ...novosNiveis[index], [field]: value };
    setNiveisRisco(novosNiveis);
  };

  const handleDeleteClick = (id: string) => {
    setMatrizToDelete(id);
    setDeleteDialogOpen(true);
  };

  const excluirMatriz = async () => {
    if (!matrizToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('riscos_matrizes')
        .delete()
        .eq('id', matrizToDelete);

      if (error) throw error;

      toast.success(t('fin.riscos.matrizForm.matrizExcluida'));
      fetchData();
    } catch (error: any) {
      toast.error(t('fin.riscos.matrizForm.erroExcluir', { mensagem: error.message }));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setMatrizToDelete(null);
    }
  };

  const onSubmitCategoria = async (data: CategoriaForm) => {
    if (!profile?.empresa_id) {
      toast.error(t('fin.riscos.wizard.erroEmpresa'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('riscos_categorias')
        .insert([{
          nome: data.nome,
          descricao: data.descricao,
          cor: data.cor,
          empresa_id: profile.empresa_id
        }]);

      if (error) throw error;

      toast.success(t('cardsKpi.sweep.riscos.categoriaCriada'));
      categoriaForm.reset();
      fetchData();
    } catch (error: any) {
      toast.error(t('fin.riscos.matrizForm.erroCriarCat', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const excluirCategoria = async (id: string) => {
    try {
      const { error } = await supabase
        .from('riscos_categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(t('fin.riscos.matrizForm.categoriaExcluida'));
      fetchData();
    } catch (error: any) {
      toast.error(t('fin.riscos.matrizForm.erroExcluirCat', { mensagem: error.message }));
    }
  };

  const SectionHeader = ({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) => (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{eyebrow}</span>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {action}
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-2">
        {/* Seção: Identificação */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {editingMatriz ? t('fin.comum.editando') : t('fin.riscos.matrizForm.novaMatriz')}
              </span>
              <h4 className="text-sm font-semibold text-foreground">
                {editingMatriz ? editingMatriz.nome : t('fin.riscos.wizard.stepIdentificacao')}
              </h4>
            </div>
            <div className="flex items-center gap-1.5">
              {editingMatriz && (
                <Button type="button" variant="ghost" size="sm" onClick={cancelarEdicao} className="gap-1.5">
                  <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t('sweepRiscos.riscos.matrizForm.cancelarEdicao')}
                </Button>
              )}
              {!modoNovo && (
                <Button type="button" variant="outline" size="sm" onClick={iniciarNovaMatriz} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t('sweepRiscos.riscos.matrizForm.novaMatriz')}
                </Button>
              )}
            </div>

          </div>

          <Form {...matrizForm}>
            <form
              id="matriz-form"
              onSubmit={matrizForm.handleSubmit(onSubmitMatriz, onInvalidMatriz)}
              className="space-y-7"
            >
              <div className="space-y-5">
                <FormField
                  control={matrizForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('sweepRiscos.riscos.matrizForm.nomeMatrizLabel')} <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('campos.matriz.nomePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={matrizForm.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('fin.comum.descricao')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t('fin.riscos.matrizForm.descPlaceholder')}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t border-border/60 pt-6">
                <SectionHeader eyebrow={t('fin.riscos.matrizForm.calculoEyebrow')} title={t('fin.riscos.matrizForm.metodoCalculo')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'multiplicacao', label: t('fin.riscos.matrizForm.multiplicacao'), formula: 'P × I', desc: t('fin.riscos.matrizForm.multiplicacaoDesc') },
                    { value: 'soma', label: t('sweepRiscos.riscos.matrizForm.soma'), formula: 'P + I', desc: t('sweepRiscos.riscos.matrizForm.somaDesc') },
                  ].map(opt => {
                    const active = metodoCalculo === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMetodoCalculo(opt.value as 'multiplicacao' | 'soma')}
                        className={cn(
                          'text-left rounded-lg border p-4 transition-all',
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border bg-card hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Calculator
                            className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                            strokeWidth={1.5}
                          />
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className={cn(
                            'ml-auto text-xs font-mono px-2 py-0.5 rounded',
                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {opt.formula}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/60 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Escala de Probabilidade */}
                  <div>
                    <SectionHeader eyebrow={t('campos.matriz.escala')} title={t('campos.matriz.probabilidade')} />
                    <div className="space-y-2">
                      {escalaProbabilidade.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-2 items-center bg-muted/30 hover:bg-muted/50 rounded-md p-2 transition-colors"
                        >
                          <Input
                            value={item.valor}
                            onChange={(e) => atualizarEscalaProbabilidade(index, 'valor', e.target.value)}
                            placeholder={t('campos.matriz.numeroPlaceholder')}
                            className="w-14 text-center font-medium"
                            aria-label={t('residuos.risco.valorProbabilidade')}
                          />
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarEscalaProbabilidade(index, 'descricao', e.target.value)}
                            placeholder={t('fin.riscos.matrizForm.exProbabilidade')}
                            className="flex-1 min-w-0"
                            aria-label={t('fin.riscos.matrizForm.descProbabilidade')}
                          />
                          {escalaProbabilidade.length > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                                  onClick={() => removerEscalaProbabilidade(index)}
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('sweepRiscos.comum.remover')}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={adicionarEscalaProbabilidade}
                        className="w-full gap-1.5 border-dashed"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        {t('sweepRiscos.riscos.matrizForm.adicionarNivel')}
                      </Button>
                    </div>
                  </div>

                  {/* Escala de Impacto */}
                  <div>
                    <SectionHeader eyebrow={t('campos.matriz.escala')} title={t('campos.matriz.impacto')} />
                    <div className="space-y-2">
                      {escalaImpacto.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-2 items-center bg-muted/30 hover:bg-muted/50 rounded-md p-2 transition-colors"
                        >
                          <Input
                            value={item.valor}
                            onChange={(e) => atualizarEscalaImpacto(index, 'valor', e.target.value)}
                            placeholder={t('campos.matriz.numeroPlaceholder')}
                            className="w-14 text-center font-medium"
                            aria-label={t('residuos.risco.valorImpacto')}
                          />
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarEscalaImpacto(index, 'descricao', e.target.value)}
                            placeholder={t('fin.riscos.matrizForm.exImpacto')}
                            className="flex-1 min-w-0"
                            aria-label={t('fin.riscos.matrizForm.descImpacto')}
                          />
                          {escalaImpacto.length > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                                  onClick={() => removerEscalaImpacto(index)}
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('sweepRiscos.comum.remover')}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={adicionarEscalaImpacto}
                        className="w-full gap-1.5 border-dashed"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        {t('sweepRiscos.riscos.matrizForm.adicionarNivel')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 pt-6">
                <SectionHeader
                  eyebrow={t('sweepRiscos.riscos.matrizForm.faixasEyebrow')}
                  title={t('fin.riscos.matrizForm.niveisRisco')}
                />
                {faixasError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                    <AlertDescription>{faixasError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  {niveisRisco.map((nivel, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-center bg-muted/30 hover:bg-muted/50 rounded-md p-2 transition-colors"
                    >
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          value={nivel.min}
                          onChange={(e) => atualizarNivelRisco(index, 'min', parseInt(e.target.value) || 0)}
                          placeholder={t('campos.matriz.minPlaceholder')}
                          className="w-16 text-center"
                          aria-label={t('fin.comum.valorMinimo')}
                        />
                        <span className="text-muted-foreground text-sm">–</span>
                        <Input
                          type="number"
                          value={nivel.max}
                          onChange={(e) => atualizarNivelRisco(index, 'max', parseInt(e.target.value) || 0)}
                          placeholder={t('campos.matriz.maxPlaceholder')}
                          className="w-16 text-center"
                          aria-label={t('fin.comum.valorMaximo')}
                        />
                      </div>
                      <Input
                        value={nivel.nivel}
                        onChange={(e) => atualizarNivelRisco(index, 'nivel', e.target.value)}
                        placeholder={t('fin.riscos.matrizForm.nomeNivelPlaceholder')}
                        className="flex-1 min-w-0"
                        aria-label={t('fin.riscos.matrizForm.nomeNivel')}
                      />
                      <ColorSwatch
                        value={nivel.cor}
                        onChange={(v) => atualizarNivelRisco(index, 'cor', v)}
                      />
                      {niveisRisco.length > 1 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                              onClick={() => removerNivelRisco(index)}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('sweepRiscos.comum.remover')}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={adicionarNivelRisco}
                    className="w-full gap-1.5 border-dashed"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    {t('sweepRiscos.riscos.matrizForm.adicionarNivelRisco')}
                  </Button>
                </div>

                {/* Limite de apetite de risco — configurável (antes era fixo em "Médio") */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <span className="text-sm font-medium text-foreground">{t('residuos.risco.limiteApetite')}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    {t('sweepRiscos.riscos.matrizForm.apetiteDescPre')} <strong>{t('sweepRiscos.riscos.matrizForm.apetiteDescStrong')}</strong> {t('sweepRiscos.riscos.matrizForm.apetiteDescPost')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      // Nível efetivo destacado: o marcado, ou "médio" como fallback
                      // (mesma regra da derivação em Riscos.tsx) para matrizes sem marcação.
                      const algumMarcado = niveisRisco.some((n) => n.apetite);
                      const norm = (s?: string) => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
                      return [...niveisRisco].sort((a, b) => a.min - b.min).map((nivel) => {
                      const realIndex = niveisRisco.indexOf(nivel);
                      const efetivo = nivel.apetite || (!algumMarcado && norm(nivel.nivel) === 'medio');
                      return (
                        <Button
                          key={realIndex}
                          type="button"
                          size="sm"
                          variant={efetivo ? 'default' : 'outline'}
                          onClick={() => setNiveisRisco((prev) => prev.map((n, j) => ({ ...n, apetite: j === realIndex })))}
                          className="gap-1.5"
                        >
                          {t('sweepRiscos.riscos.matrizForm.ateNivel', { nivel: nivel.nivel || t('sweepRiscos.riscos.matrizForm.nivelN', { n: realIndex + 1 }) })}
                          <span className="text-[10px] opacity-70 tabular-nums">(≤{nivel.max})</span>
                        </Button>
                      );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </section>

        {/* Seção: Matrizes salvas */}
        <section className="rounded-lg border border-border bg-card p-5">
          <SectionHeader eyebrow={t('fin.riscos.matrizForm.persistencia')} title={t('fin.riscos.matrizForm.matrizesSalvas')} />
          {matrizes.length === 0 ? (
            <EmptyState
              icon={<Grid3X3 className="h-10 w-10" strokeWidth={1.5} />}
              title={t('fin.riscos.matrizForm.vazioTitle')}
              description={t('fin.riscos.matrizForm.vazioDesc')}
            />
          ) : (
            <div className="space-y-2">
              {matrizes.map((matriz) => {
                const isEditing = editingMatriz?.id === matriz.id;
                return (
                  <div
                    key={matriz.id}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 border rounded-md transition-colors',
                      isEditing
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h5 className="font-medium text-sm truncate">{matriz.nome}</h5>
                        <span className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                          matriz.configuracao
                            ? 'border-border bg-muted/40 text-muted-foreground'
                            : 'border-destructive/40 bg-destructive/10 text-destructive'
                        )}>
                          {resumoMatriz(matriz) ?? t('sweepRiscos.riscos.matrizForm.semConfiguracao')}
                        </span>
                      </div>
                      {matriz.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{matriz.descricao}</p>
                      )}


                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => carregarMatrizParaEdicao(matriz)}
                          >
                            <Edit className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('fin.comum.editar')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteClick(matriz.id)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('fin.comum.excluir')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer sticky */}
        <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t bg-background/95 backdrop-blur-sm flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {t('sweepRiscos.riscos.matrizForm.alteracoesAfetam')}
          </p>
          <div className="flex gap-2 ml-auto">
            {editingMatriz && (
              <Button type="button" variant="outline" onClick={cancelarEdicao}>{t('fin.comum.cancelar')}</Button>
            )}
            <Button
              type="submit"
              form="matriz-form"
              disabled={loading || !!faixasError}
            >
              {loading ? t('fin.comum.salvando') : editingMatriz ? t('fin.riscos.matrizForm.atualizarMatriz') : t('fin.riscos.matrizForm.salvarMatriz')}
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('fin.riscos.matrizForm.excluirTitle')}
          description={t('fin.riscos.matrizForm.excluirDesc')}
          confirmText={t('fin.comum.excluir')}
          cancelText={t('fin.comum.cancelar')}
          onConfirm={excluirMatriz}
          loading={deleting}
          variant="destructive"
        />
      </div>
    </TooltipProvider>
  );
}
