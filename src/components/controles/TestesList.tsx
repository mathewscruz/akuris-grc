import { useState } from "react";
import { IconAdd, IconEdit, IconDelete, IconCalendar, IconTest, IconPerson, IconCheck } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ControlesTestesDialog from "./ControlesTestesDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDateOnly } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatusBadge } from "@/components/ui/status-badge";
import { resultadoTesteLabel, resultadoTesteTone } from "@/lib/controle-testes";
import { openStorageFile } from "@/lib/storage";
import { useAuth } from "@/components/AuthProvider";
import { useQuery as useProfilesQuery } from "@tanstack/react-query";

interface ControleTeste {
  estado?: string;
  atestado_por?: string | null;
  atestado_em?: string | null;
  created_by?: string | null;
  eficacia_desenho?: string | null;
  eficacia_operacional?: string | null;
  amostra_total?: number | null;
  amostra_excecoes?: number | null;
  id: string;
  controle_id: string;
  data_teste: string;
  resultado: string;
  observacoes?: string;
  evidencias?: string;
  testador?: string;
  proxima_avaliacao?: string;
  testador_id?: string | null;
  evidencia_url?: string | null;
  evidencia_nome?: string | null;
  created_at: string;
}

interface TestesListProps {
  controleId: string;
  controleNome: string;
}

