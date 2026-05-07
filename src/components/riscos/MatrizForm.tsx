import { useState, useEffect } from 'react';
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

const COLOR_PALETTE = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#dc2626', '#6b7280', '#3b82f6', '#7552ff'];

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar cor do nível"
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
              aria-label={`Cor ${c}`}
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

const matrizSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
});

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  cor: z.string().optional(),
});

type MatrizForm = z.infer<typeof matrizSchema>;
type CategoriaForm = z.infer<typeof categoriaSchema>;

interface EscalaItem {
  valor: string;
  descricao: string;
}

interface NivelRisco {
  min: number;
  max: number;
  nivel: string;
  cor: string;
}

interface Matriz {
  id: string;
  nome: string;
  descricao?: string;
  configuracao?: {
    escala_probabilidade: EscalaItem[];
    escala_impacto: EscalaItem[];
    niveis_risco: NivelRisco[];
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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingMatriz, setEditingMatriz] = useState<Matriz | null>(null);
  
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
    { min: 5, max: 9, nivel: 'Médio', cor: '#eab308' },
    { min: 10, max: 16, nivel: 'Alto', cor: '#f97316' },
    { min: 17, max: 25, nivel: 'Crítico', cor: '#dc2626' }
  ]);

  const [metodoCalculo, setMetodoCalculo] = useState<'multiplicacao' | 'soma'>('multiplicacao');

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
    fetchData();
  }, []);

  // Validar faixas sempre que niveisRisco mudar
  useEffect(() => {
    const error = validarFaixasNiveisRisco();
    setFaixasError(error);
  }, [niveisRisco]);

  const fetchData = async () => {
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

      // Buscar categorias existentes
      const { data: categoriasData } = await supabase
        .from('riscos_categorias')
        .select('id, nome, descricao, cor')
        .order('created_at', { ascending: false });

      setCategorias(categoriasData || []);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    }
  };

  const carregarMatrizParaEdicao = (matriz: Matriz) => {
    setEditingMatriz(matriz);
    matrizForm.setValue('nome', matriz.nome);
    matrizForm.setValue('descricao', matriz.descricao || '');
    
    if (matriz.configuracao) {
      setEscalaProbabilidade(matriz.configuracao.escala_probabilidade);
      setEscalaImpacto(matriz.configuracao.escala_impacto);
      setNiveisRisco(matriz.configuracao.niveis_risco);
      setMetodoCalculo((matriz.configuracao as any).metodo_calculo || 'multiplicacao');
    }
  };

  const limparFormularioMatriz = () => {
    setEditingMatriz(null);
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

  // Validação de sobreposição e gaps nas faixas de níveis de risco
  const validarFaixasNiveisRisco = (): string | null => {
    if (niveisRisco.length === 0) return null;
    
    // Ordenar por min
    const niveisOrdenados = [...niveisRisco].sort((a, b) => a.min - b.min);
    
    for (let i = 0; i < niveisOrdenados.length; i++) {
      const nivel = niveisOrdenados[i];
      
      // Validar que min <= max
      if (nivel.min > nivel.max) {
        return `O nível "${nivel.nivel || `#${i + 1}`}" tem valor mínimo maior que o máximo`;
      }
      
      // Validar sobreposição com próximo nível
      if (i < niveisOrdenados.length - 1) {
        const proximoNivel = niveisOrdenados[i + 1];
        
        // Sobreposição
        if (nivel.max >= proximoNivel.min) {
          return `Sobreposição detectada entre "${nivel.nivel || `#${i + 1}`}" (max: ${nivel.max}) e "${proximoNivel.nivel || `#${i + 2}`}" (min: ${proximoNivel.min})`;
        }
        
        // Gap (valores não cobertos)
        if (nivel.max + 1 < proximoNivel.min) {
          return `Gap detectado: valores ${nivel.max + 1} a ${proximoNivel.min - 1} não estão cobertos por nenhum nível`;
        }
      }
    }
    
    return null;
  };

  const onSubmitMatriz = async (data: MatrizForm) => {
    if (!profile?.empresa_id) {
      toast.error('Erro: Empresa não identificada');
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
      if (editingMatriz) {
        // Atualizar matriz existente
        const { error: matrizError } = await supabase
          .from('riscos_matrizes')
          .update({
            nome: data.nome,
            descricao: data.descricao
          })
          .eq('id', editingMatriz.id);

        if (matrizError) throw matrizError;

        // Atualizar configuração da matriz
        const { error: configError } = await supabase
          .from('riscos_matriz_configuracao')
          .update({
            escala_probabilidade: escalaProbabilidade as any,
            escala_impacto: escalaImpacto as any,
            niveis_risco: niveisRisco as any,
            metodo_calculo: metodoCalculo
          })
          .eq('matriz_id', editingMatriz.id);

        if (configError) throw configError;

        toast.success('Matriz de risco atualizada com sucesso!');
      } else {
        // Criar nova matriz
        const { data: novaMatriz, error: matrizError } = await supabase
          .from('riscos_matrizes')
          .insert([{
            nome: data.nome,
            descricao: data.descricao,
            empresa_id: profile.empresa_id
          }])
          .select()
          .single();

        if (matrizError) throw matrizError;

        // Criar configuração da matriz
        const { error: configError } = await supabase
          .from('riscos_matriz_configuracao')
          .insert({
            matriz_id: novaMatriz.id,
            escala_probabilidade: escalaProbabilidade as any,
            escala_impacto: escalaImpacto as any,
            niveis_risco: niveisRisco as any,
            metodo_calculo: metodoCalculo
          });

        if (configError) throw configError;

        toast.success('Matriz de risco criada com sucesso!');
      }

      limparFormularioMatriz();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar matriz: ' + error.message);
    } finally {
      setLoading(false);
    }
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

      toast.success('Matriz excluída com sucesso!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir matriz: ' + error.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setMatrizToDelete(null);
    }
  };

  const onSubmitCategoria = async (data: CategoriaForm) => {
    if (!profile?.empresa_id) {
      toast.error('Erro: Empresa não identificada');
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

      toast.success('Categoria criada com sucesso!');
      categoriaForm.reset();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao criar categoria: ' + error.message);
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

      toast.success('Categoria excluída com sucesso!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir categoria: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
          {/* Formulário para nova/editar matriz */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingMatriz ? 'Editar Matriz de Risco' : 'Nova Matriz de Risco'}
              </CardTitle>
              {editingMatriz && (
                <Button variant="outline" size="sm" onClick={limparFormularioMatriz}>
                  Cancelar Edição
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Form {...matrizForm}>
                <form onSubmit={matrizForm.handleSubmit(onSubmitMatriz)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={matrizForm.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Nome da Matriz <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Matriz de Risco Corporativa" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={matrizForm.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descreva o propósito desta matriz de risco" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Método de Cálculo */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Método de Cálculo</h4>
                    </div>
                    <Select value={metodoCalculo} onValueChange={(value: 'multiplicacao' | 'soma') => setMetodoCalculo(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiplicacao">Multiplicação (P × I)</SelectItem>
                        <SelectItem value="soma">Soma (P + I)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {metodoCalculo === 'multiplicacao' 
                        ? 'O nível de risco será calculado multiplicando probabilidade por impacto'
                        : 'O nível de risco será calculado somando probabilidade e impacto'
                      }
                    </p>
                  </div>

                  <Separator />

                  {/* Configuração de Escalas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Escala de Probabilidade */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Escala de Probabilidade</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={adicionarEscalaProbabilidade}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {escalaProbabilidade.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={item.valor}
                            onChange={(e) => atualizarEscalaProbabilidade(index, 'valor', e.target.value)}
                            placeholder="Valor"
                            className="w-20"
                          />
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarEscalaProbabilidade(index, 'descricao', e.target.value)}
                            placeholder="Descrição"
                            className="flex-1"
                          />
                          {escalaProbabilidade.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removerEscalaProbabilidade(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Escala de Impacto */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Escala de Impacto</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={adicionarEscalaImpacto}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {escalaImpacto.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={item.valor}
                            onChange={(e) => atualizarEscalaImpacto(index, 'valor', e.target.value)}
                            placeholder="Valor"
                            className="w-20"
                          />
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarEscalaImpacto(index, 'descricao', e.target.value)}
                            placeholder="Descrição"
                            className="flex-1"
                          />
                          {escalaImpacto.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removerEscalaImpacto(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Níveis de Risco */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Níveis de Risco</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={adicionarNivelRisco}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Alerta de validação de faixas */}
                    {faixasError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{faixasError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {niveisRisco.map((nivel, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={nivel.min}
                          onChange={(e) => atualizarNivelRisco(index, 'min', parseInt(e.target.value) || 0)}
                          placeholder="Min"
                          className="w-20"
                        />
                        <span>-</span>
                        <Input
                          type="number"
                          value={nivel.max}
                          onChange={(e) => atualizarNivelRisco(index, 'max', parseInt(e.target.value) || 0)}
                          placeholder="Max"
                          className="w-20"
                        />
                        <Input
                          value={nivel.nivel}
                          onChange={(e) => atualizarNivelRisco(index, 'nivel', e.target.value)}
                          placeholder="Nome do nível"
                          className="flex-1"
                        />
                        <Input
                          type="color"
                          value={nivel.cor}
                          onChange={(e) => atualizarNivelRisco(index, 'cor', e.target.value)}
                          className="w-16"
                        />
                        {niveisRisco.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removerNivelRisco(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={loading || !!faixasError}>
                      {loading ? 'Salvando...' : editingMatriz ? 'Atualizar Matriz' : 'Criar Matriz'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Lista de matrizes existentes */}
          <Card>
            <CardHeader>
              <CardTitle>Matrizes Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              {matrizes.length === 0 ? (
                <EmptyState
                  icon={<Grid3X3 className="h-10 w-10" />}
                  title="Nenhuma matriz cadastrada"
                  description="Crie sua primeira matriz de risco usando o formulário acima para começar a avaliar seus riscos de forma estruturada."
                />
              ) : (
                <div className="space-y-4">
                  {matrizes.map((matriz) => (
                    <div key={matriz.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{matriz.nome}</h4>
                        {matriz.descricao && (
                          <p className="text-sm text-muted-foreground">{matriz.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => carregarMatrizParaEdicao(matriz)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(matriz.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>
          Fechar
        </Button>
      </DialogFooter>

      {/* ConfirmDialog para exclusão de matriz */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Matriz de Risco"
        description="Tem certeza que deseja excluir esta matriz? Esta ação não pode ser desfeita e pode afetar riscos que utilizam esta matriz."
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={excluirMatriz}
        loading={deleting}
        variant="destructive"
      />
    </div>
  );
}
