import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, TestTube, Calendar, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ControlesTestesDialog from "./ControlesTestesDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDateOnly } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ControleTeste {
  id: string;
  controle_id: string;
  data_teste: string;
  resultado: string;
  observacoes?: string;
  evidencias?: string;
  testador?: string;
  proxima_avaliacao?: string;
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

  const getResultadoBadge = (resultado: string) => {
    const variants = {
      eficaz: "default",
      ineficaz: "destructive",
      parcialmente_eficaz: "secondary"
    } as const;
    
    const labels = {
      eficaz: t('controlesAuditorias.tlResultadoEficaz'),
      ineficaz: t('controlesAuditorias.tlResultadoIneficaz'),
      parcialmente_eficaz: t('controlesAuditorias.tlResultadoParcial')
    } as const;
    
    return (
      <Badge variant={variants[resultado as keyof typeof variants] || "default"}>
        {labels[resultado as keyof typeof labels] || resultado}
      </Badge>
    );
  };

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
          <TestTube className="w-5 h-5" />
          <h3 className="text-lg font-semibold">{t('controlesAuditorias.tlTitle')}</h3>
        </div>
        <Button
          onClick={() => {
            setEditingTeste(null);
            setTesteDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('controlesAuditorias.tlBtnNovo')}
        </Button>
      </div>

      {testes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TestTube className="w-12 h-12 text-muted-foreground mb-4" />
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
              <Plus className="w-4 h-4 mr-2" />
              {t('controlesAuditorias.tlBtnRegistrar')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {testes.map((teste) => (
            <Card key={teste.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {t('controlesAuditorias.tlTesteDe', { data: formatDateOnly(teste.data_teste) })}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      {teste.testador && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {teste.testador}
                        </span>
                      )}
                      {teste.proxima_avaliacao && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {t('controlesAuditorias.tlProxima', { data: formatDateOnly(teste.proxima_avaliacao) })}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
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
                
                {teste.evidencias && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground mb-1">{t('controlesAuditorias.tlEvidencias')}</p>
                    <p className="text-sm">{teste.evidencias}</p>
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(teste)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    {t('controlesAuditorias.tlBtnEditar')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(teste.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
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
