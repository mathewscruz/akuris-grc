import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link, Unlink, Shield, Package } from "lucide-react";
import { formatStatus } from '@/lib/text-utils';

interface ControlesVinculacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controleId?: string;
  controleNome?: string;
}

interface Risco {
  id: string;
  nome: string;
  descricao?: string;
  nivel_risco_inicial: string;
  categoria?: { nome: string; cor?: string };
}

interface Ativo {
  id: string;
  nome: string;
  tipo: string;
  criticidade: string;
  descricao?: string;
}

interface VinculacaoRisco {
  id?: string;
  risco_id: string;
  tipo_vinculacao: string;
  eficacia_estimada?: string;
  observacoes?: string;
}

interface VinculacaoAtivo {
  id?: string;
  ativo_id: string;
  tipo_protecao: string;
  observacoes?: string;
}

export default function ControlesVinculacaoDialog({
  open,
  onOpenChange,
  controleId,
  controleNome
}: ControlesVinculacaoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("riscos");

  // Estados para vinculações
  const [vinculacoesRiscos, setVinculacoesRiscos] = useState<VinculacaoRisco[]>([]);
  const [vinculacoesAtivos, setVinculacoesAtivos] = useState<VinculacaoAtivo[]>([]);

  // Buscar riscos disponíveis
  const { data: riscos = [] } = useQuery({
    queryKey: ['riscos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(`
          id,
          nome,
          descricao,
          nivel_risco_inicial,
          categoria:riscos_categorias(nome, cor)
        `)
        .order('nome');
      
      if (error) throw error;
      return data as Risco[];
    }
  });

  // Buscar ativos disponíveis
  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ativos')
        .select('id, nome, tipo, criticidade, descricao')
        .order('nome');
      
      if (error) throw error;
      return data as Ativo[];
    }
  });

  // Buscar vinculações existentes do controle
  useEffect(() => {
    if (controleId && open) {
      fetchVinculacoes();
    }
  }, [controleId, open]);

  const fetchVinculacoes = async () => {
    if (!controleId) return;

    try {
      // Buscar vinculações com riscos
      const { data: riscosVinculados, error: errorRiscos } = await supabase
        .from('controles_riscos')
        .select('*')
        .eq('controle_id', controleId);

      if (errorRiscos) throw errorRiscos;

      // Buscar vinculações com ativos
      const { data: ativosVinculados, error: errorAtivos } = await supabase
        .from('controles_ativos')
        .select('*')
        .eq('controle_id', controleId);

      if (errorAtivos) throw errorAtivos;

      setVinculacoesRiscos(riscosVinculados || []);
      setVinculacoesAtivos(ativosVinculados || []);
    } catch (error) {
      console.error('Error fetching vinculações:', error);
    }
  };

  // Mutation para salvar vinculações
  const saveVinculacaoMutation = useMutation({
    mutationFn: async () => {
      if (!controleId) throw new Error('Controle ID é obrigatório');

      // Deletar vinculações existentes
      await supabase.from('controles_riscos').delete().eq('controle_id', controleId);
      await supabase.from('controles_ativos').delete().eq('controle_id', controleId);

      // Inserir novas vinculações com riscos
      if (vinculacoesRiscos.length > 0) {
        const { error: errorRiscos } = await supabase
          .from('controles_riscos')
          .insert(
            vinculacoesRiscos.map(v => ({
              controle_id: controleId,
              risco_id: v.risco_id,
              tipo_vinculacao: v.tipo_vinculacao,
              eficacia_estimada: v.eficacia_estimada,
              observacoes: v.observacoes,
            }))
          );

        if (errorRiscos) throw errorRiscos;
      }

      // Inserir novas vinculações com ativos
      if (vinculacoesAtivos.length > 0) {
        const { error: errorAtivos } = await supabase
          .from('controles_ativos')
          .insert(
            vinculacoesAtivos.map(v => ({
              controle_id: controleId,
              ativo_id: v.ativo_id,
              tipo_protecao: v.tipo_protecao,
              observacoes: v.observacoes,
            }))
          );

        if (errorAtivos) throw errorAtivos;
      }
    },
    onSuccess: () => {
      toast({
        title: "Vinculações salvas",
        description: "As vinculações do controle foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as vinculações.",
        variant: "destructive",
      });
      console.error('Error saving vinculações:', error);
    }
  });

  const handleAddRiscoVinculacao = (riscoId: string) => {
    if (vinculacoesRiscos.some(v => v.risco_id === riscoId)) return;
    
    setVinculacoesRiscos(prev => [...prev, {
      risco_id: riscoId,
      tipo_vinculacao: 'mitiga',
      eficacia_estimada: 'media',
    }]);
  };

  const handleRemoveRiscoVinculacao = (riscoId: string) => {
    setVinculacoesRiscos(prev => prev.filter(v => v.risco_id !== riscoId));
  };

  const handleUpdateRiscoVinculacao = (riscoId: string, field: keyof VinculacaoRisco, value: string) => {
    setVinculacoesRiscos(prev => prev.map(v => 
      v.risco_id === riscoId ? { ...v, [field]: value } : v
    ));
  };

  const handleAddAtivoVinculacao = (ativoId: string) => {
    if (vinculacoesAtivos.some(v => v.ativo_id === ativoId)) return;
    
    setVinculacoesAtivos(prev => [...prev, {
      ativo_id: ativoId,
      tipo_protecao: 'protege',
    }]);
  };

  const handleRemoveAtivoVinculacao = (ativoId: string) => {
    setVinculacoesAtivos(prev => prev.filter(v => v.ativo_id !== ativoId));
  };

  const handleUpdateAtivoVinculacao = (ativoId: string, field: keyof VinculacaoAtivo, value: string) => {
    setVinculacoesAtivos(prev => prev.map(v => 
      v.ativo_id === ativoId ? { ...v, [field]: value } : v
    ));
  };

  const isRiscoVinculado = (riscoId: string) => {
    return vinculacoesRiscos.some(v => v.risco_id === riscoId);
  };

  const isAtivoVinculado = (ativoId: string) => {
    return vinculacoesAtivos.some(v => v.ativo_id === ativoId);
  };

  const getNivelRiscoBadge = (nivel: string) => {
    const variants = {
      critico: "destructive",
      alto: "destructive", 
      medio: "default",
      baixo: "secondary"
    } as const;
    
    return <Badge variant={variants[nivel as keyof typeof variants] || "default"}>{formatStatus(nivel)}</Badge>;
  };

  const getCriticidadeBadge = (criticidade: string) => {
    const variants = {
      critico: "destructive",
      alto: "destructive", 
      medio: "default",
      baixo: "secondary"
    } as const;
    
    return <Badge variant={variants[criticidade as keyof typeof variants] || "default"}>{criticidade}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Vinculações do Controle: {controleNome}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="riscos" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Riscos ({vinculacoesRiscos.length})
            </TabsTrigger>
            <TabsTrigger value="ativos" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ativos ({vinculacoesAtivos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="riscos" className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Riscos Disponíveis</h3>
              {riscos.map((risco) => (
                <Card key={risco.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{risco.nome}</h4>
                        {getNivelRiscoBadge(risco.nivel_risco_inicial)}
                        {risco.categoria && (
                          <Badge 
                            variant="outline" 
                            style={{ borderColor: risco.categoria.cor, color: risco.categoria.cor }}
                          >
                            {risco.categoria.nome}
                          </Badge>
                        )}
                      </div>
                      {risco.descricao && (
                        <p className="text-sm text-muted-foreground">{risco.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isRiscoVinculado(risco.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddRiscoVinculacao(risco.id);
                          } else {
                            handleRemoveRiscoVinculacao(risco.id);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {isRiscoVinculado(risco.id) && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Tipo de Vinculação</Label>
                          <Select
                            value={vinculacoesRiscos.find(v => v.risco_id === risco.id)?.tipo_vinculacao || 'mitiga'}
                            onValueChange={(value) => handleUpdateRiscoVinculacao(risco.id, 'tipo_vinculacao', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mitiga">Mitiga</SelectItem>
                              <SelectItem value="previne">Previne</SelectItem>
                              <SelectItem value="detecta">Detecta</SelectItem>
                              <SelectItem value="corrige">Corrige</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Eficácia Estimada</Label>
                          <Select
                            value={vinculacoesRiscos.find(v => v.risco_id === risco.id)?.eficacia_estimada || 'media'}
                            onValueChange={(value) => handleUpdateRiscoVinculacao(risco.id, 'eficacia_estimada', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="alta">Alta</SelectItem>
                              <SelectItem value="media">Média</SelectItem>
                              <SelectItem value="baixa">Baixa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={vinculacoesRiscos.find(v => v.risco_id === risco.id)?.observacoes || ''}
                          onChange={(e) => handleUpdateRiscoVinculacao(risco.id, 'observacoes', e.target.value)}
                          placeholder="Observações sobre a vinculação..."
                        />
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ativos" className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Ativos Disponíveis</h3>
              {ativos.map((ativo) => (
                <Card key={ativo.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{ativo.nome}</h4>
                        <Badge variant="outline">{formatStatus(ativo.tipo)}</Badge>
                        {getCriticidadeBadge(ativo.criticidade)}
                      </div>
                      {ativo.descricao && (
                        <p className="text-sm text-muted-foreground">{ativo.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isAtivoVinculado(ativo.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddAtivoVinculacao(ativo.id);
                          } else {
                            handleRemoveAtivoVinculacao(ativo.id);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {isAtivoVinculado(ativo.id) && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Tipo de Proteção</Label>
                          <Select
                            value={vinculacoesAtivos.find(v => v.ativo_id === ativo.id)?.tipo_protecao || 'protege'}
                            onValueChange={(value) => handleUpdateAtivoVinculacao(ativo.id, 'tipo_protecao', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="protege">Protege</SelectItem>
                              <SelectItem value="monitora">Monitora</SelectItem>
                              <SelectItem value="backup">Backup</SelectItem>
                              <SelectItem value="acesso">Controle de Acesso</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div></div>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={vinculacoesAtivos.find(v => v.ativo_id === ativo.id)?.observacoes || ''}
                          onChange={(e) => handleUpdateAtivoVinculacao(ativo.id, 'observacoes', e.target.value)}
                          placeholder="Observações sobre a proteção..."
                        />
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveVinculacaoMutation.mutate()} disabled={saveVinculacaoMutation.isPending}>
            Salvar Vinculações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}