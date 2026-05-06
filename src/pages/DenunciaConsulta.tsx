import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Shield, FileText, Clock, CheckCircle, AlertCircle, Eye, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDenunciaStatusTone, resolveGravidadeTone } from '@/lib/status-tone';
import { useToast } from '@/hooks/use-toast';
import { getCompanyLogo } from '@/lib/brand-logo';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Empresa {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
}

interface Denuncia {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  gravidade: string;
  created_at: string;
  data_atribuicao: string | null;
  data_inicio_investigacao: string | null;
  data_conclusao: string | null;
  categoria: {
    nome: string;
    cor: string;
  } | null;
}

interface Movimentacao {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string;
  observacoes: string | null;
  created_at: string;
  usuario: {
    nome: string;
  } | null;
}

export default function DenunciaConsulta() {
  const { empresa: empresaSlug } = useParams<{ empresa: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [protocolo, setProtocolo] = useState('');
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (empresaSlug) {
      carregarEmpresa();
    }
  }, [empresaSlug]);

  const carregarEmpresa = async () => {
    try {
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('id, nome, slug, logo_url')
        .eq('slug', empresaSlug)
        .eq('ativo', true)
        .single();

      if (empresaError || !empresaData) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setEmpresa(empresaData);
    } catch (error) {
      logger.error('Erro ao carregar empresa', { module: 'DenunciaConsulta', error: String(error) });
      toast({
        title: "Erro",
        description: "Erro interno do sistema",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const buscarDenuncia = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!empresa || !protocolo.trim()) {
      toast({
        title: "Erro",
        description: "Digite o número do protocolo",
        variant: "destructive"
      });
      return;
    }

    setSearching(true);
    setDenuncia(null);
    setMovimentacoes([]);
    setShowDetails(false);

    try {
      // Buscar denúncia
      const { data: denunciaData, error: denunciaError } = await supabase
        .from('denuncias')
        .select(`
          id,
          protocolo,
          titulo,
          status,
          gravidade,
          created_at,
          data_atribuicao,
          data_inicio_investigacao,
          data_conclusao,
          denuncias_categorias:categoria_id (
            nome,
            cor
          )
        `)
        .eq('empresa_id', empresa.id)
        .eq('protocolo', protocolo.trim().toUpperCase())
        .single();

      if (denunciaError || !denunciaData) {
        toast({
          title: "Protocolo não encontrado",
          description: "Verifique se o número do protocolo está correto",
          variant: "destructive"
        });
        return;
      }

      setDenuncia({
        ...denunciaData,
        categoria: denunciaData.denuncias_categorias
      });

      // Buscar movimentações
      const { data: movimentacoesData, error: movimentacoesError } = await supabase
        .from('denuncias_movimentacoes')
        .select(`
          id,
          acao,
          status_anterior,
          status_novo,
          observacoes,
          created_at,
          profiles:usuario_id (
            nome
          )
        `)
        .eq('denuncia_id', denunciaData.id)
        .order('created_at', { ascending: false });

      if (!movimentacoesError && movimentacoesData) {
        setMovimentacoes(movimentacoesData.map(mov => ({
          ...mov,
          usuario: mov.profiles
        })));
      }

      setShowDetails(true);
    } catch (error) {
      logger.error('Erro ao buscar denúncia', { module: 'DenunciaConsulta', error: String(error) });
      toast({
        title: "Erro",
        description: "Erro ao buscar denúncia. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'nova':
        return <FileText className="w-4 h-4" />;
      case 'em_analise':
        return <Clock className="w-4 h-4" />;
      case 'em_investigacao':
        return <AlertCircle className="w-4 h-4" />;
      case 'concluida':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      nova: 'Nova',
      em_analise: 'Em Análise',
      em_investigacao: 'Em Investigação',
      concluida: 'Concluída',
      arquivada: 'Arquivada'
    };
    return statusMap[status] || status;
  };

  const getGravidadeLabel = (gravidade: string) =>
    gravidade ? gravidade.charAt(0).toUpperCase() + gravidade.slice(1) : '-';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AkurisPulse size={32} />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(215,35%,12%)] py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            to={`/${empresaSlug}/denuncia`}
            className="inline-flex items-center text-sm text-sidebar-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar ao menu inicial
          </Link>
        </div>

        {/* Header com logotipo */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <img
              src={getCompanyLogo(empresa?.logo_url)}
              alt={`Logo ${empresa?.nome ?? 'Akuris'}`}
              className="mx-auto h-20 w-auto object-contain"
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl text-sidebar-foreground">Consulte o andamento da sua denúncia</h2>
          </div>
        </div>

        {/* Formulário de busca */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Consultar Protocolo
            </CardTitle>
            <CardDescription>
              Digite o número do protocolo recebido ao fazer sua denúncia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={buscarDenuncia} className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="protocolo" className="sr-only">
                  Número do protocolo
                </Label>
                <Input
                  id="protocolo"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                  placeholder="Ex: DEN20250123001"
                  className="font-mono"
                  required
                />
              </div>
              <Button type="submit" disabled={searching}>
                <Search className="w-4 h-4 mr-2" />
                {searching ? 'Buscando...' : 'Consultar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultado da busca */}
        {showDetails && denuncia && (
          <div className="space-y-6">
            {/* Informações da denúncia */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5" />
                      Protocolo: {denuncia.protocolo}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {denuncia.titulo}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge {...resolveDenunciaStatusTone(denuncia.status)}>
                      {getStatusText(denuncia.status)}
                    </StatusBadge>
                    <StatusBadge {...resolveGravidadeTone(denuncia.gravidade)}>
                      {getGravidadeLabel(denuncia.gravidade)}
                    </StatusBadge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Data da Denúncia
                    </Label>
                    <p className="text-sm">{formatDate(denuncia.created_at)}</p>
                  </div>
                  {denuncia.categoria && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Categoria
                      </Label>
                      <p className="text-sm">{denuncia.categoria.nome}</p>
                    </div>
                  )}
                  {denuncia.data_atribuicao && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Data de Atribuição
                      </Label>
                      <p className="text-sm">{formatDate(denuncia.data_atribuicao)}</p>
                    </div>
                  )}
                  {denuncia.data_inicio_investigacao && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Início da Investigação
                      </Label>
                      <p className="text-sm">{formatDate(denuncia.data_inicio_investigacao)}</p>
                    </div>
                  )}
                </div>

                {denuncia.data_conclusao && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Denúncia concluída em:</strong> {formatDate(denuncia.data_conclusao)}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Histórico de movimentações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Histórico de Movimentações
                </CardTitle>
                <CardDescription>
                  Acompanhe todas as etapas do tratamento da sua denúncia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {movimentacoes.length > 0 ? (
                  <div className="space-y-4">
                    {movimentacoes.map((movimentacao, index) => (
                      <div key={movimentacao.id} className="relative pl-6 pb-4">
                        {index < movimentacoes.length - 1 && (
                          <div className="absolute left-2 top-6 w-0.5 h-full bg-muted"></div>
                        )}
                        <div className="absolute left-0 top-1 w-4 h-4 bg-primary rounded-full"></div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">
                              {movimentacao.acao.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(movimentacao.created_at)}
                            </span>
                          </div>
                          {movimentacao.status_anterior && movimentacao.status_novo && (
                            <p className="text-xs text-muted-foreground">
                              Status alterado de "{getStatusText(movimentacao.status_anterior)}" 
                              para "{getStatusText(movimentacao.status_novo)}"
                            </p>
                          )}
                          {movimentacao.observacoes && (
                            <p className="text-sm text-muted-foreground">
                              {movimentacao.observacoes}
                            </p>
                          )}
                          {movimentacao.usuario && (
                            <p className="text-xs text-muted-foreground">
                              Por: {movimentacao.usuario.nome}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma movimentação registrada ainda.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Informações importantes */}
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Esta consulta mostra apenas informações básicas sobre 
                o andamento da sua denúncia. Dados sensíveis são mantidos em sigilo conforme 
                nossa política de privacidade. Para mais informações, entre em contato através 
                dos canais oficiais da empresa.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}