export default function TestesList({ controleId, controleNome }: TestesListProps) {
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [editingTeste, setEditingTeste] = useState<ControleTeste | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Buscar testes do controle
  const { data: testes = [], isLoading } = useQuery({
    queryKey: ['controles_testes', controleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles_testes')
        .select('*')
        .eq('controle_id', controleId)
        .order('data_teste', { ascending: false });
      
      if (error) throw error;
      return data as ControleTeste[];
    },
    enabled: !!controleId
  });

  const { data: perfis = [] } = useProfilesQuery({
    queryKey: ['profiles-testadores'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, nome');
      return data || [];
    },
  });
  const nomePorUser = new Map((perfis as any[]).map((p) => [p.user_id, p.nome]));

  /* O tom acompanha o que falta fazer, não o que já se fez. */
  const tomDoEstado = (estado?: string) =>
    estado === 'atestado' ? 'success'
      : estado === 'submetido' ? 'warning'
      : estado === 'devolvido' ? 'destructive'
      : 'neutral';

  /*
    Quem executou não atesta.

    O banco recusa de qualquer forma — mas deixar o botão activo para depois
    devolver um erro é fazer a pessoa descobrir a regra ao bater nela.
  */
  const souExecutor = (teste: ControleTeste) =>
    !!user?.id && (teste.testador_id === user.id || teste.created_by === user.id);

  const mudarEstado = async (teste: ControleTeste, estado: 'submetido' | 'atestado') => {
    const { error } = await supabase
      .from('controles_testes')
      .update(estado === 'atestado' ? { estado, atestado_por: user?.id ?? null } : { estado })
      .eq('id', teste.id);
    if (error) {
      toast({
        title: error.message.includes('não pode atestá-lo')
          ? t('t4.testes.erroAutoAtestacao')
          : t('controlesAuditorias.tlErroEstado'),
        variant: 'destructive',
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['controles_testes'] });
    queryClient.invalidateQueries({ queryKey: ['controles-stats'] });
    toast({ title: t(`t4.testes.estado.${estado}`) });
  };

  // Deletar teste
  const deleteTesteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('controles_testes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_testes', controleId] });
      toast({
        title: t('controlesAuditorias.tlToastDeletedTitle'),
        description: t('controlesAuditorias.tlToastDeletedDesc'),
      });
      setDeleteConfirm({ open: false, id: '' });
    },
    onError: () => {
      toast({
        title: t('controlesAuditorias.tlToastErrorTitle'),
        description: t('controlesAuditorias.tlToastErrorDesc'),
        variant: "destructive",
      });
      setDeleteConfirm({ open: false, id: '' });
    }
  });

  const handleEdit = (teste: ControleTeste) => {
    setEditingTeste(teste);
    setTesteDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = () => {
    deleteTesteMutation.mutate(deleteConfirm.id);
  };

  const getResultadoBadge = (resultado: string) => (
    <StatusBadge tone={resultadoTesteTone(resultado)}>
      {resultadoTesteLabel(resultado, t)}
    </StatusBadge>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <IconTest className="w-5 h-5" />
          <h3 className="text-lg font-semibold">{t('controlesAuditorias.tlTitle')}</h3>
        </div>
        <Button
          onClick={() => {
            setEditingTeste(null);
            setTesteDialogOpen(true);
          }}
          size="sm"
        >
          <IconAdd className="w-4 h-4 mr-2" />
          {t('controlesAuditorias.tlBtnNovo')}
        </Button>
      </div>

      {testes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <IconTest className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('controlesAuditorias.tlEmptyTitle')}</h3>
            <p className="text-muted-foreground mb-4 text-center">
              {t('controlesAuditorias.tlEmptyDesc')}
            </p>
            <Button 
              onClick={() => {
                setEditingTeste(null);
                setTesteDialogOpen(true);
              }}
            >
              <IconAdd className="w-4 h-4 mr-2" />
              {t('controlesAuditorias.tlBtnRegistrar')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {testes.map((teste) => (
            <Card key={teste.id} className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {t('controlesAuditorias.tlTesteDe', { data: formatDateOnly(teste.data_teste) })}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      {(teste.testador_id || teste.testador) && (
                        <span className="flex items-center gap-1">
                          <IconPerson className="w-3 h-3" />
                          {nomePorUser.get(teste.testador_id || '') || teste.testador}
                        </span>
                      )}
                      {teste.proxima_avaliacao && (
                        <span className="flex items-center gap-1">
                          <IconCalendar className="w-3 h-3" />
                          {t('controlesAuditorias.tlProxima', { data: formatDateOnly(teste.proxima_avaliacao) })}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {/*
                      O estado antes do resultado: um «eficaz» por atestar e um
                      «eficaz» atestado não valem o mesmo numa auditoria, e a
                      lista não distinguia os dois.
                    */}
                    <StatusBadge tone={tomDoEstado(teste.estado)}>
                      {t(`t4.testes.estado.${teste.estado || 'rascunho'}`)}
                    </StatusBadge>
                    {getResultadoBadge(teste.resultado)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {teste.observacoes && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground mb-1">{t('controlesAuditorias.tlObservacoes')}</p>
                    <p className="text-sm">{teste.observacoes}</p>
                  </div>
                )}
                
                {teste.evidencia_nome && (
                  <div className="mb-3">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary"
                      onClick={() => openStorageFile('controles-evidencias', teste.evidencia_url)}
                    >
                      {teste.evidencia_nome}
                    </Button>
                  </div>
                )}

                {teste.evidencias && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground mb-1">{t('controlesAuditorias.tlEvidencias')}</p>
                    <p className="text-sm">{teste.evidencias}</p>
                  </div>
                )}

                {(teste.amostra_total != null || teste.eficacia_desenho) && (
                  <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-micro text-muted-foreground">
                    {teste.eficacia_desenho && (
                      <span>
                        {t('t4.testes.campoDesenho')}:{' '}
                        {t(`t4.testes.eficacia.${teste.eficacia_desenho}`)}
                      </span>
                    )}
                    {teste.eficacia_operacional && (
                      <span>
                        {t('t4.testes.campoOperacional')}:{' '}
                        {t(`t4.testes.eficacia.${teste.eficacia_operacional}`)}
                      </span>
                    )}
                    {teste.amostra_total != null && (
                      <span className="tabular-nums">
                        {t('t4.testes.campoAmostra')}: {teste.amostra_total}
                        {teste.amostra_excecoes != null
                          ? ` · ${t('t4.testes.campoExcecoes')}: ${teste.amostra_excecoes}`
                          : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Quem atestou, ou o convite a atestar. */}
                {teste.estado === 'atestado' && teste.atestado_em ? (
                  <p className="mb-3 flex items-center gap-1.5 text-micro font-medium text-state-done">
                    <IconCheck className="h-3 w-3" strokeWidth={1.5} />
                    {t('t4.testes.atestadoPor', {
                      nome: nomePorUser.get(teste.atestado_por || '') || '—',
                      data: formatDateOnly(teste.atestado_em),
                    })}
                  </p>
                ) : (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {teste.estado !== 'submetido' && (
                      <Button variant="outline" size="sm" onClick={() => mudarEstado(teste, 'submetido')}>
                        {t('t4.testes.submeter')}
                      </Button>
                    )}
                    {teste.estado === 'submetido' && (
                      <Button
                        size="sm"
                        disabled={souExecutor(teste)}
                        title={souExecutor(teste) ? t('t4.testes.erroAutoAtestacao') : undefined}
                        onClick={() => mudarEstado(teste, 'atestado')}
                      >
                        {t('t4.testes.atestar')}
                      </Button>
                    )}
                    <span className="text-micro text-muted-foreground">
                      {souExecutor(teste) && teste.estado === 'submetido'
                        ? t('t4.testes.erroAutoAtestacao')
                        : t('t4.testes.avisoAtestacao')}
                    </span>
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(teste)}
                  >
                    <IconEdit className="w-3 h-3 mr-1" />
                    {t('controlesAuditorias.tlBtnEditar')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(teste.id)}
                  >
                    <IconDelete className="w-3 h-3 mr-1" />
                    {t('controlesAuditorias.tlBtnExcluir')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ControlesTestesDialog
        open={testeDialogOpen}
        onOpenChange={(open) => {
          setTesteDialogOpen(open);
          if (!open) setEditingTeste(null);
        }}
        controle={{ id: controleId, nome: controleNome }}
        teste={editingTeste}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('controlesAuditorias.tlDeleteDialogTitle')}
        description={t('controlesAuditorias.tlDeleteDialogDescription')}
        confirmText={t('controlesAuditorias.tlDeleteConfirm')}
        cancelText={t('controlesAuditorias.tlDeleteCancel')}
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteTesteMutation.isPending}
      />
    </div>
  );
}
