import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Paperclip, Download, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { openStorageFile } from '@/lib/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RiscoAnexosIconeProps {
  riscoId: string;
}

interface Anexo {
  id: string;
  nome_arquivo: string;
  url_arquivo: string;
  tipo_arquivo?: string;
  tamanho_arquivo?: number;
  created_at: string;
}

export function RiscoAnexosIcone({ riscoId }: RiscoAnexosIconeProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAnexos = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('riscos_anexos')
          .select('*')
          .eq('risco_id', riscoId)
          .eq('tipo_anexo', 'aceite')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAnexos(data || []);
      } catch (error) {
        logger.error('Erro ao buscar anexos:', { data: error });
      } finally {
        setLoading(false);
      }
    };

    if (riscoId) {
      fetchAnexos();
    }
  }, [riscoId]);

  const handleDownload = async (anexo: Anexo) => {
    await openStorageFile('riscos-anexos', anexo.url_arquivo);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (anexos.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-primary hover:text-primary"
                disabled={loading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{anexos.length} anexo(s) de aceite</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-2">
          <h4 className="font-medium text-sm mb-2">Anexos de Aceite ({anexos.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {anexos.map((anexo) => (
              <div key={anexo.id} className="flex items-center justify-between p-2 rounded border bg-background">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{anexo.nome_arquivo}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {anexo.tipo_arquivo && (
                      <span>{anexo.tipo_arquivo.split('/')[1]?.toUpperCase()}</span>
                    )}
                    <span>{formatFileSize(anexo.tamanho_arquivo)}</span>
                    <span>{new Date(anexo.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(anexo)}
                    className="h-6 w-6 p-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(anexo)}
                    className="h-6 w-6 p-0"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}